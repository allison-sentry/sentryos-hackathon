// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring - Define how likely traces are sampled
  tracesSampleRate: 1.0,

  // Profiling - Define how likely profiling data is sampled
  profilesSampleRate: 1.0,

  // Enable custom metrics and tracing
  enableTracing: true,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Additional integrations for server-side monitoring
  integrations: [
    // Capture console logs and send to Sentry Logs
    Sentry.captureConsoleIntegration({
      levels: ['log', 'info', 'warn', 'error', 'debug']
    }),
  ],
});
