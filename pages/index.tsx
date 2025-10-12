// pages/index.tsx
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

declare global {
  interface Window {
    webkitSpeechRecognition?: any
    SpeechRecognition?: any
  }
}

type EntryRow = {
  id: string
  content: string
  source?: string
  created_at?: string
}

type SummaryRow = {
  id: string
  user_id?: string
  summary_text: string
  rating?: number
  for_date?: string
  created_at?: string
  range_start?: string
  range_end?: string
}

// ----------------------- small UI helpers -----------------------
function Toast({ text, kind = 'info' }: { text: string; kind?: 'info' | 'success' | 'error' }) {
  const bg = kind === 'success' ? 'bg-teal-600' : kind === 'error' ? 'bg-rose-600' : 'bg-slate-700'
  return <div className={`text-white ${bg} px-3 py-2 rounded-md shadow-md text-sm`}>{text}</div>
}

function renderStarsInline(r?: number | null) {
  const rating = Math.max(0, Math.min(5, Number(r || 0)))
  return (
    <span title={`${rating} / 5`} aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (i < rating ? '★' : '☆')).join('')}
    </span>
  )
}

function previewText(s = '', max = 220) {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + '…'
}

function markDownLike(text = '') {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#2563eb">$1</strong>').replace(/\n\n/g, '<br/><br/>')
}

function formatDateForGroup(s?: string) {
  if (!s) return 'Unknown'
  const d = new Date(s)
  const today = new Date()
  if (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  ) {
    return 'Today'
  }
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) {
    return 'Yesterday'
  }
  return d.toLocaleDateString()
}

// ----------------------- main component -----------------------
export default function Home() {
  // auth
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [toast, setToast] = useState<{ text: string; kind?: 'info' | 'success' | 'error' } | null>(null)

  // entries & summaries
  const [entries, setEntries] = useState<EntryRow[]>([])
  const [summaries, setSummaries] = useState<SummaryRow[]>([])
  const [generatedSummary, setGeneratedSummary] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSavingRating, setIsSavingRating] = useState(false)

  // recording
  const [isRecording, setIsRecording] = useState(false)
  const [interim, setInterim] = useState('')
  const [finalText, setFinalText] = useState('')
  const recogRef = useRef<any>(null)
  const holdingRef = useRef(false)

  // UI states
  const [hoverRating, setHoverRating] = useState<number>(0)

  // expansion: persist to localStorage
  const [expandedSummaryId, setExpandedSummaryId] = useState<string | null>(() => {
    try {
      if (typeof window !== 'undefined') return localStorage.getItem('expandedSummaryId')
    } catch {}
    return null
  })
  useEffect(() => {
    try {
      if (expandedSummaryId) localStorage.setItem('expandedSummaryId', expandedSummaryId)
      else localStorage.removeItem('expandedSummaryId')
    } catch {}
  }, [expandedSummaryId])

  // highlight for newly inserted item
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null)

  // keyboard focus refs for accessibility (optional)
  const summariesRef = useRef<HTMLDivElement | null>(null)

  // ---------------- toast util ----------------
  function showToast(text: string, kind: 'info' | 'success' | 'error' = 'info', ms = 2200) {
    setToast({ text, kind })
    window.setTimeout(() => setToast(null), ms)
  }

  // ---------------- auth + load ----------------
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser()
      if (data?.user) setUser({ id: data.user.id, email: data.user.email ?? undefined })
      await fetchEntries()
      await fetchSummaries()
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

  // ---------------- auth actions ----------------
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
    showToast('Signed out', 'info')
  }

  // ---------------- entries ----------------
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
    if (!text || text.trim().length === 0) {
      setStatus('Cannot save empty entry.')
      showToast('Cannot save empty entry.', 'info')
      return
    }
    const { error } = await supabase.from('entries').insert([{ content: text.trim(), source, user_id: uid }])
    if (error) {
      setStatus('Save failed: ' + error.message)
      showToast('Save failed: ' + error.message, 'error')
      return
    }
    setFinalText('')
    setStatus('Saved!')
    showToast('Saved entry', 'success')
    fetchEntries()
  }

  // ---------------- summaries fetch ----------------
  const fetchSummaries = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData?.user?.id
      if (!uid) {
        setSummaries([])
        return
      }
      const { data, error } = await supabase
        .from('summaries')
        .select('id, summary_text, created_at, rating, for_date, user_id, range_start, range_end')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(500)
      if (!error) setSummaries(data || [])
      else {
        console.error('fetchSummaries error', error)
        setSummaries([])
      }
    } catch (err) {
      console.error('fetchSummaries exception', err)
      setSummaries([])
    }
  }

  // ---------------- generate summary ----------------
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
      showToast('Reflection ready', 'success', 1400)
    } catch (err: any) {
      console.error('generate24hSummary', err)
      setStatus('Failed: ' + (err?.message || String(err)))
      showToast('Couldn’t generate reflection right now : try again soon.', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  // ---------------- save rated summary (ensures user_id) ----------------
  async function saveRatedSummary(rating: number) {
    if (!generatedSummary) return
    try {
      setIsSavingRating(true)
      setStatus('Saving reflection...')
      const { data: u } = await supabase.auth.getUser()
      let uid = u?.user?.id
      if (!uid) {
        const { data: sess } = await supabase.auth.getSession()
        uid = (sess as any)?.session?.user?.id
      }
      if (!uid) {
        setStatus('Please sign in to save the summary.')
        showToast('Please sign in to save the reflection.', 'info')
        setIsSavingRating(false)
        return
      }
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const upto = new Date().toISOString()
      const todayIso = new Date().toISOString().slice(0, 10)

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
        setRecentlyAddedId(newRow.id)
        setExpandedSummaryId(newRow.id)
        // collapse after a short moment and remove highlight
        window.setTimeout(() => {
          setExpandedSummaryId(null)
          setRecentlyAddedId(null)
        }, 2600)
      } else {
        await fetchSummaries()
      }
      setGeneratedSummary(null)
      setGeneratedAt(null)
      setHoverRating(0)
      setStatus('Reflection saved!')
      showToast('Reflection saved — you captured another piece of your day.', 'success', 2600)
      // scroll to summaries
      window.setTimeout(() => {
        const el = document.getElementById('your-summaries-section')
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 250)
    } catch (err: any) {
      console.error('saveRatedSummary error', err)
      const msg = err?.message || String(err)
      setStatus('Could not save reflection: ' + msg)
      showToast('Could not save reflection: ' + msg, 'error', 4000)
    } finally {
      setIsSavingRating(false)
    }
  }

  // ---------------- delete summary action ----------------
  async function deleteSummary(id: string) {
    if (!confirm('Permanently delete this reflection? This cannot be undone.')) return
    try {
      const { error } = await supabase.from('summaries').delete().eq('id', id)
      if (error) throw error
      setSummaries((prev) => prev.filter((s) => s.id !== id))
      setStatus('Reflection deleted.')
      showToast('Reflection deleted', 'info')
    } catch (err: any) {
      console.error('deleteSummary error', err)
      showToast('Could not delete reflection: ' + (err?.message || String(err)), 'error')
    }
  }

  // ---------------- voice / recording ----------------
  useEffect(() => {
    const Recog = window.SpeechRecognition || window.webkitSpeechRecognition || null
    if (!Recog) {
      return
    }
    const r = new Recog()
    recogRef.current = r
    r.lang = 'en-US'
    r.interimResults = true
    r.maxAlternatives = 1
    r.continuous = false

    r.onresult = (event: any) => {
      let interimT = ''
      let finalT = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
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
        setTimeout(() => {
          try {
            recogRef.current?.start()
          } catch {}
        }, 150)
      } else setIsRecording(false)
    }

    return () => {
      recogRef.current = null
    }
  }, [])

  const startRecording = () => {
    if (!recogRef.current) {
      showToast('Speech API not available in this browser', 'info')
      return
    }
    try {
      holdingRef.current = true
      recogRef.current.start()
      setIsRecording(true)
      setInterim('')
      setFinalText('')
      setStatus('Recording...')
    } catch (err: any) {
      setStatus('Mic error: ' + err?.message)
      showToast('Mic error: ' + err?.message, 'error')
    }
  }

  const stopRecording = async () => {
    holdingRef.current = false
    try {
      recogRef.current?.stop()
    } catch {}
    setIsRecording(false)

  // combine final + interim
    const text = (finalText + (interim ? ' ' + interim : '')).trim()

  // clear interim state
    setInterim('')

    if (!text) {
      setStatus('No speech captured.')
      return
    }

  // IMPORTANT: do NOT auto-save — instead put transcription into edit buffer
    setFinalText(text) // user will now see and can edit before saving
    setStatus('Transcription ready — edit if needed, then click Save.')
    showToast('Transcription ready — edit and press Save', 'info', 2200)

  // do not call saveTextEntry here
}


  // ---------------- expansion helpers ----------------
  const toggleExpand = (id: string) => {
    setExpandedSummaryId((cur) => (cur === id ? null : id))
  }

  // group summaries by for_date display (Priority B)
  const groupedSummaries = summaries.reduce<Record<string, SummaryRow[]>>((acc, s) => {
    const groupKey = formatDateForGroup(s.for_date || s.created_at)
    if (!acc[groupKey]) acc[groupKey] = []
    acc[groupKey].push(s)
    return acc
  }, {})

  // ---------------- UI render ----------------
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white p-8">
      {/* Toast */}
      <div className="fixed top-6 right-6 z-50">{toast && <Toast text={toast.text} kind={toast.kind} />}</div>

      <main className="mx-auto w-full max-w-3xl">
        <header className="mb-10">
          <h1 className="text-4xl font-bold text-indigo-900 leading-tight">Mindstream</h1>
          <p className="mt-2 text-sm text-slate-600">Your thoughts. Finally understood.</p>
        </header>

        <div className="mb-6 rounded-lg border bg-white/60 p-4 shadow-sm flex items-center justify-between">
          <div className="text-sm text-slate-700">
            <strong>Privacy:</strong> Voice is processed by your browser’s speech service; audio isn’t stored.
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="text-sm text-slate-700">{user.email ?? user.id.slice(0, 8)}</div>
                <button onClick={signOut} className="text-sm underline">
                  Sign out
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="rounded-md border px-2 py-1 text-sm"
                />
                <button onClick={sendMagicLink} className="rounded-md bg-indigo-600 text-white px-3 py-1 text-sm">
                  Magic link
                </button>
                <button onClick={signInWithGoogle} className="rounded-md border px-3 py-1 text-sm">
                  Google
                </button>
              </div>
            )}
          </div>
        </div>

  {/* input and record - REPLACEMENT */}
  <div className="mb-8">
    <div className="flex gap-3 items-start">
      {/* If there's a recorded transcription waiting for review, show a textarea */}
      {finalText ? (
        <textarea
          value={finalText}
          onChange={(e) => setFinalText(e.target.value)}
          rows={4}
          className="flex-1 rounded-md border px-4 py-3 shadow-sm text-[15px] leading-relaxed"
          placeholder="Edit your transcription here before saving..."
          aria-label="Edit transcription"
        />
      ) : (
        <input
          value={finalText}
          onChange={(e) => setFinalText(e.target.value)}
          className="flex-1 rounded-md border px-4 py-3 shadow-sm text-[15px] leading-relaxed"
          placeholder="What’s on your mind?"
          aria-label="What's on your mind?"
        />
      )}

      <div className="flex flex-col gap-2">
        {/* Save typed or edited transcription */}
        <button
          onClick={() => saveTextEntry(finalText)}
          disabled={!finalText || finalText.trim().length === 0}
          className="rounded-md bg-indigo-700 text-white px-4 py-2 disabled:opacity-50"
        >
          Save
        </button>

        {/* Hold to record button unchanged */}
        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          className={`rounded-md px-4 py-2 ${isRecording ? 'bg-teal-400 text-white' : 'bg-white border'}`}
          title="Hold to record"
          aria-pressed={isRecording}
        >
          {isRecording ? 'Recording…' : 'Hold to record'}
        </button>
      </div>
    </div>

    {/* When there is a recorded transcription, show explicit Save / Cancel controls and hint */}
    {finalText && (
      <div className="mt-3 flex items-center gap-3">
        <div className="text-xs text-slate-500">Edit your transcription, then click Save. Or click Cancel to discard.</div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => {
              // Cancel / discard transcript
              setFinalText('')
              setStatus('Transcription discarded.')
              showToast('Transcription discarded', 'info')
            }}
            className="px-3 py-1 border rounded-md text-sm text-slate-600 bg-white"
          >
            Cancel
          </button>
          <button
            onClick={() => saveTextEntry(finalText)}
            disabled={!finalText || finalText.trim().length === 0}
            className="px-3 py-1 bg-indigo-600 text-white rounded-md text-sm"
          >
            Save transcription
          </button>
        </div>
      </div>
    )}
  </div>


        {/* generated summary (preview -> rate) */}
        {generatedSummary && (
          <div className="mb-8 rounded-lg border bg-gradient-to-b from-indigo-50/60 to-white p-4 shadow-md transition-opacity duration-300 ease-out">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold text-indigo-800">✨ Reflection generated {generatedAt ? `— ${new Date(generatedAt).toLocaleTimeString()}` : ''}</div>
                <div className="text-xs text-slate-500">Read it, then rate (1–5) to save — or discard it permanently.</div>
              </div>
              <button onClick={() => { setGeneratedSummary(null); setGeneratedAt(null); setStatus(null); }} className="text-xs text-slate-400 underline">
                Dismiss
              </button>
            </div>

            <div className="mt-3 p-4 rounded-md bg-white/80 text-slate-800 whitespace-pre-wrap leading-relaxed">
              <div dangerouslySetInnerHTML={{ __html: markDownLike(generatedSummary) }} />
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div className="text-sm text-slate-600">Rate this reflection (click a star to save):</div>

              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => {
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

        {/* entries */}
        <section className="space-y-4 mb-12">
          <div className="text-sm text-slate-500">Your Reflections</div>
          <div className="rounded-lg bg-white p-4 border shadow-sm">
            {entries.length === 0 && <div className="text-slate-700">Your thoughts will appear here once you start speaking or typing.</div>}
            {entries.length > 0 && (
              <ul className="space-y-3">
                {entries.map((e) => (
                  <li key={e.id} className="p-3 border rounded-md bg-white">
                    <div className="text-slate-800 whitespace-pre-wrap">{e.content}</div>
                    <div className="mt-2 text-xs text-slate-400">{new Date(e.created_at!).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* summaries (grouped by date) */}
        <section id="your-summaries-section" ref={summariesRef as any} className="space-y-6 mb-16">
          <div className="text-sm text-slate-500">Your Summaries</div>
          <div className="rounded-lg bg-white p-4 border shadow-sm space-y-6">
            {Object.keys(groupedSummaries).length === 0 && <div className="text-slate-700">No summaries yet — generate one above.</div>}

            {Object.entries(groupedSummaries).map(([group, items]) => (
              <div key={group}>
                <div className="text-xs text-slate-400 mb-2">{group}</div>
                <ul className="space-y-3">
                  {items.map((s) => {
                    const isExpanded = expandedSummaryId === s.id
                    const preview = previewText(s.summary_text || '', 220)
                    const highlight = recentlyAddedId === s.id
                    return (
                      <li key={s.id} className={`rounded-md border bg-white overflow-hidden transition-shadow ${highlight ? 'ring-2 ring-teal-200' : ''}`}>
                        <div className="p-4 flex items-start gap-4">
                          <div className="flex-1">
                            <div className="text-sm text-slate-800 leading-snug line-clamp-4">{preview}</div>
                            <div className="mt-2 text-xs text-slate-400 flex items-center gap-3">
                              <span>{s.for_date ?? (s.created_at ? new Date(s.created_at).toLocaleDateString() : '')}</span>
                              <span className="text-yellow-500">{renderStarsInline(s.rating)}</span>
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-500 text-xs"> {s.summary_text?.length ?? 0} chars</span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-2">
                              <button
                                aria-expanded={isExpanded}
                                aria-controls={`summary-body-${s.id}`}
                                onClick={() => toggleExpand(s.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    toggleExpand(s.id)
                                  }
                                }}
                                className="p-3 min-w-[44px] min-h-[44px] rounded-md border bg-white hover:bg-indigo-50"
                                title={isExpanded ? 'Collapse summary' : 'Expand summary'}
                              >
                                <svg className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : 'rotate-0'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>

                              <div className="flex flex-col items-end gap-2">
                                <button
                                  onClick={() => deleteSummary(s.id)}
                                  className="text-xs px-2 py-1 border rounded-md text-slate-500 hover:bg-rose-50"
                                  title="Delete summary"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div
                          id={`summary-body-${s.id}`}
                          className="px-4 pb-4 transition-[max-height,opacity] duration-300 ease-in-out overflow-hidden"
                          style={{ maxHeight: isExpanded ? '1200px' : '0px', opacity: isExpanded ? 1 : 0 }}
                          role="region"
                          aria-hidden={!isExpanded}
                        >
                          <div className="mt-2 text-slate-800 leading-relaxed whitespace-pre-wrap">
                            <div dangerouslySetInnerHTML={{ __html: markDownLike(s.summary_text) }} />
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <div className="text-xs text-slate-400">Saved {s.for_date ?? (s.created_at ? new Date(s.created_at).toLocaleString() : '')}</div>
                            <div className="text-sm text-slate-600">Your rating: <span className="text-yellow-500">{renderStarsInline(s.rating)}</span></div>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {status && <div className="mt-6 text-sm text-slate-600">{status}</div>}
        <footer className="mt-8 text-xs text-slate-400">Private • Encrypted • Yours</footer>
      </main>
    </div>
  )
}
