'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { logger, trackMetric, addBreadcrumb } from '@/lib/sentry-utils'

const Desktop = dynamic(
  () => import('@/components/desktop/Desktop').then(mod => mod.Desktop),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 bg-[#0f0c14] flex items-center justify-center">
        <div className="text-[#7553ff] text-xl animate-pulse">Loading SentryOS...</div>
      </div>
    )
  }
)

export default function Home() {
  useEffect(() => {
    // Track desktop page view
    logger.info('Desktop page loaded')
    trackMetric('page.desktop.view', 1)
    addBreadcrumb('Desktop page mounted')
  }, [])

  return <Desktop />
}
