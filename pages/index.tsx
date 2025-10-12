import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type Entry = {
  id: string
  content: string
  source: string
  created_at: string
  user_id: string | null
}

export default function Home() {
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [loading, setLoading] = useState(false)

  // auth
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [emailForOtp, setEmailForOtp] = useState('')

  // fetch current session user
  const loadUser = async () => {
    try {
      const { data } = await supabase.auth.getUser()
      if (data?.user) {
        setUser({ id: data.user.id, email: data.user.email ?? undefined })
      } else {
        setUser(null)
      }
    } catch (e) {
      console.error('getUser error', e)
      setUser(null)
    }
  }

  useEffect(() => {
    loadUser()
    // listen to auth changes (sign in / sign out)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? undefined })
      } else {
        setUser(null)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const sendMagicLink = async () => {
    if (!emailForOtp || !emailForOtp.includes('@')) {
      setStatus('Enter a valid email for magic link.')
      return
    }
    setStatus('Sending magic link...')
    const { error } = await supabase.auth.signInWithOtp({ email: emailForOtp })
    if (error) {
      console.error('magic link error', error)
      setStatus(`Error sending link: ${error.message}`)
    } else {
      setStatus('Magic link sent — check your inbox.')
    }
  }

  // replace your signInWithGoogle function with this
  const signInWithGoogle = async () => {
    setStatus('Redirecting to Google...')
    const redirectTo = window.location.origin // ensures return to the current site (local or deployed)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    })
    if (error) {
      console.error('Google sign-in error', error)
      setStatus(`Error starting Google sign-in: ${error.message}`)
    }
  }


  const signOut = async () => {
    setStatus('Signing out...')
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Sign out error', error)
      setStatus(`Error signing out: ${error.message}`)
    } else {
      setUser(null)
      setStatus(null)
    }
  }

  // fetch entries from server API (admin / public read)
  const fetchEntries = async () => {
    setLoading(true)
    try {
      const resp = await fetch('/api/entries')
      const payload = await resp.json()
      if (!resp.ok) {
        console.error('Fetch entries error:', payload)
        setStatus(`Error loading entries: ${payload?.error || 'unknown'}`)
        setEntries([])
      } else {
        setEntries(payload.data || [])
        setStatus(null)
      }
    } catch (e: any) {
      console.error('Network error fetching entries:', e)
      setStatus(`Error loading entries: ${e?.message || String(e)}`)
      setEntries([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEntries()
  }, [])

  // save entry:
  // - if signed in -> use client insert with user_id so RLS accepts it
  // - else -> fallback to server API route (service_role writes)
  const saveEntry = async () => {
    if (!input.trim()) return
    setStatus('Saving...')

    // get current user
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user

    if (!user) {
      setStatus('Please sign in (Google or magic link) to save your thought.')
      return
    }

    try {
      const { data, error } = await supabase
        .from('entries')
        .insert([{ content: input, source: 'text', user_id: user.id }])
        .select()

      if (error) {
        console.error('Client insert error:', error)
        setStatus(`Error saving entry: ${error.message}`)
        return
      }

      setInput('')
      setStatus('Saved successfully!')
      fetchEntries()
    } catch (e: any) {
      console.error('Client network error saving entry:', e)
      setStatus(`Error saving entry: ${e?.message || String(e)}`)
    }
  }


  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-start justify-center p-8">
      <div className="w-full max-w-2xl">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold text-indigo-900">Mindstream</h1>
          <p className="text-sm text-slate-600">Your thoughts. Finally understood.</p>
        </header>

        <div className="mb-4 p-4 rounded-lg border border-slate-100 bg-white shadow-sm flex items-center justify-between">
          <div>
            <strong>Privacy:</strong> Your thoughts are encrypted and private.
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="text-sm text-slate-700">Signed in: {user.email ?? user.id.slice(0,8)}</div>
                <button onClick={signOut} className="text-sm underline">Sign out</button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  value={emailForOtp}
                  onChange={(e) => setEmailForOtp(e.target.value)}
                  placeholder="you@example.com"
                  className="rounded-md border px-2 py-1 text-sm"
                />
                <button onClick={sendMagicLink} className="rounded-md bg-indigo-600 text-white px-3 py-1 text-sm">Magic link</button>
                <button onClick={signInWithGoogle} className="rounded-md border px-3 py-1 text-sm">Sign in with Google</button>
              </div>
            )}
          </div>
        </div>

        <div className="mb-6">
          <label className="sr-only">New thought</label>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
              placeholder="What’s on your mind?"
            />
            <button
              onClick={saveEntry}
              className="rounded-md bg-indigo-700 text-white px-4 py-2"
            >
              Save
            </button>
          </div>
          {status && <p className="mt-2 text-sm text-slate-600">{status}</p>}
        </div>

        <section className="space-y-4">
          <div className="text-sm text-slate-500">Today — Auto summary (10 PM)</div>

          <div className="rounded-lg bg-white p-4 border shadow-sm">
            {loading && <div className="text-slate-500">Loading entries...</div>}

            {!loading && entries && entries.length === 0 && (
              <div className="text-slate-700">No entries yet — your thoughts will appear here once you start typing.</div>
            )}

            {!loading && entries && entries.length > 0 && (
              <ul className="space-y-3">
                {entries.map((e) => (
                  <li key={e.id} className="p-3 border rounded-md bg-white">
                    <div className="text-slate-800">{e.content}</div>
                    <div className="mt-2 text-xs text-slate-400">
                      {new Date(e.created_at).toLocaleString()}
                      {e.user_id ? ` • user: ${e.user_id.slice(0,8)}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
