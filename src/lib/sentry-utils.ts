/**
 * Sentry Utilities
 * Helper functions for using Sentry features throughout your application
 */

import * as Sentry from "@sentry/nextjs";

// ============================================================================
// CUSTOM METRICS
// ============================================================================

/**
 * Track custom metrics for business KPIs
 * @example trackMetric('user.signup', 1, { plan: 'pro' })
 */
export function trackMetric(
  name: string,
  value: number,
  tags?: Record<string, string>
) {
  Sentry.metrics.increment(name, value, {
    tags,
  });
}

/**
 * Track timing metrics (e.g., API response times, function execution)
 * @example trackTiming('api.response.time', 150, { endpoint: '/users' })
 */
export function trackTiming(
  name: string,
  value: number,
  unit: "millisecond" | "second" | "minute" = "millisecond",
  tags?: Record<string, string>
) {
  Sentry.metrics.distribution(name, value, {
    unit,
    tags,
  });
}

/**
 * Track gauge metrics (e.g., current active users, queue size)
 * @example trackGauge('active.users', 42)
 */
export function trackGauge(
  name: string,
  value: number,
  tags?: Record<string, string>
) {
  Sentry.metrics.gauge(name, value, {
    tags,
  });
}

/**
 * Track set metrics (e.g., unique users, unique errors)
 * @example trackSet('unique.users', userId)
 */
export function trackSet(
  name: string,
  value: string | number,
  tags?: Record<string, string>
) {
  Sentry.metrics.set(name, value, {
    tags,
  });
}

// ============================================================================
// CUSTOM BREADCRUMBS
// ============================================================================

/**
 * Add a custom breadcrumb to track user actions
 * @example addBreadcrumb('User clicked button', { buttonId: 'submit' })
 */
export function addBreadcrumb(
  message: string,
  data?: Record<string, any>,
  level: "debug" | "info" | "warning" | "error" = "info"
) {
  Sentry.addBreadcrumb({
    message,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Track navigation breadcrumbs
 */
export function trackNavigation(from: string, to: string) {
  addBreadcrumb("Navigation", {
    from,
    to,
    type: "navigation",
  });
}

/**
 * Track API call breadcrumbs
 */
export function trackApiCall(
  method: string,
  url: string,
  status?: number,
  duration?: number
) {
  addBreadcrumb(`API ${method} ${url}`, {
    method,
    url,
    status,
    duration,
    type: "http",
  });
}

// ============================================================================
// LOGGING INTEGRATION
// ============================================================================

/**
 * Send logs to Sentry with different severity levels
 */
export const logger = {
  debug: (message: string, extra?: Record<string, any>) => {
    console.debug(message, extra);
    Sentry.captureMessage(message, {
      level: "debug",
      extra,
    });
  },

  info: (message: string, extra?: Record<string, any>) => {
    console.info(message, extra);
    Sentry.captureMessage(message, {
      level: "info",
      extra,
    });
  },

  warning: (message: string, extra?: Record<string, any>) => {
    console.warn(message, extra);
    Sentry.captureMessage(message, {
      level: "warning",
      extra,
    });
  },

  error: (message: string, error?: Error, extra?: Record<string, any>) => {
    console.error(message, error, extra);
    if (error) {
      Sentry.captureException(error, {
        extra: { message, ...extra },
      });
    } else {
      Sentry.captureMessage(message, {
        level: "error",
        extra,
      });
    }
  },
};

// ============================================================================
// ERROR TRACKING
// ============================================================================

/**
 * Capture an error with additional context
 */
export function captureError(
  error: Error,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, any>;
    level?: Sentry.SeverityLevel;
  }
) {
  Sentry.captureException(error, context);
}

/**
 * Set user context for better error tracking
 */
export function setUser(user: {
  id?: string;
  email?: string;
  username?: string;
  [key: string]: any;
}) {
  Sentry.setUser(user);
}

/**
 * Clear user context (e.g., on logout)
 */
export function clearUser() {
  Sentry.setUser(null);
}

/**
 * Set custom tags for filtering and grouping
 */
export function setTags(tags: Record<string, string>) {
  Sentry.setTags(tags);
}

/**
 * Set custom context for additional information
 */
export function setContext(name: string, context: Record<string, any>) {
  Sentry.setContext(name, context);
}

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

/**
 * Start a custom span for performance tracking
 * @example
 * const span = startSpan('api.call', async () => {
 *   return await fetch('/api/data');
 * });
 */
export async function startSpan<T>(
  name: string,
  operation: () => Promise<T>,
  op: string = "function"
): Promise<T> {
  return await Sentry.startSpan(
    {
      name,
      op,
    },
    operation
  );
}

/**
 * Track function execution time
 */
export async function measureTime<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - startTime;
    trackTiming(`function.${name}`, duration);
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    trackTiming(`function.${name}.error`, duration);
    throw error;
  }
}

// ============================================================================
// CRON MONITORING
// ============================================================================

/**
 * Monitor a cron job or scheduled task
 * Note: This function is only available server-side.
 * Use it in API routes or server components only.
 *
 * @example
 * // In an API route or server component:
 * import * as Sentry from '@sentry/nextjs'
 *
 * const checkInId = Sentry.captureCheckIn({
 *   monitorSlug: 'daily-cleanup',
 *   status: 'in_progress'
 * })
 *
 * try {
 *   await cleanupOldData()
 *   Sentry.captureCheckIn({ checkInId, monitorSlug: 'daily-cleanup', status: 'ok' })
 * } catch (error) {
 *   Sentry.captureCheckIn({ checkInId, monitorSlug: 'daily-cleanup', status: 'error' })
 * }
 */
