'use client'

import { useState } from 'react'
import { Mail, CheckCircle, Inbox, TrendingUp, Brain, Loader2 } from 'lucide-react'
import { logger, trackMetric, addBreadcrumb } from '@/lib/sentry-utils'

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

export default function EmailAgentPage() {
  const [loading, setLoading] = useState(false)
  const [todos, setTodos] = useState<Todo[]>([])
  const [insights, setInsights] = useState<Insight[]>([])
  const [analysis, setAnalysis] = useState<string>('')

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
