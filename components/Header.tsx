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
  streakCount = 0
}: HeaderProps) {
  return (
    <header className="mb-8">
      {/* Grid with two columns: left = title, right = tray */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-4 items-center">
        {/* LEFT: Title + tagline */}
        <div className="min-w-0">
          <h1 className="text-3xl md:text-4xl font-bold text-indigo-900 leading-tight">Mindstream</h1>
          <p className="mt-2 text-sm text-slate-600 max-w-[36ch]">Your thoughts. Finally understood.</p>
        </div>

        {/* RIGHT: Tray with Privacy / Streak / Auth */}
        <div className="flex items-center justify-end gap-3 flex-wrap">
          {/* Privacy card */}
          <div className="flex-shrink-0 min-w-[220px]">
            <div className="rounded-xl border bg-white/60 p-3 shadow-sm">
              <div className="text-sm text-slate-700">
                <strong>Privacy:</strong> Voice is processed by your browser’s speech service; audio isn’t stored.
              </div>
            </div>
          </div>

          {/* Streak circle */}
          <div className="flex-shrink-0">
            <div
              role="status"
              aria-label={streakCount ? `${streakCount}-day streak` : 'No streak yet'}
              className="flex items-center justify-center w-14 h-14 rounded-full border-2 border-teal-200 bg-white shadow-sm"
              title={streakCount ? `${streakCount}-day streak` : 'No streak yet'}
            >
              <div className="text-center">
                <div className="text-xs text-slate-500 leading-tight">Streak</div>
                <div className="text-lg font-extrabold text-teal-600 leading-none">{streakCount}</div>
              </div>
            </div>
          </div>

          {/* Auth card */}
          <div className="flex-shrink-0 min-w-[180px]">
            <div className="rounded-xl border bg-white/60 p-2 shadow-sm flex items-center justify-center">
              {user ? (
                <div className="flex items-center gap-3 px-2">
                  <div className="text-sm text-slate-700 truncate max-w-[140px]" title={user.email}>
                    {user.email}
                  </div>

                  <button
                    onClick={signOut}
                    aria-label="Sign out"
                    title="Sign out"
                    className="p-2 rounded-md hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-200"
                  >
                    <svg className="w-5 h-5 text-slate-700" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8v8" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-2">
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="hidden md:inline-block rounded-md border px-2 py-1 text-xs"
                    aria-label="email for magic link"
                  />
                  <button
                    onClick={signInWithGoogle}
                    className="flex items-center gap-2 rounded-md bg-white border px-3 py-1 text-sm shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    aria-label="Sign in with Google"
                    title="Sign in with Google"
                  >
                    <svg width="18" height="18" viewBox="0 0 533.5 544.3" className="inline-block" aria-hidden>
                      <path fill="#4285f4" d="M533.5 278.4c0-17.4-1.6-34.2-4.6-50.6H272v95.8h147.1c-6.4 34.6-25.6 63.8-54.6 82.5v68.5h88.2c51.6-47.5 81.8-117.6 81.8-196.2z"/>
                      <path fill="#34a853" d="M272 544.3c73.6 0 135.4-24.3 180.6-66.1l-88.2-68.5c-24.6 16.5-56 26.2-92.4 26.2-71.1 0-131.4-48-153.1-112.3H29.8v70.8C75.6 482.7 168.8 544.3 272 544.3z"/>
                      <path fill="#fbbc04" d="M118.9 327.6c-10.9-32.8-10.9-68.2 0-101l-89-70.8C-5.1 188.8-5.1 355.5 29.8 473.5l89.1-70.8z"/>
                      <path fill="#ea4335" d="M272 107.5c39.9 0 75.6 13.7 103.8 40.5l77.9-77.9C405.8 24.3 344 0 272 0 168.8 0 75.6 61.6 29.8 153.1l89 70.8C140.6 155.5 200.9 107.5 272 107.5z"/>
                    </svg>
                    <span className="text-sm text-slate-700 hidden sm:inline">Google</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
