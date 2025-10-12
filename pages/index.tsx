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
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [entries, setEntries] = useState<any[]>([])
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [email, setEmail] = useState('')

  // Voice state
  const [isRecording, setIsRecording] = useState(false)
  const [isSupported, setIsSupported] = useState<boolean | null>(null)
  const [interim, setInterim] = useState('')
  const [finalText, setFinalText] = useState('')
  const [draftVoiceText, setDraftVoiceText] = useState<string | null>(null)
  const recogRef = useRef<any>(null)
  const safetyTimeoutRef = useRef<number | null>(null)
  const holdingRef = useRef(false)

  // Draft & summary state (add near other useState declarations)
  const [draftSummary, setDraftSummary] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [lastSummaryRange, setLastSummaryRange] = useState<{start:string,end:string}|null>(null)


  // ---------------- AUTH ----------------
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser()
      if (data?.user) setUser({ id: data.user.id, email: data.user.email ?? undefined })
    }
    load()
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) setUser({ id: session.user.id, email: session.user.email ?? undefined })
      else setUser(null)
      fetchEntries()
    })
    return () => sub.subscription.unsubscribe()
  }, [])

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
    setStatus(null)
  }

  // ---------------- ENTRIES ----------------
  const fetchEntries = async () => {
    const { data, error } = await supabase
      .from('entries')
      .select('id, content, created_at')
      .order('created_at', { ascending: false })
    if (!error) setEntries(data || [])
  }

  const saveTextEntry = async (text: string, source = 'text') => {
    const { data: u } = await supabase.auth.getUser()
    const uid = u?.user?.id
    if (!uid) throw new Error('Please sign in first.')
    const { error } = await supabase.from('entries').insert([{ content: text, source, user_id: uid }])
    if (error) throw error
    fetchEntries()
  }

  // generate the 24h summary by fetching last 24h entries and calling server
  async function generate24hSummary() {
    try {
      setIsGenerating(true)
      setStatus('Loading recent entries...')
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data: entries24, error } = await supabase
        .from('entries')
        .select('id, content, created_at, source, metadata')
        .gte('created_at', since)
        .order('created_at', { ascending: true })

      if (error) {
        setStatus('Could not load recent entries: ' + error.message)
        setIsGenerating(false)
        return
      }
      if (!entries24 || entries24.length === 0) {
        setStatus('No entries in the past 24 hours.')
        setIsGenerating(false)
        return
      }

      setStatus('Generating summary — this may take a few seconds...')
      const resp = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: entries24 })
      })
      const payload = await resp.json()
      if (!resp.ok) {
        setStatus('Summary generation failed: ' + (payload?.error || JSON.stringify(payload)))
        setIsGenerating(false)
        return
      }

      const generated = payload.summary as string
    // set draft for user to edit & save
      setDraftSummary(generated)
      setLastSummaryRange({ start: since, end: new Date().toISOString() })
      setStatus('Summary ready — please review and save.')
    } catch (err: any) {
      console.error('generate24hSummary error', err)
      setStatus('Failed to generate summary: ' + (err?.message || String(err)))
    } finally {
      setIsGenerating(false)
    }
  }

// save the user-edited draft summary into the summaries table
  async function saveDraftSummary() {
    if (!draftSummary) return
    try {
      setStatus('Saving summary...')
      const { data: u } = await supabase.auth.getUser()
      const uid = u?.user?.id
      if (!uid) throw new Error('Not signed in')

      const { error } = await supabase.from('summaries').insert([{
        user_id: uid,
        range_start: lastSummaryRange?.start ?? new Date(Date.now() - 24*60*60*1000).toISOString(),
        range_end: lastSummaryRange?.end ?? new Date().toISOString(),
        summary_text: draftSummary
      }])

      if (error) throw error
      setDraftSummary(null)
      setStatus('Saved summary.')
      fetchEntries()
    } catch (err: any) {
      console.error('saveDraftSummary error', err)
      setStatus('Could not save summary: ' + (err?.message || String(err)))
    }
  }
 
  // ---------------- WEB SPEECH API ----------------
  useEffect(() => {
    const Recog = window.SpeechRecognition || window.webkitSpeechRecognition || null
    if (!Recog) {
      setIsSupported(false)
      return
    }
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
      setStatus(`Recognition error: ${e?.error || 'unknown'}`)
      setIsRecording(false)
    }

    // Restart if silence ended recognition while holding
    r.onend = () => {
      if (holdingRef.current) {
        try {
          setTimeout(() => {
            try {
              recogRef.current?.start()
            } catch (err) {
              console.warn('restart failed', err)
              holdingRef.current = false
              setIsRecording(false)
              clearSafetyTimeout()
            }
          }, 150)
        } catch (err) {
          holdingRef.current = false
          setIsRecording(false)
          clearSafetyTimeout()
        }
      } else {
        setIsRecording(false)
        clearSafetyTimeout()
      }
    }

    return () => {
      r.onresult = null
      r.onerror = null
      r.onend = null
      recogRef.current = null
      clearSafetyTimeout()
    }
  }, [])

  const clearSafetyTimeout = () => {
    if (safetyTimeoutRef.current) {
      window.clearTimeout(safetyTimeoutRef.current)
      safetyTimeoutRef.current = null
    }
  }

  // START recording (on press)
  const startRecording = () => {
    if (!recogRef.current) {
      setStatus('Voice recognition not supported in this browser.')
      return
    }
    try {
      holdingRef.current = true
      recogRef.current.start()
      setIsRecording(true)
      setInterim('')
      setFinalText('')
      setStatus('Recording... release to stop')
      safetyTimeoutRef.current = window.setTimeout(() => {
        holdingRef.current = false
        stopRecording()
      }, 60_000)
    } catch (err: any) {
      console.error('start error', err)
      setStatus('Could not start mic (check permissions).')
      setIsRecording(false)
      holdingRef.current = false
    }
  }

  // STOP recording (on release)
  const stopRecording = async () => {
    holdingRef.current = false
    clearSafetyTimeout()
    try {
      recogRef.current?.stop()
    } catch (e) {}
    setIsRecording(false)

    const text = (finalText + (interim ? ' ' + interim : '')).trim()
    setInterim('')
    setFinalText('')
    if (!text) {
      setStatus('No speech captured.')
      return
    }
    // Instead of auto-saving, show editable draft
    setDraftVoiceText(text)
    setStatus('Review your transcription below.')
  }

  // ---------------- UI ----------------
  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex justify-center p-8">
      <div className="w-full max-w-2xl">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold text-indigo-900">Mindstream</h1>
          <p className="text-sm text-slate-600">Your thoughts. Finally understood.</p>
        </header>

        <div className="mb-4 p-4 rounded-lg border border-slate-100 bg-white shadow-sm flex items-center justify-between">
          <div>
            <strong>Privacy:</strong> Voice is processed by your browser’s built-in speech service (e.g. Google or Apple). Audio is not stored by us.
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="text-sm text-slate-700">Signed in: {user.email ?? user.id.slice(0, 8)}</div>
                <button onClick={signOut} className="text-sm underline">Sign out</button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="rounded-md border px-2 py-1 text-sm" />
                <button onClick={sendMagicLink} className="rounded-md bg-indigo-600 text-white px-3 py-1 text-sm">Magic link</button>
                <button onClick={signInWithGoogle} className="rounded-md border px-3 py-1 text-sm">Sign in with Google</button>
              </div>
            )}
          </div>
        </div>

        {/* Manual text input */}
        <div className="mb-6">
          <div className="flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} className="flex-1 rounded-md border px-3 py-2 shadow-sm" placeholder="What’s on your mind?" />
            <button onClick={() => saveTextEntry(input)} className="rounded-md bg-indigo-700 text-white px-4 py-2">Save</button>
          </div>
          {status && <p className="mt-2 text-sm text-slate-600">{status}</p>}
        </div>

        {/* Voice STT section with hold-to-record */}
        <div className="mb-6">
          <div className="rounded-lg bg-white p-4 border shadow-sm">
            <div className="mb-3">
              <div className="text-sm font-medium">Voice recording — Tap & Hold</div>
              <div className="text-xs text-slate-500 mt-1">
                Press and hold the button below to record your reflection. Release to stop — your speech will be transcribed here. Review or edit before saving.
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Tip: Speak in short bursts (3–20 s) for best accuracy. Works best in Chrome or Edge on desktop or Android.
              </div>
            </div>

            {isSupported ? (
              <div className="flex items-center gap-3">
                <button
                  role="button"
                  aria-pressed={isRecording}
                  aria-label="Hold to record voice"
                  onPointerDown={(e) => {
                    (e.target as HTMLElement).setPointerCapture((e as any).pointerId)
                    startRecording()
                  }}
                  onPointerUp={(e) => {
                    (e.target as HTMLElement).releasePointerCapture((e as any).pointerId)
                    stopRecording()
                  }}
                  onPointerCancel={() => stopRecording()}
                  className={`px-5 py-3 rounded-md focus:outline-none ${isRecording ? 'bg-red-600 text-white' : 'bg-white border'}`}
                >
                  {isRecording ? 'Release to Stop' : 'Hold to Record'}
                </button>

                <div className="text-sm text-slate-500">
                  {isRecording ? 'Recording… release to finish' : 'Hold button and speak'}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-600">
                Voice input not supported in this browser. Try Chrome or Edge on desktop or Android.
              </div>
            )}

            {/* live interim display */}
            <div className="mt-3 p-2 rounded border bg-slate-50 min-h-[44px]">
              <div className="text-slate-800">
                {finalText} <span className="text-slate-400 italic">{interim}</span>
              </div>
            </div>

            {/* Draft text editor after release */}
            {draftVoiceText && (
              <div className="mt-4 space-y-2">
                <textarea
                  value={draftVoiceText}
                  onChange={(e) => setDraftVoiceText(e.target.value)}
                  rows={4}
                  className="w-full border rounded-md p-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        await saveTextEntry(draftVoiceText, 'voice')
                        setStatus('Saved voice transcription.')
                        setDraftVoiceText(null)
                      } catch (err: any) {
                        setStatus('Save failed: ' + (err?.message || 'unknown'))
                      }
                    }}
                    className="bg-indigo-600 text-white px-3 py-1 rounded-md text-sm"
                  >
                    Save
                  </button>
                  <button onClick={() => setDraftVoiceText(null)} className="border px-3 py-1 rounded-md text-sm">
                    Discard
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* — 24-hour Summary generator UI — */}
  <div className="mb-6">
    <div className="flex items-center justify-between mb-2">
      <div className="text-sm font-medium">Daily Reflection — 24-hour summary</div>
      <div>
        <button
          onClick={generate24hSummary}
          disabled={isGenerating}
          className="rounded-md bg-indigo-600 text-white px-3 py-1 text-sm"
        >
          {isGenerating ? 'Generating...' : 'Generate 24-hour summary'}
        </button>
      </div>
    </div>
    <div className="text-xs text-slate-500 mb-2">
      Tap “Generate” to create an encouraging, factual summary of what you recorded today. You can edit before saving.
    </div>

    {/* Draft editor shown after generation */}
    {draftSummary && (
      <div className="rounded-md border p-3 bg-white space-y-2">
        <textarea
          value={draftSummary}
          onChange={(e) => setDraftSummary(e.target.value)}
          rows={6}
          className="w-full p-2 border rounded-md text-sm"
        />
        <div className="flex gap-2">
          <button onClick={saveDraftSummary} className="bg-green-600 text-white px-3 py-1 rounded-md text-sm">Save summary</button>
          <button onClick={() => setDraftSummary(null)} className="border px-3 py-1 rounded-md text-sm">Discard</button>
        </div>
      </div>
    )}
  </div>

        {/* Entries */}
        <section className="space-y-4">
          <div className="text-sm text-slate-500">Your Reflections</div>
          <div className="rounded-lg bg-white p-4 border shadow-sm">
            {entries.length === 0 && <div className="text-slate-700">No entries yet — your thoughts will appear here once you start typing or recording.</div>}
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
      </div>
    </main>
  )
}
