// pages/index.tsx
import { useEffect, useState, useRef } from 'react'
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

  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [emailForOtp, setEmailForOtp] = useState('')

  // recording state
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // auth
  const loadUser = async () => {
    const { data } = await supabase.auth.getUser()
    if (data?.user) setUser({ id: data.user.id, email: data.user.email ?? undefined })
    else setUser(null)
  }

  useEffect(() => {
    loadUser()
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) setUser({ id: session.user.id, email: session.user.email ?? undefined })
      else setUser(null)
      // refresh entries whenever auth state changes
      fetchEntries()
    })
    return () => sub.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // fetch entries (client-side -> RLS)
  const fetchEntries = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('entries')
        .select('id, content, source, metadata, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Client fetch entries error:', error)
        setStatus(`Error loading entries: ${error.message}`)
        setEntries([])
      } else {
        setEntries(data || [])
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
  useEffect(() => { fetchEntries() }, [user?.id])

  // sign in/out functions omitted here for brevity — reuse your existing ones
  const signInWithGoogle = async () => {
    setStatus('Redirecting to Google...')
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
  }
  const sendMagicLink = async () => {
    if (!emailForOtp.includes('@')) { setStatus('Enter a valid email'); return }
    setStatus('Sending magic link...')
    const { error } = await supabase.auth.signInWithOtp({ email: emailForOtp })
    if (error) { setStatus(`Error sending link: ${error.message}`) } else { setStatus('Magic link sent.') }
  }
  const signOut = async () => {
    setStatus('Signing out...')
    const { error } = await supabase.auth.signOut()
    if (error) setStatus(`Error signing out: ${error.message}`)
    else { setUser(null); setEntries([]); setStatus(null) }
  }

  // save text entry (existing)
  const saveTextEntry = async () => {
    if (!input.trim()) return
    setStatus('Saving...')
    const { data: udata } = await supabase.auth.getUser()
    const uid = udata?.user?.id
    if (!uid) { setStatus('Please sign in (Google or magic link) to save your thought.'); return }
    const { error } = await supabase.from('entries').insert([{ content: input, source: 'text', user_id: uid }])
    if (error) { setStatus(`Error saving entry: ${error.message}`) } else { setInput(''); setStatus('Saved successfully!'); fetchEntries() }
  }

  // RECORDING helpers
  const startRecording = async () => {
    try {
      setStatus('Requesting microphone...')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      mr.ondataavailable = (ev) => { if (ev.data && ev.data.size > 0) audioChunksRef.current.push(ev.data) }
      mr.onstop = () => { /* handled in stopRecording */ }
      mr.start()
      setIsRecording(true)
      setStatus('Recording...')
    } catch (e: any) {
      console.error('mic error', e)
      setStatus('Microphone access denied or not available.')
    }
  }

  const stopRecording = async () => {
    const mr = mediaRecorderRef.current
    if (!mr) return
    mr.stop()
    setIsRecording(false)
    setStatus('Processing recording...')
    // assemble blob
    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
    // optional: convert if needed — we'll upload as webm (OpenAI accepts webm)
    try {
      const filePath = await uploadAudioBlob(blob)
      // call server to transcribe
      const t = await transcribeFile(filePath)
      if (t) {
        // save transcript as entry (client insert)
        const { data: u } = await supabase.auth.getUser()
        const uid = u?.user?.id
        if (!uid) { setStatus('Please sign in to save transcription.'); return }
        const { error } = await supabase.from('entries').insert([{ content: t, source: 'voice', user_id: uid, metadata: { file: filePath } }])
        if (error) { setStatus(`Error saving entry: ${error.message}`) }
        else { setStatus('Saved voice entry!'); fetchEntries() }
      } else {
        setStatus('Transcription returned empty.')
      }
    } catch (err: any) {
      console.error('recording -> upload -> transcribe error', err)
      setStatus(`Error: ${err?.message || String(err)}`)
    }
  }

  // upload audio to Supabase storage (private bucket 'audio')
  async function uploadAudioBlob(blob: Blob) {
    // create unique path
    const id = cryptoRandomId()
    const ext = 'webm'
    const filePath = `${id}.${ext}`
    // use the browser supabase client to upload to storage
    const { error } = await supabase.storage.from('audio').upload(filePath, blob, { contentType: blob.type, upsert: false })
    if (error) throw new Error(error.message)
    return filePath
  }

  // call server to transcribe file (server will download using service_role)
  async function transcribeFile(filePath: string) {
    setStatus('Transcribing...')
    const resp = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket: 'audio', filePath })
    })
    const payload = await resp.json()
    if (!resp.ok) {
      console.error('Transcribe failed', payload)
      throw new Error(payload?.error || 'Transcription failed')
    }
    return payload.transcript as string
  }

  function cryptoRandomId() {
    // short unique id (not cryptographic necessary)
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-6)
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-start justify-center p-8">
      <div className="w-full max-w-2xl">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold text-indigo-900">Mindstream</h1>
          <p className="text-sm text-slate-600">Your thoughts. Finally understood.</p>
        </header>

        <div className="mb-4 p-4 rounded-lg border border-slate-100 bg-white shadow-sm flex items-center justify-between">
          <div><strong>Privacy:</strong> Your thoughts are encrypted and private.</div>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="text-sm text-slate-700">Signed in: {user.email ?? user.id.slice(0,8)}</div>
                <button onClick={signOut} className="text-sm underline">Sign out</button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <input value={emailForOtp} onChange={(e)=>setEmailForOtp(e.target.value)} placeholder="you@example.com" className="rounded-md border px-2 py-1 text-sm" />
                <button onClick={sendMagicLink} className="rounded-md bg-indigo-600 text-white px-3 py-1 text-sm">Magic link</button>
                <button onClick={signInWithGoogle} className="rounded-md border px-3 py-1 text-sm">Sign in with Google</button>
              </div>
            )}
          </div>
        </div>

        <div className="mb-4">
          <div className="flex gap-2">
            <input value={input} onChange={(e)=>setInput(e.target.value)} className="flex-1 rounded-md border px-3 py-2 shadow-sm" placeholder="What’s on your mind?" />
            <button onClick={saveTextEntry} className="rounded-md bg-indigo-700 text-white px-4 py-2">Save</button>
          </div>
          {status && <p className="mt-2 text-sm text-slate-600">{status}</p>}
        </div>

        {/* Recorder UI */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { isRecording ? stopRecording() : startRecording() }}
              className={`px-4 py-2 rounded-md ${isRecording ? 'bg-red-600 text-white' : 'bg-white border'}`}
            >
              {isRecording ? 'Stop' : 'Record voice'}
            </button>
            <div className="text-sm text-slate-500">Record a short reflection (webm). Then it will be transcribed and saved.</div>
          </div>
        </div>

        <section className="space-y-4">
          <div className="text-sm text-slate-500">Today — Auto summary (10 PM)</div>
          <div className="rounded-lg bg-white p-4 border shadow-sm">
            {loading && <div className="text-slate-500">Loading entries...</div>}
            {!loading && entries && entries.length === 0 && <div className="text-slate-700">No entries yet — your thoughts will appear here once you start typing or recording.</div>}
            {!loading && entries && entries.length > 0 && (
              <ul className="space-y-3">
                {entries.map((e) => (
                  <li key={e.id} className="p-3 border rounded-md bg-white">
                    <div className="text-slate-800">{e.content}</div>
                    <div className="mt-2 text-xs text-slate-400">{new Date(e.created_at).toLocaleString()}{e.user_id ? ` • user: ${e.user_id.slice(0,8)}` : ''}</div>
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
