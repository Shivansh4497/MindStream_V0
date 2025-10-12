// pages/index.tsx
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'

declare global {
  interface Window {
    webkitSpeechRecognition?: any
    SpeechRecognition?: any
  }
}

type SummaryRow = {
  id: string
  user_id?: string
  summary_text: string
  rating?: number
  for_date?: string
  created_at?: string
}

// Small helper: showing toasts
function Toast({ text, kind = 'info' }: { text: string; kind?: 'info' | 'success' | 'error' }) {
  const bg =
    kind === 'success' ? 'bg-teal-600' : kind === 'error' ? 'bg-rose-600' : 'bg-slate-700'
  return (
    <div className={`text-white ${bg} px-3 py-2 rounded-md shadow-md text-sm`}>
      {text}
    </div>
  )
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
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [summaries, setSummaries] = useState<SummaryRow[]>([])
  const [isSavingRating, setIsSavingRating] = useState(false)
  const [toast, setToast] = useState<{ text: string; kind?: 'info' | 'success' | 'error' } | null>(null)

  // rating hover state for generated summary preview
  const [hoverRating, setHoverRating] = useState<number>(0)

  // Voice state
  const [isRecording, setIsRecording] = useState(false)
  const [isSupported, setIsSupported] = useState<boolean | null>(null)
  const [interim, setInterim] = useState('')
  const [finalText, setFinalText] = useState('')
  const recogRef = useRef<any>(null)
  const holdingRef = useRef(false)

  // layout refs
  const summariesRef = useRef<HTMLElement | null>(null)

  // ---------------- Toast util ----------------
  function showToast(text: string, kind: 'info' | 'success' | 'error' = 'info', ms = 2200) {
    setToast({ text, kind })
    window.setTimeout(() => setToast(null), ms)
  }

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
      .limit(200)
    if (!error) setEntries(data || [])
  }

  const saveTextEntry = async (text: string, source = 'text') => {
    const { data: u } = await supabase.auth.getUser()
    const uid = u?.user?.id
    if (!uid) {
      setStatus('Please sign in to save.')
      showToast('Please sign in to save an entry.', 'info')
      return
    }
    const { error } = await supabase.from('entries').insert([{ content: text, source, user_id: uid }])
    if (error) {
      setStatus('Save failed: ' + error.message)
      showToast('Save failed: ' + error.message, 'error')
      return
    }
    setStatus('Saved!')
    showToast('Saved entry', 'success')
    fetchEntries()
  }

  // ---------------- Summaries ----------------
  const fetchSummaries = async () => {
    const { data, error } = await supabase
      .from('summaries')
      .select('id, summary_text, created_at, rating, for_date')
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
        showToast('No entries in the past 24 hours', 'info')
        return
      }

      setStatus('Generating reflection — please wait...')
      const resp = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: entries24 })
      })
      const payload = await resp.json()
      if (!resp.ok) {
        setStatus('Summary generation failed: ' + (payload?.error || JSON.stringify(payload)))
        showToast('Couldn’t generate reflection right now.', 'error')
        return
      }

      setGeneratedSummary(payload.summary)
      setGeneratedAt(new Date().toISOString())
      setStatus('Reflection ready — rate or discard below.')
      showToast('Reflection ready', 'success', 1500)
    } catch (err: any) {
      console.error(err)
      setStatus('Failed: ' + (err?.message || String(err)))
      showToast('Couldn’t generate reflection right now : try again soon.', 'error', 3000)
    } finally {
      setIsGenerating(false)
    }
  }

  // Save the generated summary only after user rates it.
  async function saveRatedSummary(rating: number) {
    if (!generatedSummary) return
    try {
      setIsSavingRating(true)
      setStatus('Saving reflection...')
      const { data: u } = await supabase.auth.getUser()
      const uid = u?.user?.id
      if (!uid) {
        setStatus('Please sign in to save the summary.')
        showToast('Please sign in to save the reflection.', 'info')
        setIsSavingRating(false)
        return
      }
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const upto = new Date().toISOString()
      const todayIso = new Date().toISOString().slice(0, 10)

      // Insert & request the inserted row back
      const insertResp = await supabase
        .from('summaries')
        .insert([{
          user_id: uid,
          range_start: since,
          range_end: upto,
          for_date: todayIso,
          summary_text: generatedSummary,
          rating
        }])
        .select('*')
      const { data: inserted, error } = insertResp as any
      if (error) throw error
      const newRow = Array.isArray(inserted) && inserted.length ? inserted[0] : null
      if (newRow) {
        setSummaries((prev) => [newRow, ...prev])
      } else {
        fetchSummaries()
      }

      setStatus('Reflection saved!')
      showToast('Reflection saved — you captured another piece of your day.', 'success', 2600)
      setGeneratedSummary(null)
      setGeneratedAt(null)
      setHoverRating(0)

      // smooth scroll to summaries
      setTimeout(() => {
        const el = document.getElementById('your-summaries-section')
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 250)
    } catch (err: any) {
      console.error('saveRatedSummary error', err)
      const msg = err?.message || String(err) || 'Unknown error'
      setStatus('Could not save reflection: ' + msg)
      showToast('Could not save reflection: ' + msg, 'error', 3500)
    } finally {
      setIsSavingRating(false)
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
      showToast('Recognition error: ' + e.error, 'error')
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
      showToast('Mic error: ' + err.message, 'error')
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
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white p-8">
      {/* Toast container */}
      <div className="fixed top-6 right-6 z-50">
        {toast && <Toast text={toast.text} kind={toast.kind} />}
      </div>

      <main className="mx-auto w-full max-w-3xl">
        {/* Header */}
        <header className="mb-10">
          <h1 className="text-4xl font-bold text-indigo-900 leading-tight">Mindstream</h1>
          <p className="mt-2 text-sm text-slate-600">Your thoughts. Finally understood.</p>
        </header>

        {/* Privacy + Auth */}
        <div className="mb-6 rounded-lg border bg-white/60 p-4 shadow-sm flex items-center justify-between">
          <div className="text-sm text-slate-700">
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

        {/* Input row */}
        <div className="mb-8">
          <div className="flex gap-3 items-start">
            <input
              value={finalText}
              onChange={(e) => setFinalText(e.target.value)}
              className="flex-1 rounded-md border px-4 py-3 shadow-sm text-[15px] leading-relaxed"
              placeholder="What’s on your mind?"
            />
            <div className="flex flex-col gap-2">
              <button onClick={() => saveTextEntry(finalText)} className="rounded-md bg-indigo-700 text-white px-4 py-2">Save</button>
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                className={`rounded-md px-4 py-2 ${isRecording ? 'bg-teal-400 text-white' : 'bg-white border'}`}
                title="Hold to record"
              >
                {isRecording ? 'Recording…' : 'Hold to record'}
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-slate-500">Daily Reflection — 24-hour summary</div>
            <button
              onClick={generate24hSummary}
              disabled={isGenerating}
              className="rounded-md bg-indigo-600 text-white px-3 py-1 text-sm transition-all hover:scale-[1.02]"
            >
              {isGenerating ? 'Reflecting…' : 'Reflect on your day'}
            </button>
          </div>
          <div className="text-xs text-slate-500 mt-2">Generate a motivational reflection from your entries, then rate or discard.</div>
        </div>

        {/* Generated Summary Card */}
        {generatedSummary && (
          <div className="mb-8 rounded-lg border bg-gradient-to-b from-indigo-50/60 to-white p-4 shadow-md transition-opacity duration-300 ease-out animate-[fadein_250ms]">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold text-indigo-800">✨ Reflection generated {generatedAt ? `— ${new Date(generatedAt).toLocaleTimeString()}` : ''}</div>
                <div className="text-xs text-slate-500">Read it, then rate (1–5) to save — or discard it permanently.</div>
              </div>
              <button onClick={() => { setGeneratedSummary(null); setGeneratedAt(null); setStatus(null); }} className="text-xs text-slate-400 underline">Dismiss</button>
            </div>

            <div className="mt-3 p-4 rounded-md bg-white/80 text-slate-800 whitespace-pre-wrap leading-relaxed">
              <div dangerouslySetInnerHTML={{ __html: markDownLike(generatedSummary) }} />
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div className="text-sm text-slate-600">Rate this reflection (click a star to save):</div>

              <div className="flex items-center gap-2">
                {[1,2,3,4,5].map((n) => {
                  const filled = n <= hoverRating
                  return (
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
                      className={`text-2xl cursor-pointer select-none transition-transform ${filled ? 'text-yellow-500 scale-100' : 'text-slate-300'} ${isSavingRating ? 'opacity-50 pointer-events-none' : ''}`}
                      title={`${n} star`}
                    >
                      {filled ? '★' : '☆'}
                    </button>
                  )
                })}
              </div>

              <button
                onClick={() => { setGeneratedSummary(null); setGeneratedAt(null); setStatus('Reflection discarded.'); showToast('Reflection discarded', 'info') }}
                className="ml-auto px-3 py-1 border rounded-md text-sm text-slate-600 bg-white"
                disabled={isSavingRating}
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Entries (Today’s Thoughts) */}
        <section className="space-y-4 mb-12">
          <div className="text-sm text-slate-500">Your Reflections</div>
          <div className="rounded-lg bg-white p-4 border shadow-sm">
            {entries.length === 0 && <div className="text-slate-700">Your thoughts will appear here once you start speaking or typing.</div>}
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
        <section id="your-summaries-section" ref={summariesRef as any} className="space-y-4 mb-16">
          <div className="text-sm text-slate-500">Your Summaries</div>
          <div className="rounded-lg bg-white p-4 border shadow-sm">
            {summaries.length === 0 && <div className="text-slate-700">No summaries yet — generate one above.</div>}
            {summaries.length > 0 && (
              <ul className="space-y-3">
                {summaries.map((s: SummaryRow) => (
                  <li key={s.id} className="p-4 border rounded-md bg-white flex justify-between items-start">
                    <div className="flex-1 pr-4 leading-relaxed text-slate-800" dangerouslySetInnerHTML={{ __html: markDownLike(s.summary_text) }} />
                    <div className="text-lg text-yellow-500 mt-1">{renderStars(s.rating)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {status && <div className="mt-6 text-sm text-slate-600">{status}</div>}
        <footer className="mt-8 text-xs text-slate-400">Private • Encrypted • Yours</footer>
      </main>
    </div>
  )
}

// Helper: lightweight "markdown-like" conversion for bold lines like **Headline**
function markDownLike(text: string) {
  // convert **bold** into bold-ish HTML with a subtle indigo color for headers
  let out = text
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#3b82f6">$1</strong>')
    .replace(/\n\n/g, '<br/><br/>')
  // ensure safe fallback (we assume content is generated by AI or user; keep simple)
  return out
}

// helper to render saved ratings
function renderStars(r: number | null | undefined) {
  const rating = Math.max(0, Math.min(5, Number(r || 0)))
  let out = ''
  for (let i=1;i<=5;i++) out += i <= rating ? '★' : '☆'
  return out
}
