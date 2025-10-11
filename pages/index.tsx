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
    // optional: poll every 20s during dev
    // const id = setInterval(fetchEntries, 20000)
    // return () => clearInterval(id)
  }, [])

  const saveEntry = async () => {
    if (!input.trim()) return
    setStatus('Saving...')

    try {
      const resp = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: input, source: 'text' })
      })
      const payload = await resp.json()
      if (!resp.ok) {
        console.error('Server insert error:', payload)
        setStatus(`Error saving entry: ${payload?.error || 'unknown error'}`)
        return
      }
      console.log('Server saved:', payload)
      setInput('')
      setStatus('Saved successfully!')
      fetchEntries() // refresh the stream immediately
    } catch (e: any) {
      console.error('Network error saving entry:', e)
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

        <div className="mb-4 p-4 rounded-lg border border-slate-100 bg-white shadow-sm">
          <strong>Privacy:</strong> Your thoughts are encrypted and private.
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
