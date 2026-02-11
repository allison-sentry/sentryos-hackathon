'use client'

import { useState, useRef, useEffect } from 'react'
import { Mail, CheckCircle, Inbox, TrendingUp, Brain, Loader2, Send, MessageSquare } from 'lucide-react'
import { logger, trackMetric, addBreadcrumb } from '@/lib/sentry-utils'
import * as Sentry from '@sentry/nextjs'

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

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function EmailAgentPage() {
  const [loading, setLoading] = useState(false)
  const [todos, setTodos] = useState<Todo[]>([])
  const [insights, setInsights] = useState<Insight[]>([])
  const [analysis, setAnalysis] = useState<string>('')

  // Chat interface state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hi! I\'m your Email Agent. I can help you analyze your inbox, extract to-dos, and answer questions about your emails. What would you like to know?',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || chatLoading) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setChatLoading(true)

    // Sentry AI Monitoring - Track user message
    const spanId = Sentry.startSpan({
      name: 'email_agent.chat',
      op: 'ai.chat.completions',
      attributes: {
        'ai.input_messages': 1,
        'ai.model_id': 'claude-sonnet-4.5',
      }
    }, async (span) => {
      logger.info('Email agent chat: User message', {
        messageLength: input.trim().length,
        spanId: span?.spanContext().spanId
      })
      trackMetric('email_agent.chat.message', 1)
      addBreadcrumb('User sent chat message')

      try {
        const response = await fetch('/api/email-agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...messages, userMessage].map(m => ({
              role: m.role,
              content: m.content
            }))
          })
        })

        if (!response.ok) {
          throw new Error('Failed to get response')
        }

        const data = await response.json()

        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.message,
          timestamp: new Date()
        }

        setMessages(prev => [...prev, assistantMessage])

        // Update todos and insights if provided
        if (data.todos) setTodos(data.todos)
        if (data.insights) setInsights(data.insights)

        // Sentry AI Monitoring - Track response
        span?.setAttributes({
          'ai.output_messages': 1,
          'ai.response_length': data.message.length,
          'ai.tools_used': data.toolsUsed || 0,
        })

        logger.info('Email agent chat: Response received', {
          responseLength: data.message.length,
          toolsUsed: data.toolsUsed || 0,
          spanId: span?.spanContext().spanId
        })
        trackMetric('email_agent.chat.response', 1)

      } catch (error) {
        console.error('Chat error:', error)
        logger.error('Email agent chat failed', error as Error)
        trackMetric('email_agent.chat.error', 1)
        Sentry.captureException(error, {
          tags: { component: 'email_agent_chat' }
        })

        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please make sure the Gmail MCP server is configured.',
          timestamp: new Date()
        }])
      } finally {
        setChatLoading(false)
      }

      return span
    })
  }

  const analyzeInbox = async () => {
    setLoading(true)
    logger.info('Email agent: Starting inbox analysis')
    trackMetric('email_agent.analysis.started', 1)
    addBreadcrumb('User requested inbox analysis')

    try {
      const response = await fetch('/api/email-agent/analyze', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to analyze inbox')
      }

      const data = await response.json()

      setTodos(data.todos || [])
      setInsights(data.insights || [])
      setAnalysis(data.summary || '')

      logger.info('Email agent: Analysis completed', {
        todosFound: data.todos?.length || 0,
        insightsGenerated: data.insights?.length || 0,
      })
      trackMetric('email_agent.analysis.completed', 1)
      trackMetric('email_agent.todos.extracted', data.todos?.length || 0)

    } catch (error) {
      console.error('Analysis error:', error)
      logger.error('Email agent analysis failed', error as Error)
      trackMetric('email_agent.analysis.error', 1)
      setAnalysis('Failed to analyze inbox. Make sure Gmail MCP server is configured.')
    } finally {
      setLoading(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-400 border-red-400/30 bg-red-400/10'
      case 'medium': return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10'
      case 'low': return 'text-blue-400 border-blue-400/30 bg-blue-400/10'
      default: return 'text-gray-400 border-gray-400/30 bg-gray-400/10'
    }
  }

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-[#0f0c14] via-[#1a1625] to-[#0f0c14]">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Mail className="w-10 h-10 text-[#7553ff]" />
            <h1 className="text-4xl font-bold text-white">Email Agent</h1>
          </div>
          <p className="text-[#9086a3] text-lg">
            AI-powered inbox analysis powered by Gmail MCP Server
          </p>
        </div>

        {/* Action Button */}
        <div className="mb-8">
          <button
            onClick={analyzeInbox}
            disabled={loading}
            className="px-6 py-3 bg-[#7553ff] hover:bg-[#8c6fff] disabled:bg-[#362552] disabled:cursor-not-allowed rounded-lg transition-colors font-medium text-white flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing Inbox...
              </>
            ) : (
              <>
                <Brain className="w-5 h-5" />
                Analyze Inbox
              </>
            )}
          </button>
        </div>

        {/* Analysis Summary */}
        {analysis && (
          <div className="mb-8 bg-[#1e1a2a] rounded-lg p-6 border border-[#7553ff]/30">
            <h2 className="text-xl font-semibold mb-3 text-[#c4b5fd] flex items-center gap-2">
              <Brain className="w-5 h-5" />
              AI Summary
            </h2>
            <p className="text-[#e8e4f0] leading-relaxed whitespace-pre-wrap">
              {analysis}
            </p>
          </div>
        )}

        {/* Chat Interface */}
        <div className="mb-8 bg-[#1e1a2a] rounded-lg border border-[#362552] overflow-hidden">
          <div className="bg-[#2a2438] px-6 py-4 border-b border-[#362552] flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#7553ff]" />
            <h2 className="text-xl font-semibold text-[#c4b5fd]">Chat with Email Agent</h2>
          </div>

          {/* Messages */}
          <div className="h-96 overflow-y-auto p-6 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  message.role === 'user' ? 'bg-[#ff45a8]/20' : 'bg-[#7553ff]/20'
                }`}>
                  {message.role === 'user' ? '👤' : '🤖'}
                </div>
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-[#ff45a8]/10 text-[#e8e4f0]'
                      : 'bg-[#2a2438] text-[#e8e4f0]'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <span className="text-[10px] text-[#9086a3] mt-1 block">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-[#7553ff]/20">
                  🤖
                </div>
                <div className="bg-[#2a2438] rounded-lg px-4 py-3">
                  <Loader2 className="w-4 h-4 text-[#7553ff] animate-spin" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleChatSubmit} className="p-4 border-t border-[#362552] bg-[#2a2438]">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your emails..."
                className="flex-1 bg-[#1e1a2a] text-[#e8e4f0] text-sm rounded px-3 py-2 border border-[#362552] focus:border-[#7553ff] focus:outline-none placeholder:text-[#9086a3]"
                disabled={chatLoading}
              />
              <button
                type="submit"
                disabled={chatLoading || !input.trim()}
                className="px-4 py-2 bg-[#7553ff] hover:bg-[#8c6fff] disabled:bg-[#362552] disabled:cursor-not-allowed rounded transition-colors"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </div>
          </form>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* To-Dos */}
          <div className="bg-[#1e1a2a] rounded-lg p-6 border border-[#362552]">
            <h2 className="text-2xl font-semibold mb-4 text-[#c4b5fd] flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-[#7553ff]" />
              To-Dos from Emails
              {todos.length > 0 && (
                <span className="ml-auto text-sm bg-[#7553ff]/20 text-[#7553ff] px-2 py-1 rounded">
                  {todos.length}
                </span>
              )}
            </h2>

            <div className="space-y-3">
              {todos.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-16 h-16 text-[#362552] mx-auto mb-3" />
                  <p className="text-[#9086a3]">
                    {loading ? 'Analyzing...' : 'Click "Analyze Inbox" to extract to-dos from your emails'}
                  </p>
                </div>
              ) : (
                todos.map((todo) => (
                  <div
                    key={todo.id}
                    className={`p-4 rounded-lg border ${getPriorityColor(todo.priority)}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-[#e8e4f0] font-medium mb-1">{todo.text}</p>
                        <p className="text-sm text-[#9086a3]">From: {todo.source}</p>
                        {todo.dueDate && (
                          <p className="text-xs text-[#9086a3] mt-1">Due: {todo.dueDate}</p>
                        )}
                      </div>
                      <span className="text-xs px-2 py-1 rounded bg-white/10 uppercase font-semibold">
                        {todo.priority}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Insights */}
          <div className="bg-[#1e1a2a] rounded-lg p-6 border border-[#362552]">
            <h2 className="text-2xl font-semibold mb-4 text-[#c4b5fd] flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-[#ff45a8]" />
              Inbox Insights
            </h2>

            <div className="space-y-3">
              {insights.length === 0 ? (
                <div className="text-center py-12">
                  <Inbox className="w-16 h-16 text-[#362552] mx-auto mb-3" />
                  <p className="text-[#9086a3]">
                    {loading ? 'Generating insights...' : 'Insights will appear here after analysis'}
                  </p>
                </div>
              ) : (
                insights.map((insight, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg bg-[#2a2438] border border-[#362552] hover:border-[#7553ff]/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="text-[#e8e4f0] font-semibold mb-1">{insight.title}</h3>
                        <p className="text-sm text-[#9086a3]">{insight.description}</p>
                      </div>
                      {insight.value && (
                        <div className="text-2xl font-bold text-[#ff45a8]">
                          {insight.value}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Setup Instructions */}
        <div className="mt-8 p-6 bg-[#1e1a2a] rounded-lg border border-[#7553ff]/30">
          <h3 className="text-lg font-semibold mb-3 text-[#7553ff]">🔧 Gmail MCP Server Setup</h3>
          <div className="text-sm text-[#9086a3] space-y-2">
            <p>The Gmail MCP server has been added to your <code className="px-2 py-1 bg-[#0f0c14] rounded text-[#c4b5fd]">.mcp.json</code></p>
            <p className="text-[#e8e4f0] font-medium mt-3">To complete setup:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Restart Claude Code to load the new MCP server</li>
              <li>Grant Gmail permissions when prompted</li>
              <li>The email agent will use Claude's access to your Gmail via MCP</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
