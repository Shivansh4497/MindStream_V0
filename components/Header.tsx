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
  streakCount
}: HeaderProps) {
  return (
    <header className="mb-10">
      {/* App title and tagline */}
      <h1 className="text-4xl font-bold text-indigo-900 leading-tight">Mindstream</h1>
      <p className="mt-2 text-sm text-slate-600">Your thoughts. Finally understood.</p>

      {/* Privacy note and auth area */}
      <div className="mt-4 rounded-lg border bg-white/60 p-4 shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-slate-700 flex-1">
          <strong>Privacy:</strong> Voice is processed by your browser’s speech service; audio isn’t stored.
        </div>

        <div className="flex items-center gap-3">
          {streakCount && streakCount > 0 && (
            <div
              className="px-2 py-1 rounded-full bg-teal-100 text-teal-700 text-xs font-medium"
              title="Number of consecutive days you’ve saved a reflection"
            >
              🔥 {streakCount}-day streak
            </div>
          )}

          {user ? (
            <>
              <div className="text-sm text-slate-700">{user.email ?? user.id.slice(0, 8)}</div>
              <button onClick={signOut} className="text-sm underline">
                Sign out
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="rounded-md border px-2 py-1 text-sm"
              />
              <button
                onClick={sendMagicLink}
                className="rounded-md bg-indigo-600 text-white px-3 py-1 text-sm"
              >
                Magic link
              </button>
              <button
                onClick={signInWithGoogle}
                className="rounded-md border px-3 py-1 text-sm"
              >
                Google
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
