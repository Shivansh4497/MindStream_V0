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
          <h1 className="text-4xl font-bold text-indigo-700 leading-tight">Mindstream</h1>
          <p className="mt-2 text-slate-500">Your thoughts. Finally understood.</p>

          {/* subtle privacy subtext */}
          <div className="mt-3 text-xs text-slate-400">🔒 Voice stays in your browser — audio isn't stored.</div>
        </div>

        {/* capsule aligned to same max width container (streak + email + logout) */}
        <div className="flex items-center bg-white rounded-full px-4 py-2 shadow-lg border" style={{ minWidth: 340 }}>
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 font-semibold">
              {streakCount}
            </div>
            <div className="text-sm text-slate-700">{user?.email ?? 'Not signed in'}</div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <button onClick={signOut} className="px-3 py-1 rounded-md border text-sm">Sign out</button>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={signInWithGoogle} className="px-3 py-1 rounded-md bg-indigo-600 text-white text-sm">Sign in</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
