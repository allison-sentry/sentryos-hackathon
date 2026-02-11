export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

// For client-side, we need to import the client config in a client component
// This will be handled by Next.js automatically via the Sentry webpack plugin
