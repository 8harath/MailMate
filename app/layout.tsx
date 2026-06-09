import type { Metadata } from 'next'
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SessionProvider } from '@/components/session-provider'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

// Display — an editorial serif with optical sizing for headings & the wordmark.
const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
  axes: ['opsz', 'SOFT', 'WONK'],
})

// UI / body — a warm, characterful grotesque (not Inter).
const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-hanken',
})

// Mono — keyboard hints, shortcuts and technical metadata.
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains',
})

export const metadata: Metadata = {
  title: 'MailMate - AI Email Assistant',
  description: 'MailMate: AI-powered email assistant with smart triage, automated action suggestions, and intelligent drafting',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
    shortcut: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${hanken.variable} ${fraunces.variable} ${jetbrains.variable}`}>
      <body className="font-sans antialiased">
        {/* Keyboard / screen-reader users land here first */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg"
        >
          Skip to content
        </a>
        <SessionProvider>
          {children}
        </SessionProvider>
        <Toaster position="bottom-right" />
        <Analytics />
      </body>
    </html>
  )
}
