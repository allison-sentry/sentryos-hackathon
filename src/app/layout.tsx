import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { logger, trackMetric } from "@/lib/sentry-utils";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SentryOS",
  description: "Sentry Desktop Environment Emulator",
  icons: {
    icon: "/sentryglyph.png",
    apple: "/sentryglyph.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Track app initialization
  if (typeof window !== 'undefined') {
    logger.info('SentryOS application initialized')
    trackMetric('app.init', 1)
  }

  return (
    <html lang="en" className="dark">
      <body className={`${jetbrainsMono.variable} antialiased font-mono`}>
        {children}
      </body>
    </html>
  );
}
