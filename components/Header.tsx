// components/Header.tsx
import React from 'react'

interface HeaderProps {
  user: { id: string; email?: string } | null
  email: string
  setEmail: (s: string) => void
  signOut: () => Promise<void>
  sendMagicLink: () => Promise<void>
  signInWithGoogle: () => Promise<void>
  streakCount?: number
}

export default function Header({
  user,
  email,
  setEmail,
  signOut,
  sendMagicLink,
  signInWithGoogle,
  streakCount = 0,
}: HeaderProps) {
  // helper: extract initial (A, B, C) for avatar
  const initial = user?.email ? user.email.trim()[0].toUpperCase() : ''

  return (
    <header className="mb-12">
      <div className="grid grid-cols-1 md:grid-cols-[360px_1fr] gap-6 items-start">
        {/* LEFT: App title */}
        <div>
          <h1 className="text-4xl font-bold text-indigo-900 leading-tight tracking-tight">
            Mindstream
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-[34ch]">
            Your thoughts. Finally understood.
          </p>
        </div>

        {/* RIGHT: unified glass tray */}
        <div className="flex justify-end">
          <div className="flex items-center gap-4 rounded-2xl backdrop-blur-md bg-white/40 border border-white/30 shadow-sm px-5 py-3 flex-wrap">
            {/* Privacy segment */}
            <div className="text-sm text-slate-700 flex items-center gap-2 border-r border-slate-200 pr-4">
              <svg
                className="w-4 h-4 text-slate-500"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0-1.1.9-2 2-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2h4" />
              </svg>
              <span className="max-w-[240px] leading-snug">
                <strong>Privacy:</strong> Voice stays in your browser; audio isn’t stored.
              </span>
            </div>

            {/* Streak segment */}
            <div
              role="status"
              aria-label={streakCount ? `${streakCount}-day streak` : 'No streak yet'}
              title={streakCount ? `${streakCount}-day streak` : 'No streak yet'}
              className="flex items-center justify-center w-16 h-16 rounded-full border-2 border-teal-200 bg-white/70 shadow-inner text-center"
            >
              <div>
                <div className="text-[11px] text-slate-500 uppercase tracking-wide">
                  Streak
                </div>
                <div className="text-xl font-extrabold text-teal-600 leading-none">
                  {streakCount}
                </div>
              </div>
            </div>

            {/* Auth segment: show initial circle avatar for privacy */}
            <div className="pl-4 border-l border-slate-200 flex items-center gap-3">
              {user ? (
                <>
                  <div
                    className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-semibold"
                    title={user.email}
                    aria-hidden={false}
                  >
                    {initial || 'U'}
                  </div>
                  <button
                    onClick={signOut}
                    aria-label="Sign out"
                    title="Sign out"
                    className="p-2 rounded-md hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-200"
                  >
                    <svg className="w-5 h-5 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8v8" />
                    </svg>
                  </button>
                </>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="flex items-center gap-2 rounded-md bg-white/80 border px-3 py-1 text-sm shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  aria-label="Sign in with Google"
                  title="Sign in with Google"
                >
                  {/* Google SVG */}
                  <svg width="18" height="18" viewBox="0 0 533.5 544.3" className="inline-block" aria-hidden>
                    <path fill="#4285f4" d="M533.5 278.4c0-17.4-1.6-34.2-4.6-50.6H272v95.8h147.1c-6.4 34.6-25.6 63.8-54.6 82.5v68.5h88.2c51.6-47.5 81.8-117.6 81.8-196.2z" />
                    <path fill="#34a853" d="M272 544.3c73.6 0 135.4-24.3 180.6-66.1l-88.2-68.5c-24.6 16.5-56 26.2-92.4 26.2-71.1 0-131.4-48-153.1-112.3H29.8v70.8C75.6 482.7 168.8 544.3 272 544.3z" />
                    <path fill="#fbbc04" d="M118.9 327.6c-10.9-32.8-10.9-68.2 0-101l-89-70.8C-5.1 188.8-5.1 355.5 29.8 473.5l89.1-70.8z" />
                    <path fill="#ea4335" d="M272 107.5c39.9 0 75.6 13.7 103.8 40.5l77.9-77.9C405.8 24.3 344 0 272 0 168.8 0 75.6 61.6 29.8 153.1l89 70.8C140.6 155.5 200.9 107.5 272 107.5z" />
                  </svg>
                  <span className="text-sm text-slate-700 hidden sm:inline">Google</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
