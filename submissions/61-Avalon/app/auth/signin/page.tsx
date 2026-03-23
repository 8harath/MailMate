'use client'

import { signIn } from 'next-auth/react'
import { Mail, Shield, Sparkles, Calendar, ArrowRight } from 'lucide-react'
import { Logo } from '@/components/logo'

const perks = [
  { icon: Mail, text: 'AI-powered email analysis & smart replies' },
  { icon: Calendar, text: 'Automatic meeting detection & calendar sync' },
  { icon: Sparkles, text: 'Task extraction, deadlines, and follow-ups' },
  { icon: Shield, text: 'You stay in control — AI never acts alone' },
]

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-gray-900 via-gray-900 to-indigo-950 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-16 py-12">
          <Logo size="lg" dark />
          <h2 className="text-4xl font-bold text-white mt-10 leading-tight">
            Your inbox,<br />
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              understood.
            </span>
          </h2>
          <p className="text-gray-400 mt-4 text-lg leading-relaxed max-w-md">
            Connect your Gmail and let AI handle the heavy lifting — analysis, replies, tasks, and scheduling.
          </p>
          <div className="mt-10 space-y-4">
            {perks.map(perk => (
              <div key={perk.text} className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center shrink-0">
                  <perk.icon className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-gray-300 text-sm">{perk.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — auth */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex justify-center mb-10">
            <Logo size="lg" />
          </div>

          <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8 sm:p-10">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900">Welcome to MailMate</h1>
              <p className="text-gray-500 mt-2">
                Connect your Google account to get started
              </p>
            </div>

            <button
              onClick={() => signIn('google', { callbackUrl: '/inbox' })}
              className="mt-8 w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 rounded-2xl px-5 py-4 text-base font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm hover:shadow-md group"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
            </button>

            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-xs text-gray-400 text-center leading-relaxed">
                MailMate will access your Gmail to read, analyze, and help you reply to emails.
                Calendar access enables automatic meeting scheduling.
                Your data stays private and is never shared.
              </p>
            </div>
          </div>

          <div className="mt-8 text-center">
            <a href="/inbox"
              className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-blue-600 transition-colors group">
              Skip and try demo mode
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
