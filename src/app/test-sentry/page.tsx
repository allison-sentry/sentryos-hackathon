'use client'

import { useState } from 'react'
import * as Sentry from '@sentry/nextjs'
import { logger, trackMetric, addBreadcrumb } from '@/lib/sentry-utils'

export default function TestSentryPage() {
  const [results, setResults] = useState<string[]>([])

  const addResult = (message: string) => {
    setResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const testError = () => {
    addResult('🔴 Triggering test error...')
    try {
      throw new Error('Test Error from Sentry Test Page!')
    } catch (error) {
      Sentry.captureException(error, {
        tags: { test: 'manual', page: 'test-sentry' },
        extra: { timestamp: new Date().toISOString() }
      })
      addResult('✅ Error captured and sent to Sentry')
    }
  }

  const testMessage = () => {
    addResult('📝 Sending test message...')
    Sentry.captureMessage('Test message from Sentry Test Page', {
      level: 'info',
      tags: { test: 'manual', page: 'test-sentry' }
    })
    addResult('✅ Message sent to Sentry')
  }

  const testLogger = () => {
    addResult('📋 Testing logger utilities...')
    logger.info('Test info log from test page', { test: true })
    logger.warning('Test warning log from test page', { test: true })
    addResult('✅ Logs sent via logger utilities')
  }

  const testBreadcrumbs = () => {
    addResult('🍞 Adding breadcrumbs...')
    addBreadcrumb('User clicked test breadcrumbs button', { test: true })
    addBreadcrumb('Breadcrumb test step 1', { step: 1 })
    addBreadcrumb('Breadcrumb test step 2', { step: 2 })

    // Now trigger an error to see breadcrumbs
    try {
      throw new Error('Error with breadcrumbs attached')
    } catch (error) {
      Sentry.captureException(error)
    }
    addResult('✅ Breadcrumbs added and error sent')
  }

  const testUserContext = () => {
    addResult('👤 Setting user context...')
    Sentry.setUser({
      id: 'test-user-123',
      email: 'test@example.com',
      username: 'test_user'
    })

    // Trigger error with user context
    try {
      throw new Error('Error with user context')
    } catch (error) {
      Sentry.captureException(error)
    }
    addResult('✅ User context set and error sent')
  }

  const checkInitialization = () => {
    addResult('🔍 Checking Sentry initialization...')
    const client = Sentry.getClient()
    if (client) {
      const options = client.getOptions()
      addResult(`✅ Sentry is initialized`)
      addResult(`DSN: ${options.dsn ? 'Configured ✅' : 'Missing ❌'}`)
      addResult(`Environment: ${options.environment || 'not set'}`)
    } else {
      addResult('❌ Sentry is NOT initialized!')
    }
  }

  return (
    <div className="min-h-screen p-8 bg-[#1a1625] text-white">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-[#7553ff]">
          🔍 Sentry Integration Test
        </h1>

        <div className="bg-[#1e1a2a] rounded-lg p-6 mb-6 border border-[#362552]">
          <h2 className="text-xl font-semibold mb-4 text-[#c4b5fd]">Test Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={checkInitialization}
              className="px-4 py-3 bg-[#7553ff] hover:bg-[#8c6fff] rounded-lg transition-colors font-medium"
            >
              1. Check Initialization
            </button>

            <button
              onClick={testMessage}
              className="px-4 py-3 bg-[#7553ff] hover:bg-[#8c6fff] rounded-lg transition-colors font-medium"
            >
              2. Test Message
            </button>

            <button
              onClick={testError}
              className="px-4 py-3 bg-[#ff4757] hover:bg-[#ff6b7a] rounded-lg transition-colors font-medium"
            >
              3. Test Error
            </button>

            <button
              onClick={testLogger}
              className="px-4 py-3 bg-[#7553ff] hover:bg-[#8c6fff] rounded-lg transition-colors font-medium"
            >
              4. Test Logger
            </button>

            <button
              onClick={testBreadcrumbs}
              className="px-4 py-3 bg-[#7553ff] hover:bg-[#8c6fff] rounded-lg transition-colors font-medium"
            >
              5. Test Breadcrumbs
            </button>

            <button
              onClick={testUserContext}
              className="px-4 py-3 bg-[#7553ff] hover:bg-[#8c6fff] rounded-lg transition-colors font-medium"
            >
              6. Test User Context
            </button>
          </div>
        </div>

        <div className="bg-[#1e1a2a] rounded-lg p-6 border border-[#362552]">
          <h2 className="text-xl font-semibold mb-4 text-[#c4b5fd]">Results</h2>
          <div className="bg-[#0f0c14] rounded p-4 font-mono text-sm max-h-96 overflow-y-auto">
            {results.length === 0 ? (
              <p className="text-[#9086a3]">Click buttons above to test Sentry...</p>
            ) : (
              results.map((result, i) => (
                <div key={i} className="text-[#e8e4f0] mb-1">
                  {result}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-6 p-4 bg-[#2a2438] rounded-lg border border-[#7553ff]/30">
          <h3 className="font-semibold mb-2 text-[#7553ff]">🔗 Check Your Sentry Dashboard:</h3>
          <a
            href="https://sentry.io/organizations/na-2bf/projects/javascript-nextjs/issues/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#7553ff] hover:text-[#c4b5fd] underline"
          >
            https://sentry.io/organizations/na-2bf/projects/javascript-nextjs/issues/
          </a>
          <p className="text-sm text-[#9086a3] mt-2">
            Events should appear within a few seconds after triggering them.
          </p>
        </div>

        <div className="mt-4 p-4 bg-[#362552]/20 rounded-lg">
          <h3 className="font-semibold mb-2 text-[#ff45a8]">💡 Tips:</h3>
          <ul className="text-sm text-[#9086a3] space-y-1 list-disc list-inside">
            <li>Open your browser's DevTools (F12) → Network tab</li>
            <li>Filter by "sentry" to see if events are being sent</li>
            <li>Look for POST requests to ingest.sentry.io</li>
            <li>Check the Console tab for any Sentry errors</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
