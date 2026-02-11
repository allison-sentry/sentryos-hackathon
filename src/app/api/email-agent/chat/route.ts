import { query } from '@anthropic-ai/claude-agent-sdk'
import * as Sentry from '@sentry/nextjs'
import { logger, trackMetric, addBreadcrumb, startSpan } from '@/lib/sentry-utils'
import { NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are an intelligent email assistant with access to Gmail through the Gmail MCP server.

You can help users:
- Answer questions about their emails
- Find specific emails or information
- Extract to-dos and action items
- Provide insights about inbox patterns
- Manage email tasks (mark as read, archive, etc.)

Be conversational, helpful, and proactive. Use the Gmail tools to access real email data.
When you extract to-dos or insights, return them in the response.`

interface MessageInput {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(request: Request) {
  const requestStartTime = Date.now()
  const requestId = crypto.randomUUID()

  // Sentry AI Monitoring - Create span for the entire chat request
  return await Sentry.startSpan({
    name: 'email_agent.chat.request',
    op: 'ai.chat',
    attributes: {
      'ai.model_id': 'claude-sonnet-4.5',
      'request_id': requestId,
    }
  }, async (parentSpan) => {
    logger.info('Email agent chat request started', { requestId })
    trackMetric('email_agent.chat.api.request', 1)
    addBreadcrumb('Email agent chat API called', { requestId })

    try {
      const { messages } = await request.json() as { messages: MessageInput[] }

      if (!messages || !Array.isArray(messages)) {
        trackMetric('email_agent.chat.api.error.validation', 1)
        return NextResponse.json(
          { error: 'Messages array is required' },
          { status: 400 }
        )
      }

      const lastUserMessage = messages.filter(m => m.role === 'user').pop()
      if (!lastUserMessage) {
        trackMetric('email_agent.chat.api.error.validation', 1)
        return NextResponse.json(
          { error: 'No user message found' },
          { status: 400 }
        )
      }

      logger.info('Processing chat message', {
        requestId,
        messageCount: messages.length,
        userMessageLength: lastUserMessage.content.length
      })

      // Build conversation context
      const conversationContext = messages
        .slice(0, -1)
        .map((m: MessageInput) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n')

      const fullPrompt = conversationContext
        ? `${SYSTEM_PROMPT}\n\nPrevious conversation:\n${conversationContext}\n\nUser: ${lastUserMessage.content}`
        : `${SYSTEM_PROMPT}\n\nUser: ${lastUserMessage.content}`

      let fullResponse = ''
      let toolsUsed = 0

      // Sentry AI Monitoring - Track Claude query
      await Sentry.startSpan({
        name: 'claude.query',
        op: 'ai.chat.completions',
        attributes: {
          'ai.input_messages': messages.length,
          'ai.model_id': 'claude-sonnet-4.5',
        }
      }, async (querySpan) => {
        logger.info('Starting Claude Agent SDK query', { requestId })

        for await (const message of query({
          prompt: fullPrompt,
          options: {
            maxTurns: 10,
            tools: { type: 'preset', preset: 'claude_code' },
            permissionMode: 'bypassPermissions',
            allowDangerouslySkipPermissions: true,
            includePartialMessages: true,
            cwd: process.cwd(),
          }
        })) {
          // Collect streaming text
          if (message.type === 'stream_event' && 'event' in message) {
            const event = message.event
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              fullResponse += event.delta.text
            }
          }

          // Track tool usage - Sentry AI Monitoring
          if (message.type === 'assistant' && 'message' in message) {
            const content = message.message?.content
            if (Array.isArray(content)) {
              for (const block of content) {
                if (block.type === 'tool_use') {
                  toolsUsed++

                  // Sentry AI Monitoring - Track tool call
                  Sentry.startSpan({
                    name: `tool.${block.name}`,
                    op: 'ai.tool',
                    attributes: {
                      'ai.tool.name': block.name,
                    }
                  }, () => {
                    logger.info('Email agent used tool', {
                      requestId,
                      tool: block.name
                    })
                    trackMetric('email_agent.chat.tool.used', 1, { tool: block.name })
                  })
                }
              }
            }
          }
        }

        // Set span attributes after completion
        querySpan?.setAttributes({
          'ai.output_messages': 1,
          'ai.response_tokens': fullResponse.length, // Approximate
          'ai.tools_called': toolsUsed,
        })
      })

      const duration = Date.now() - requestStartTime

      // Sentry AI Monitoring - Track completion metrics
      parentSpan?.setAttributes({
        'ai.total_tokens': fullResponse.length, // Approximate
        'ai.completion_tokens': fullResponse.length,
        'ai.tools_called': toolsUsed,
        'duration_ms': duration,
      })

      logger.info('Email agent chat completed', {
        requestId,
        duration,
        responseLength: fullResponse.length,
        toolsUsed
      })

      trackMetric('email_agent.chat.api.success', 1)
      trackMetric('email_agent.chat.api.duration', duration)
      trackMetric('email_agent.chat.tools.total', toolsUsed)

      return NextResponse.json({
        message: fullResponse,
        toolsUsed,
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      const duration = Date.now() - requestStartTime

      logger.error('Email agent chat failed', error as Error, { requestId, duration })
      trackMetric('email_agent.chat.api.error', 1)

      // Sentry AI Monitoring - Track error
      Sentry.captureException(error, {
        tags: {
          component: 'email_agent_chat',
          requestId,
        },
        extra: {
          duration,
        },
        contexts: {
          ai: {
            model_id: 'claude-sonnet-4.5',
            operation: 'chat',
          }
        }
      })

      return NextResponse.json(
        {
          error: 'Failed to process chat message',
          message: 'Sorry, I encountered an error. Please try again.',
        },
        { status: 500 }
      )
    }
  })
}
