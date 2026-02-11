"use client";

import { useState } from "react";
import * as Sentry from "@sentry/nextjs";
import {
  trackMetric,
  trackTiming,
  trackGauge,
  trackSet,
  addBreadcrumb,
  trackNavigation,
  trackApiCall,
  logger,
  captureError,
  setUser,
  clearUser,
  setTags,
  startSpan,
  measureTime,
} from "@/lib/sentry-utils";

export default function SentryDemoPage() {
  const [actionLog, setActionLog] = useState<string[]>([]);

  const log = (message: string) => {
    setActionLog((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Error Tracking Demos
  const triggerError = () => {
    try {
      throw new Error("This is a test error from the demo page!");
    } catch (error) {
      captureError(error as Error, {
        tags: { feature: "demo", type: "manual" },
        extra: { demoAction: "Error button clicked" },
      });
      log("❌ Error captured and sent to Sentry");
    }
  };

  const triggerUnhandledError = () => {
    throw new Error("This is an unhandled error that will crash the component!");
  };

  // Performance Monitoring Demos
  const trackPerformance = async () => {
    log("⏱️ Starting performance tracking...");

    await startSpan("demo.performance.test", async () => {
      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 500));
      trackTiming("demo.operation.duration", 500, "millisecond", {
        operation: "test",
      });
    });

    log("✅ Performance data sent to Sentry");
  };

  const measureFunction = async () => {
    log("📊 Measuring function execution time...");

    await measureTime("demo.function", async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    log("✅ Function timing measured and sent to Sentry");
  };

  // Custom Metrics Demos
  const sendCustomMetrics = () => {
    trackMetric("demo.button.click", 1, { button: "metrics" });
    trackGauge("demo.active.users", Math.floor(Math.random() * 100));
    trackSet("demo.unique.sessions", `session-${Date.now()}`);

    log("📊 Custom metrics sent to Sentry");
  };

  // Breadcrumbs Demos
  const addCustomBreadcrumb = () => {
    addBreadcrumb("User performed demo action", {
      action: "breadcrumb_test",
      timestamp: new Date().toISOString(),
    });

    log("🍞 Custom breadcrumb added");
  };

  const trackNav = () => {
    trackNavigation("/", "/sentry-demo");
    log("🧭 Navigation breadcrumb added");
  };

  const trackAPI = () => {
    trackApiCall("GET", "/api/demo", 200, 150);
    log("🌐 API call breadcrumb added");
  };

  // Logging Demos
  const sendLogs = () => {
    logger.info("Info log from demo page", { demoType: "logging" });
    logger.debug("Debug log from demo page", { debugData: "test" });
    logger.warning("Warning log from demo page", { warningLevel: "medium" });

    log("📝 Logs sent to Sentry");
  };

  // User Context Demos
  const setUserContext = () => {
    setUser({
      id: "demo-user-123",
      email: "demo@example.com",
      username: "demo_user",
      subscription: "pro",
    });

    setTags({
      environment: "demo",
      feature: "sentry-test",
    });

    log("👤 User context set");
  };

  const clearUserContext = () => {
    clearUser();
    log("👤 User context cleared");
  };

  // Session Replay Demo
  const triggerReplayCapture = () => {
    // Session replay is automatic, but we can trigger an error to ensure capture
    logger.error("Error to trigger session replay", undefined, {
      replayTrigger: true,
    });
    log("🎬 Session replay triggered (check Sentry dashboard)");
  };

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 mb-8">
          <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">
            🔍 Sentry Products Demo
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Test all Sentry features and see them in your Sentry dashboard at{" "}
            <a
              href="https://sentry.io/organizations/na-2bf/projects/javascript-nextjs/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              sentry.io
            </a>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Error Tracking */}
            <DemoSection title="🐛 Error Tracking" description="Capture and track errors">
              <button onClick={triggerError} className="demo-button">
                Capture Test Error
              </button>
              <button onClick={triggerUnhandledError} className="demo-button-danger">
                Throw Unhandled Error
              </button>
            </DemoSection>

            {/* Performance Monitoring */}
            <DemoSection title="⚡ Performance" description="Track performance metrics">
              <button onClick={trackPerformance} className="demo-button">
                Track Performance Span
              </button>
              <button onClick={measureFunction} className="demo-button">
                Measure Function Time
              </button>
            </DemoSection>

            {/* Custom Metrics */}
            <DemoSection title="📊 Custom Metrics" description="Track business KPIs">
              <button onClick={sendCustomMetrics} className="demo-button">
                Send Custom Metrics
              </button>
            </DemoSection>

            {/* Breadcrumbs */}
            <DemoSection title="🍞 Breadcrumbs" description="Track user actions">
              <button onClick={addCustomBreadcrumb} className="demo-button">
                Add Breadcrumb
              </button>
              <button onClick={trackNav} className="demo-button">
                Track Navigation
              </button>
              <button onClick={trackAPI} className="demo-button">
                Track API Call
              </button>
            </DemoSection>

            {/* Logging */}
            <DemoSection title="📝 Logging" description="Centralized logging">
              <button onClick={sendLogs} className="demo-button">
                Send Logs (Info, Debug, Warning)
              </button>
            </DemoSection>

            {/* User Context */}
            <DemoSection title="👤 User Context" description="Track user information">
              <button onClick={setUserContext} className="demo-button">
                Set User Context
              </button>
              <button onClick={clearUserContext} className="demo-button">
                Clear User Context
              </button>
            </DemoSection>

            {/* Session Replay */}
            <DemoSection title="🎬 Session Replay" description="Record user sessions">
              <button onClick={triggerReplayCapture} className="demo-button">
                Trigger Replay Capture
              </button>
              <p className="text-xs text-gray-500 mt-2">
                Note: Sessions are recorded automatically. This triggers an error to ensure capture.
              </p>
            </DemoSection>

            {/* User Feedback */}
            <DemoSection title="💬 User Feedback" description="Feedback widget">
              <button
                onClick={() => {
                  // The feedback widget is auto-injected, but we can manually trigger it
                  const feedbackButton = document.querySelector('[data-sentry-feedback]');
                  if (feedbackButton) {
                    (feedbackButton as HTMLElement).click();
                  }
                  log("💬 Feedback widget opened");
                }}
                className="demo-button"
              >
                Open Feedback Widget
              </button>
              <p className="text-xs text-gray-500 mt-2">
                Look for the feedback button in the bottom-right corner
              </p>
            </DemoSection>

            {/* Profiling */}
            <DemoSection title="🔥 Profiling" description="Performance profiling">
              <button
                onClick={async () => {
                  log("🔥 Starting profiled operation...");
                  // Profiling is automatic with transactions
                  await startSpan("demo.profiled.operation", async () => {
                    // Simulate CPU-intensive work
                    let sum = 0;
                    for (let i = 0; i < 1000000; i++) {
                      sum += Math.sqrt(i);
                    }
                    await new Promise((resolve) => setTimeout(resolve, 100));
                  });
                  log("✅ Profiled operation complete (check Profiling in Sentry)");
                }}
                className="demo-button"
              >
                Run Profiled Operation
              </button>
            </DemoSection>
          </div>
        </div>

        {/* Action Log */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
            📋 Action Log
          </h2>
          <div className="bg-gray-50 dark:bg-gray-900 rounded p-4 font-mono text-sm max-h-96 overflow-y-auto">
            {actionLog.length === 0 ? (
              <p className="text-gray-500">No actions yet. Try the buttons above!</p>
            ) : (
              actionLog.map((entry, i) => (
                <div key={i} className="text-gray-700 dark:text-gray-300 mb-1">
                  {entry}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DemoSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
        {title}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{description}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
