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
  const recogRef = useRef<any>(null)
  const timeoutRef = useRef<number | null>(null)

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
      setStatus(`Error: ${e.error}`)
      setIsRecording(false)
    }

    r.onend = () => {
      setIsRecording(false)
      clearTimeoutIfAny()
    }

    return () => {
      r.onresult = null
      r.onerror = null
      r.onend = null
      recogRef.current = null
      clearTimeoutIfAny()
    }
  }, [])

  const clearTimeoutIfAny = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  const start = () => {
    if (!recogRef.current) {
      setStatus('Voice recognition not supported in this browser.')
      return
    }
    try {
      recogRef.current.start()
      setIsRecording(true)
      setInterim('')
      setFinalText('')
      setStatus('Listening...')
      timeoutRef.current = window.setTimeout(() => stop(), 45_000)
    } catch (err: any) {
      console.error('start error', err)
      setStatus('Could not start mic (check permissions).')
      setIsRecording(false)
    }
  }

  const stop = async () => {
    try {
      recogRef.current?.stop()
    } catch (e) {}
    clearTimeoutIfAny()
    setIsRecording(false)
    const text = (finalText + (interim ? ' ' + interim : '')).trim()
    if (!text) return setStatus('No speech detected.')
    setStatus('Saving transcription...')
    try {
      await saveTextEntry(text, 'voice')
      setStatus('Saved voice transcription.')
      setInterim('')
      setFinalText('')
    } catch (err: any) {
      setStatus('Save failed: ' + err.message)
    }
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
          <div><strong>Privacy:</strong> Your voice is processed by your browser’s built-in speech service (e.g. Google or Apple). Audio isn’t stored or sent to us.</div>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="text-sm text-slate-700">Signed in: {user.email ?? user.id.slice(0, 8)}</div>
                <button onClick={signOut} className="text-sm underline">Sign out</button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" className="rounded-md border px-2 py-1 text-sm" />
                <button onClick={sendMagicLink} className="rounded-md bg-indigo-600 text-white px-3 py-1 text-sm">Magic link</button>
                <button onClick={signInWithGoogle} className="rounded-md border px-3 py-1 text-sm">Sign in with Google</button>
              </div>
            )}
          </div>
        </div>

        {/* Manual text input */}
        <div className="mb-6">
          <div className="flex gap-2">
            <input value={input} onChange={(e)=>setInput(e.target.value)} className="flex-1 rounded-md border px-3 py-2 shadow-sm" placeholder="What’s on your mind?" />
            <button onClick={()=>saveTextEntry(input)} className="rounded-md bg-indigo-700 text-white px-4 py-2">Save</button>
          </div>
          {status && <p className="mt-2 text-sm text-slate-600">{status}</p>}
        </div>

        {/* Voice STT section */}
        <div className="mb-6">
          {isSupported ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => (isRecording ? stop() : start())}
                  className={`px-4 py-2 rounded-md ${isRecording ? 'bg-red-600 text-white' : 'bg-white border'}`}
                >
                  {isRecording ? 'Stop' : 'Record (Browser STT)'}
                </button>
                <div className="text-sm text-slate-500">{isRecording ? 'Listening...' : 'Tap to record up to 45s'}</div>
              </div>
              <div className="p-2 rounded border bg-white min-h-[40px]">
                <div className="text-slate-800">{finalText}<span className="text-slate-400 italic">{interim}</span></div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-md border bg-white text-sm text-slate-600">
              Voice input not supported in this browser. Try Chrome or Edge on desktop or Android.
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
                    <div className="text-slate-800">{e.content}</div>
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
