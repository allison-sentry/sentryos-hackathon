'use client'

import { useEffect } from 'react'

export function SentryInit() {
  useEffect(() => {
    // Import Sentry client config on mount
    import('../../sentry.client.config').catch(err => {
      console.error('Failed to load Sentry client config:', err)
    })
  }, [])

  return null
}
