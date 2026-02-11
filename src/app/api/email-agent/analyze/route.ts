import { query } from '@anthropic-ai/claude-agent-sdk'
import * as Sentry from '@sentry/nextjs'
import { logger, trackMetric, addBreadcrumb } from '@/lib/sentry-utils'
import { NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are an intelligent email assistant with access to Gmail through the Gmail MCP server.

IMPORTANT: You have access to Gmail MCP server tools. Use them to access real email data:
- gmail_search: Search for emails with queries (e.g., "is:unread", "from:someone@example.com")
- gmail_get_message: Read full email content by message ID
- gmail_list_threads: List email threads
- gmail_list_labels: Get Gmail labels and folders
- gmail_modify_message: Mark as read, archive, add/remove labels

Your task is to:
1. Use Gmail tools to analyze the user's inbox with real data
2. Extract actionable to-dos and tasks from actual email content
3. Provide insights about email patterns, important senders, and inbox health based on real data
4. Summarize the current state of the inbox

When extracting to-dos:
- Read actual email content using Gmail tools
- Look for action items, deadlines, and requests in the email text
- Categorize priority (high/medium/low) based on urgency and importance
- Include the sender/source from the email metadata

When providing insights:
- Use Gmail search to identify trends (most common senders, busiest times)
- Flag important unread emails
- Count emails by status (unread, starred, etc.)
- Suggest inbox organization tips based on actual patterns

Return your analysis in a structured JSON format as requested.`

interface Todo {
  id: string
  text: string
  source: string
  priority: 'high' | 'medium' | 'low'
  dueDate?: string
}

interface Insight {
  type: string
  title: string
  description: string
  value?: string | number
}

interface AnalysisResult {
  summary: string
  todos: Todo[]
  insights: Insight[]
}

export async function POST(request: Request) {
  const requestStartTime = Date.now()
  const requestId = crypto.randomUUID()

  logger.info('Email agent analysis started', { requestId })
  trackMetric('email_agent.api.request', 1)
  addBreadcrumb('Email agent API called', { requestId })

  try {
    const userPrompt = `Please analyze my Gmail inbox and:

1. Extract all to-dos and action items from recent emails
2. Provide insights about my inbox (unread count, top senders, important emails)
3. Give me a summary of my inbox status

Format your response as JSON with this structure:
{
  "summary": "A brief overview of the inbox state",
  "todos": [
    {
      "id": "unique-id",
      "text": "Description of the to-do",
      "source": "Email sender or subject",
      "priority": "high/medium/low",
      "dueDate": "date if mentioned"
    }
  ],
  "insights": [
    {
      "type": "stat",
      "title": "Insight title",
      "description": "Description",
      "value": "number or text"
    }
  ]
}

Please use the Gmail MCP server tools to access my inbox.`

    logger.info('Querying Claude with email analysis prompt', { requestId })

    let fullResponse = ''

    // Use Claude Agent SDK to query with Gmail MCP server access
    for await (const message of query({
      prompt: `${SYSTEM_PROMPT}\n\n${userPrompt}`,
      options: {
        maxTurns: 15,
        tools: { type: 'preset', preset: 'full' },
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        includePartialMessages: true,
        cwd: process.cwd(),
      }
    })) {
      // Collect the response
      if (message.type === 'stream_event' && 'event' in message) {
        const event = message.event
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          fullResponse += event.delta.text
        }
      }

      // Log tool usage
      if (message.type === 'assistant' && 'message' in message) {
        const content = message.message?.content
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'tool_use') {
              logger.info('Email agent used tool', {
                requestId,
                tool: block.name
              })
              trackMetric('email_agent.tool.used', 1, { tool: block.name })
            }
          }
        }
      }
    }

    logger.info('Claude query completed', {
      requestId,
      responseLength: fullResponse.length
    })

    // Try to parse JSON response
    let analysisResult: AnalysisResult
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = fullResponse.match(/```json\n([\s\S]*?)\n```/) ||
                       fullResponse.match(/```\n([\s\S]*?)\n```/)

      const jsonString = jsonMatch ? jsonMatch[1] : fullResponse
      analysisResult = JSON.parse(jsonString)
    } catch (parseError) {
      logger.warning('Failed to parse JSON response, using fallback', { requestId })

      // Fallback: create a structured response from the text
      analysisResult = {
        summary: fullResponse.substring(0, 500),
        todos: [
          {
            id: '1',
            text: 'Review email analysis results',
            source: 'Email Agent',
            priority: 'medium',
          }
        ],
        insights: [
          {
            type: 'info',
            title: 'Analysis Complete',
            description: 'Check the summary above for details',
          }
        ]
      }
    }

    const duration = Date.now() - requestStartTime
    logger.info('Email agent analysis completed', {
      requestId,
      duration,
      todosFound: analysisResult.todos?.length || 0,
      insightsGenerated: analysisResult.insights?.length || 0,
    })

    trackMetric('email_agent.api.success', 1)
    trackMetric('email_agent.api.duration', duration)
    trackMetric('email_agent.todos.extracted', analysisResult.todos?.length || 0)

    return NextResponse.json(analysisResult)

  } catch (error) {
    const duration = Date.now() - requestStartTime
    logger.error('Email agent analysis failed', error as Error, { requestId, duration })
    trackMetric('email_agent.api.error', 1)

    Sentry.captureException(error, {
      tags: { component: 'email_agent', requestId },
      extra: { duration }
    })

    return NextResponse.json(
      {
        error: 'Failed to analyze inbox',
        summary: 'An error occurred while analyzing your inbox. Please make sure the Gmail MCP server is configured and you have granted permissions.',
        todos: [],
        insights: []
      },
      { status: 500 }
    )
  }
}
