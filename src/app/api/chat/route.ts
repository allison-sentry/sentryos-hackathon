import { query } from '@anthropic-ai/claude-agent-sdk'
import * as Sentry from '@sentry/nextjs'
import { logger, trackMetric, trackTiming, addBreadcrumb, startSpan } from '@/lib/sentry-utils'

const SYSTEM_PROMPT = `You are a helpful personal assistant designed to help with general research, questions, and tasks.

Your role is to:
- Answer questions on any topic accurately and thoroughly
- Help with research by searching the web for current information
- Assist with writing, editing, and brainstorming
- Provide explanations and summaries of complex topics
- Help solve problems and think through decisions

Guidelines:
- Be friendly, clear, and conversational
- Use web search when you need current information, facts you're unsure about, or real-time data
- Keep responses concise but complete - expand when the topic warrants depth
- Use markdown formatting when it helps readability (bullet points, code blocks, etc.)
- Be honest when you don't know something and offer to search for answers`

interface MessageInput {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(request: Request) {
  const requestStartTime = Date.now()
  const requestId = crypto.randomUUID()

  // Log API request start
  logger.info('Chat API request started', { requestId })
  trackMetric('api.chat.request', 1)
  addBreadcrumb('Chat API request received', { requestId })

  try {
    const { messages } = await request.json() as { messages: MessageInput[] }

    if (!messages || !Array.isArray(messages)) {
      logger.warning('Invalid request: Messages array missing', { requestId })
      trackMetric('api.chat.error.validation', 1, { error: 'missing_messages' })
      return new Response(
        JSON.stringify({ error: 'Messages array is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get the last user message
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()
    if (!lastUserMessage) {
      logger.warning('Invalid request: No user message found', { requestId })
      trackMetric('api.chat.error.validation', 1, { error: 'no_user_message' })
      return new Response(
        JSON.stringify({ error: 'No user message found' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Log request details
    const messageCount = messages.length
    const userMessageLength = lastUserMessage.content.length
    logger.info('Processing chat request', {
      requestId,
      messageCount,
      userMessageLength
    })
    trackMetric('api.chat.messages', messageCount)
    addBreadcrumb('User message received', {
      requestId,
      messageLength: userMessageLength
    })

    // Build conversation context
    const conversationContext = messages
      .slice(0, -1) // Exclude the last message since we pass it as the prompt
      .map((m: MessageInput) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n')

    const fullPrompt = conversationContext
      ? `${SYSTEM_PROMPT}\n\nPrevious conversation:\n${conversationContext}\n\nUser: ${lastUserMessage.content}`
      : `${SYSTEM_PROMPT}\n\nUser: ${lastUserMessage.content}`

    // Create a streaming response
    const encoder = new TextEncoder()
    let tokensGenerated = 0
    let toolsUsed = 0

    const stream = new ReadableStream({
      async start(controller) {
        try {
          logger.info('Starting Claude Agent SDK query', { requestId })
          addBreadcrumb('Agent query started', { requestId })

          // Use the claude-agent-sdk query function with all default tools enabled
          for await (const message of query({
            prompt: fullPrompt,
            options: {
              maxTurns: 10,
              // Use the preset to enable all Claude Code tools including WebSearch
              tools: { type: 'preset', preset: 'claude_code' },
              // Bypass all permission checks for automated tool execution
              permissionMode: 'bypassPermissions',
              allowDangerouslySkipPermissions: true,
              // Enable partial messages for real-time text streaming
              includePartialMessages: true,
              // Set working directory to the app's directory for sandboxing
              cwd: process.cwd(),
            }
          })) {
            // Handle streaming text deltas (partial messages)
            if (message.type === 'stream_event' && 'event' in message) {
              const event = message.event
              // Handle content block delta events for text streaming
              if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                tokensGenerated++
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({ type: 'text_delta', text: event.delta.text })}\n\n`
                ))
              }
            }

            // Send tool start events from assistant messages
            if (message.type === 'assistant' && 'message' in message) {
              const content = message.message?.content
              if (Array.isArray(content)) {
                for (const block of content) {
                  if (block.type === 'tool_use') {
                    toolsUsed++
                    logger.info('Tool invoked', { requestId, tool: block.name })
                    addBreadcrumb('Tool used', { requestId, tool: block.name })
                    trackMetric('api.chat.tool.used', 1, { tool: block.name })
                    controller.enqueue(encoder.encode(
                      `data: ${JSON.stringify({ type: 'tool_start', tool: block.name })}\n\n`
                    ))
                  }
                }
              }
            }

            // Send tool progress updates
            if (message.type === 'tool_progress') {
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: 'tool_progress', tool: message.tool_name, elapsed: message.elapsed_time_seconds })}\n\n`
              ))
            }

            // Signal completion
            if (message.type === 'result' && message.subtype === 'success') {
              const duration = Date.now() - requestStartTime
              logger.info('Chat API request completed', {
                requestId,
                duration,
                tokensGenerated,
                toolsUsed
              })
              trackTiming('api.chat.duration', duration, 'millisecond')
              trackMetric('api.chat.success', 1)
              trackMetric('api.chat.tokens', tokensGenerated)
              trackMetric('api.chat.tools', toolsUsed)

              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: 'done' })}\n\n`
              ))
            }

            // Handle errors
            if (message.type === 'result' && message.subtype !== 'success') {
              logger.error('Query did not complete successfully', undefined, {
                requestId,
                subtype: message.subtype
              })
              trackMetric('api.chat.error.query_failed', 1)
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: 'error', message: 'Query did not complete successfully' })}\n\n`
              ))
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          logger.error('Stream error in chat API', error as Error, { requestId })
          trackMetric('api.chat.error.stream', 1)
          Sentry.captureException(error, {
            tags: { component: 'chat_api', requestId }
          })
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'error', message: 'Stream error occurred' })}\n\n`
          ))
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    const duration = Date.now() - requestStartTime
    logger.error('Chat API error', error as Error, { requestId, duration })
    trackMetric('api.chat.error.general', 1)
    trackTiming('api.chat.error.duration', duration, 'millisecond')

    Sentry.captureException(error, {
      tags: { component: 'chat_api', requestId },
      extra: { duration }
    })

    return new Response(
      JSON.stringify({ error: 'Failed to process chat request. Check server logs for details.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
