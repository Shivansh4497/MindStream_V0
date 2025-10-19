// components/Header.tsx
import React from 'react'

type HeaderProps = {
  user: { id: string; email?: string } | null
  signOut: () => Promise<void>
  signInWithGoogle: () => Promise<void>
  streakCount: number
}

export default function Header({ user, signOut, signInWithGoogle, streakCount }: HeaderProps) {
  return (
    <header className="mx-auto max-w-3xl px-2">
      <div className="flex items-start gap-6">
        <div className="flex-1">
          <h1 className="text-4xl font-bold text-gradient-teal-indigo leading-tight">Mindstream</h1>
          <p className="mt-2 text-slate-500">Your thoughts. Finally understood.</p>

          {/* subtle privacy subtext */}
          <div className="mt-3 text-xs text-slate-400">🔒 Voice stays in your browser — audio isn't stored.</div>
        </div>

        {/* capsule aligned to same max width container (streak + email + logout) */}
        <div className="flex items-center bg-white/70 rounded-full px-3 py-1.5 shadow-lg border border-white/40 backdrop-blur-sm" style={{ minWidth: 340 }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 font-semibold ms-streak-badge">
              {streakCount}
            </div>
            <div className="text-sm text-slate-700 truncate max-w-[220px]">{user?.email ?? 'Not signed in'}</div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <button onClick={signOut} className="px-3 py-1 rounded-md border text-sm hover:bg-slate-50">Sign out</button>
            ) : (
              <button onClick={signInWithGoogle} className="px-3 py-1 rounded-md bg-gradient-teal-indigo text-white text-sm shadow-sm hover:opacity-95">Sign in</button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
