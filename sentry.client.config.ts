// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Add optional integrations for additional features
  integrations: [
    // Session Replay - Record user sessions
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
    // User Feedback - Feedback widget for users to report issues
    Sentry.feedbackIntegration({
      colorScheme: "system",
      autoInject: true,
    }),
    // Browser Profiling - Performance profiling in the browser
    Sentry.browserProfilingIntegration(),
    // Custom Breadcrumbs - Track console logs as breadcrumbs
    Sentry.breadcrumbsIntegration({
      console: true,
      dom: true,
      fetch: true,
      history: true,
      xhr: true,
    }),
  ],

  // Performance Monitoring - Define how likely traces are sampled
  tracesSampleRate: 1.0,

  // Profiling - Define how likely profiling data is sampled
  // Note: Profiling sample rate is relative to tracesSampleRate
  profilesSampleRate: 1.0,

  // Session Replay - Define how likely Replay events are sampled
  // 10% of sessions will be recorded
  replaysSessionSampleRate: 0.1,

  // Session Replay - 100% of sessions with errors will be recorded
  replaysOnErrorSampleRate: 1.0,

  // Enable custom metrics
  enableTracing: true,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Additional options for better error tracking
  beforeSend(event, hint) {
    // Add custom logic here if needed (e.g., filtering, enrichment)
    return event;
  },

  // Ignore certain errors
  ignoreErrors: [
    // Browser extensions
    'top.GLOBALS',
    // Random plugins/extensions
    'originalCreateNotification',
    'canvas.contentDocument',
    'MyApp_RemoveAllHighlights',
  ],
});
