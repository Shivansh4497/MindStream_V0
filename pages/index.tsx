// pages/index.tsx
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'

declare global {
  interface Window {
    webkitSpeechRecognition?: any
    SpeechRecognition?: any
  }
}

export default function Home() {
  // Auth & UI state
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  // Entries
  const [entries, setEntries] = useState<any[]>([])

  // Summaries
  const [generatedSummary, setGeneratedSummary] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [summaries, setSummaries] = useState<any[]>([])
  // rating hover state for the generated summary preview
  const [hoverRating, setHoverRating] = useState<number>(0)

  // Voice state
  const [isRecording, setIsRecording] = useState(false)
  const [isSupported, setIsSupported] = useState<boolean | null>(null)
  const [interim, setInterim] = useState('')
  const [finalText, setFinalText] = useState('')
  const recogRef = useRef<any>(null)
  const safetyTimeoutRef = useRef<number | null>(null)
  const holdingRef = useRef(false)

  // Load auth + data
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser()
      if (data?.user) setUser({ id: data.user.id, email: data.user.email ?? undefined })
      fetchEntries()
      fetchSummaries()
    }
    load()
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) setUser({ id: session.user.id, email: session.user.email ?? undefined })
      else setUser(null)
      fetchEntries()
      fetchSummaries()
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // ---------------- Auth ----------------
  const signInWithGoogle = async () => {
    setStatus('Redirecting to Google...')
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
  }

  const sendMagicLink = async () => {
    if (!email.includes('@')) return setStatus('Enter a valid email.')
    setStatus('Sending magic link...')
    const { error } = await supabase.auth.signInWithOtp({ email })
    setStatus(error ? error.message : 'Magic link sent — check your inbox.')
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setEntries([])
    setSummaries([])
    setStatus(null)
  }

  // ---------------- Entries ----------------
  const fetchEntries = async () => {
    const { data, error } = await supabase
      .from('entries')
      .select('id, content, source, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
    if (!error) setEntries(data || [])
  }

  const saveTextEntry = async (text: string, source = 'text') => {
    const { data: u } = await supabase.auth.getUser()
    const uid = u?.user?.id
    if (!uid) return setStatus('Please sign in to save.')
    const { error } = await supabase.from('entries').insert([{ content: text, source, user_id: uid }])
    if (error) return setStatus('Save failed: ' + error.message)
    setStatus('Saved!')
    fetchEntries()
  }

  // ---------------- Summaries ----------------
  const fetchSummaries = async () => {
    const { data, error } = await supabase
      .from('summaries')
      .select('id, summary_text, created_at, rating, range_start, range_end')
      .order('created_at', { ascending: false })
    if (!error) setSummaries(data || [])
  }

  async function generate24hSummary() {
    try {
      setIsGenerating(true)
      setStatus('Loading recent entries...')
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data: entries24, error } = await supabase
        .from('entries')
        .select('id, content, created_at, source')
        .gte('created_at', since)
        .order('created_at', { ascending: true })

      if (error) throw error
      if (!entries24?.length) {
        setStatus('No entries in the past 24 hours.')
        return
      }

      setStatus('Generating summary — please wait...')
      const resp = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: entries24 })
      })
      const payload = await resp.json()
      if (!resp.ok) {
        setStatus('Summary generation failed: ' + (payload?.error || JSON.stringify(payload)))
        return
      }

      setGeneratedSummary(payload.summary)
      setHoverRating(0)
      setStatus('Summary ready — rate or discard below.')
    } catch (err: any) {
      console.error(err)
      setStatus('Failed: ' + (err?.message || String(err)))
    } finally {
      setIsGenerating(false)
    }
  }

  // Save the generated summary only after user rates it
  async function saveRatedSummary(rating: number) {
    if (!generatedSummary) return
    try {
      const { data: u } = await supabase.auth.getUser()
      const uid = u?.user?.id
      if (!uid) throw new Error('Not signed in')
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const upto = new Date().toISOString()
      const { error } = await supabase.from('summaries').insert([{
        user_id: uid,
        range_start: since,
        range_end: upto,
        summary_text: generatedSummary,
        rating
      }])
      if (error) throw error
      setStatus('Summary saved!')
      setGeneratedSummary(null)
      setHoverRating(0)
      fetchSummaries()
    } catch (err: any) {
      setStatus('Save failed: ' + (err?.message || String(err)))
    }
  }

  // ---------------- Voice Recognition ----------------
  useEffect(() => {
    const Recog = window.SpeechRecognition || window.webkitSpeechRecognition || null
    if (!Recog) { setIsSupported(false); return }
    setIsSupported(true)
    const r = new Recog()
    r.lang = 'en-US'
    r.interimResults = true
    r.maxAlternatives = 1
    r.continuous = false
    recogRef.current = r

    r.onresult = (event: any) => {
      let interimT = ''
      let finalT = ''
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const res = event.results[i]
        if (res.isFinal) finalT += res[0].transcript
        else interimT += res[0].transcript
      }
      if (interimT) setInterim(interimT)
      if (finalT) {
        setFinalText((s) => (s ? s + ' ' + finalT : finalT))
        setInterim('')
      }
    }

    r.onerror = (e: any) => {
      console.error('SpeechRecognition error', e)
      setStatus('Recognition error: ' + e.error)
      setIsRecording(false)
    }

    r.onend = () => {
      if (holdingRef.current) {
        setTimeout(() => { try { recogRef.current?.start() } catch {} }, 150)
      } else setIsRecording(false)
    }

    return () => { recogRef.current = null }
  }, [])

  const startRecording = () => {
    if (!recogRef.current) return setStatus('Voice not supported in this browser.')
    try {
      holdingRef.current = true
      recogRef.current.start()
      setIsRecording(true)
      setInterim('')
      setFinalText('')
      setStatus('Recording...')
    } catch (err: any) {
      setStatus('Mic error: ' + err.message)
    }
  }

  const stopRecording = async () => {
    holdingRef.current = false
    try { recogRef.current?.stop() } catch {}
    setIsRecording(false)
    const text = (finalText + (interim ? ' ' + interim : '')).trim()
    setInterim('')
    setFinalText('')
    if (!text) return setStatus('No speech captured.')
    await saveTextEntry(text, 'voice')
    setStatus('Saved voice entry.')
  }

  // ---------------- UI ----------------
  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex justify-center p-8">
      <div className="w-full max-w-2xl">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold text-indigo-900">Mindstream</h1>
          <p className="text-sm text-slate-600">Your thoughts. Finally understood.</p>
        </header>

        <div className="mb-4 p-4 rounded-lg border bg-white shadow-sm flex items-center justify-between">
          <div>
            <strong>Privacy:</strong> Voice is processed by your browser’s speech service; audio isn’t stored.
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="text-sm text-slate-700">{user.email ?? user.id.slice(0, 8)}</div>
                <button onClick={signOut} className="text-sm underline">Sign out</button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="rounded-md border px-2 py-1 text-sm" />
                <button onClick={sendMagicLink} className="rounded-md bg-indigo-600 text-white px-3 py-1 text-sm">Magic link</button>
                <button onClick={signInWithGoogle} className="rounded-md border px-3 py-1 text-sm">Google</button>
              </div>
            )}
          </div>
        </div>

        {/* Text + Generate Summary */}
        <div className="mb-6">
          <div className="flex gap-2 mb-3">
            <input value={finalText} onChange={(e) => setFinalText(e.target.value)} className="flex-1 rounded-md border px-3 py-2 shadow-sm" placeholder="What’s on your mind?" />
            <button onClick={() => saveTextEntry(finalText)} className="rounded-md bg-indigo-700 text-white px-4 py-2">Save</button>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500">Daily Reflection — 24-hour summary</div>
            <button onClick={generate24hSummary} disabled={isGenerating} className="rounded-md bg-indigo-600 text-white px-3 py-1 text-sm">
              {isGenerating ? 'Generating...' : 'Generate Summary'}
            </button>
          </div>
          <div className="text-xs text-slate-500 mt-2">Generate a motivational daily summary from your entries, then rate or discard it.</div>
        </div>

        {/* Generated Summary Card */}
        {generatedSummary && (
          <div className="mb-6 rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold">Generated 24-hour summary</div>
                <div className="text-xs text-slate-500">Read it, then rate it (1–5) to save or discard it permanently.</div>
              </div>
              <button onClick={() => { setGeneratedSummary(null); setStatus(null); setHoverRating(0) }} className="text-xs text-slate-400 underline">Dismiss</button>
            </div>

            <div className="mt-3 p-3 rounded-md bg-slate-50 text-slate-800 whitespace-pre-wrap">{generatedSummary}</div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="text-sm text-slate-600">Rate this summary:</div>
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map((n) => (
                  <button
                    key={n}
                    onClick={() => saveRatedSummary(n)}
                    onMouseEnter={() => setHoverRating(n)}
                    onMouseLeave={() => setHoverRating(0)}
                    onFocus={() => setHoverRating(n)}
                    onBlur={() => setHoverRating(0)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        saveRatedSummary(n)
                      }
                    }}
                    aria-label={`Rate ${n} star`}
                    className="text-2xl cursor-pointer select-none"
                    title={`${n} star`}
                  >
                    {n <= hoverRating ? '★' : '☆'}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { setGeneratedSummary(null); setStatus('Summary discarded.'); setHoverRating(0) }}
                className="ml-auto px-3 py-1 border rounded-md text-sm text-slate-600 bg-white"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Entries */}
        <section className="space-y-4 mb-8">
          <div className="text-sm text-slate-500">Your Reflections</div>
          <div className="rounded-lg bg-white p-4 border shadow-sm">
            {entries.length === 0 && <div className="text-slate-700">No entries yet.</div>}
            {entries.length > 0 && (
              <ul className="space-y-3">
                {entries.map((e) => (
                  <li key={e.id} className="p-3 border rounded-md bg-white">
                    <div className="text-slate-800 whitespace-pre-wrap">{e.content}</div>
                    <div className="mt-2 text-xs text-slate-400">{new Date(e.created_at).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Summaries */}
        <section className="space-y-4">
          <div className="text-sm text-slate-500">Your Summaries</div>
          <div className="rounded-lg bg-white p-4 border shadow-sm">
            {summaries.length === 0 && <div className="text-slate-700">No summaries yet — generate one above.</div>}
            {summaries.length > 0 && (
              <ul className="space-y-3">
                {summaries.map((s: any) => (
                  <li key={s.id} className="p-3 border rounded-md bg-white flex justify-between items-start">
                    <div className="flex-1 pr-4">
                      <div className="text-slate-800 whitespace-pre-wrap">{s.summary_text}</div>
                      <div className="mt-2 text-xs text-slate-400">{new Date(s.created_at).toLocaleString()}</div>
                    </div>
                    <div className="text-lg text-yellow-500">{renderStars(s.rating)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {status && <div className="mt-6 text-sm text-slate-600">{status}</div>}
      </div>
    </main>
  )
}

// helper to render saved ratings
function renderStars(r: number | null | undefined) {
  const rating = Math.max(0, Math.min(5, Number(r || 0)))
  let out = ''
  for (let i=1;i<=5;i++) out += i <= rating ? '★' : '☆'
  return out
}
