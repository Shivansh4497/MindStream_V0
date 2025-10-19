// components/Header.tsx
import React from 'react'

type HeaderProps = {
  user: { id: string; email?: string } | null
  signOut: () => Promise<void>
  signInWithGoogle: () => Promise<void>
  streakCount?: number
}

export default function Header({ user, signOut, signInWithGoogle, streakCount = 0 }: HeaderProps) {
  // derive avatar initial (safe)
  const avatarLabel = user?.email ? user.email.trim()[0].toUpperCase() : '?'
  const emailTooltip = user?.email ?? 'Not signed in'

  return (
    <header className="mx-auto max-w-3xl px-2">
      <div className="flex items-start gap-6">
        <div className="flex-1">
          <h1 className="text-4xl font-extrabold text-gradient-teal-indigo leading-tight">Mindstream</h1>
          <p className="mt-2 text-slate-500">Your thoughts. Finally understood.</p>
        </div>

        {/* Right capsule: streak + avatar + auth button */}
        <div
          className="flex items-center gap-4 rounded-full px-3 py-1.5 shadow-lg border border-white/40 bg-white/70 backdrop-blur-sm"
          style={{ minWidth: 300 }}
        >
          <div className="flex items-center gap-3">
            {/* Streak badge */}
            <div
              aria-hidden
              className="w-9 h-9 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 font-semibold"
              title={`${streakCount} day streak`}
            >
              {streakCount}
            </div>

            {/* Avatar initial with tooltip (shows full email on hover / focus) */}
            <div className="relative">
              <div
                className="avatar-initial"
                title={emailTooltip}
                role="img"
                aria-label={user?.email ? `Signed in as ${user.email}` : 'Not signed in'}
              >
                <span className="select-none">{avatarLabel}</span>
              </div>
            </div>
          </div>

          {/* spacer */}
          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <button
                onClick={signOut}
                className="px-3 py-1 rounded-md border text-sm hover:bg-slate-50"
                aria-label="Sign out"
              >
                Sign out
              </button>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="px-3 py-1 rounded-md bg-gradient-teal-indigo text-white text-sm shadow-sm hover:opacity-95"
                aria-label="Sign in with Google"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
