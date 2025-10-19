// pages/index.tsx
import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Header from '../components/Header'
import EntryInput from '../components/EntryInput'
import ToastContainer from '../components/ToastContainer'
import SummaryCard from '../components/SummaryCard'
import DebugOverlayHelper from '../components/DebugOverlayHelper'

import {
  previewText as previewTextUtil,
  markDownLike as markDownLikeUtil,
  formatDateForGroup as formatDateForGroupUtil,
  renderStarsInline as renderStarsInlineUtil,
  randomAffirmation
} from '../lib/ui'

declare global {
  interface Window {
    webkitSpeechRecognition?: any
    SpeechRecognition?: any
  }
}

/* ---------------- Lightweight types (informational only) ---------------- */
type EntryRow = {
  id: string
  content: string
  source?: string
  user_id?: string
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

/* ---------------- utils alias ---------------- */
const previewText = previewTextUtil
const markDownLike = markDownLikeUtil
const formatDateForGroup = formatDateForGroupUtil
const renderStarsInline = renderStarsInlineUtil

/* ---------------- Inline small components ---------------- */
function Toast({ text, kind = 'info' }: { text: string; kind?: 'info' | 'success' | 'error' }) {
  const bg = kind === 'success' ? 'bg-teal-600' : kind === 'error' ? 'bg-rose-600' : 'bg-slate-700'
  return <div className={`text-white ${bg} px-3 py-2 rounded-md shadow-md text-sm`}>{text}</div>
}

function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => Promise<void> | void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative z-60 w-full max-w-md rounded-md bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {description && <p className="mt-2 text-sm text-slate-600">{description}</p>}
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onCancel} className="px-3 py-1 border rounded-md text-sm">
            {cancelLabel}
          </button>
          <button
            onClick={() => onConfirm()}
            className="px-3 py-1 bg-rose-600 text-white rounded-md text-sm"
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Main Page ---------------- */
export default function Home() {
  /* ---------------- Auth & global UI state ---------------- */
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [toast, setToast] = useState<{ text: string; kind?: 'info' | 'success' | 'error' } | null>(null)

  /* small toast helper */
  function showToast(text: string, kind: 'info' | 'success' | 'error' = 'info', ms = 2200) {
    setToast({ text, kind })
    window.setTimeout(() => setToast(null), ms)
  }

  /* Header fade + typing handling */
  const [isHeaderVisible, setIsHeaderVisible] = useState(true)
  const typingTimeout = useRef<NodeJS.Timeout | null>(null)

  /* ---------------- Data sets ---------------- */
  const [entries, setEntries] = useState<EntryRow[]>([])
  const [summaries, setSummaries] = useState<SummaryRow[]>([])
  const [streakCount, setStreakCount] = useState<number>(0)

  /* Generated summary state */
  const [generatedSummary, setGeneratedSummary] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSavingRating, setIsSavingRating] = useState(false)

  /* Voice transcription */
  const [isRecording, setIsRecording] = useState(false)
  const [interim, setInterim] = useState('')
  const [finalText, setFinalText] = useState('') // typed / transcript buffer
  const recogRef = useRef<any>(null)
  const holdingRef = useRef(false)

  /* UI helpers */
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [expandedSummaryId, setExpandedSummaryId] = useState<string | null>(() => {
    try {
      if (typeof window !== 'undefined') return localStorage.getItem('expandedSummaryId')
    } catch {}
    return null
  })
  useEffect(() => {
    try {
      if (expandedSummaryId) {
        localStorage.setItem('expandedSummaryId', expandedSummaryId)
      } else {
        localStorage.removeItem('expandedSummaryId')
      }
    } catch {}
  }, [expandedSummaryId])
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null)

  /* Confirm modal state */
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmTitle, setConfirmTitle] = useState('')
  const [confirmDesc, setConfirmDesc] = useState<string | undefined>(undefined)
  const confirmActionRef = useRef<() => Promise<void> | void>(() => {})
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const summariesRef = useRef<HTMLDivElement | null>(null)

  /* small util to compute 20-word preview from entry content */
  function preview20Words(text: string) {
    if (!text) return ''
    const words = text.trim().split(/\s+/)
    if (words.length <= 20) return words.join(' ')
    return words.slice(0, 20).join(' ') + '…'
  }

  /* ---------------- Auth + initial load ---------------- */
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser()
      if (data?.user) setUser({ id: data.user.id, email: data.user.email ?? undefined })
      await fetchEntries()
      await fetchSummaries()
      await fetchStreak()
    }
    load()
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      try {
        if (session && session.user) {
          setUser({ id: session.user.id, email: session.user.email ?? undefined })
        } else {
          setUser(null)
        }
      } catch (err) {
        console.warn('onAuthStateChange handler error', err)
      }
      fetchEntries()
      fetchSummaries()
    })
    return () => {
      try {
        ;(sub as any)?.subscription?.unsubscribe?.()
      } catch {}
    }
  }, [])

  const signInWithGoogle = async () => {
    setStatus('Redirecting to Google...')
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setEntries([])
    setSummaries([])
    setStatus(null)
    showToast('Signed out', 'info')
  }

  /* ---------------- CRUD: Entries ---------------- */
  const fetchEntries = async () => {
    try {
      const { data: u } = await supabase.auth.getUser()
      const uid = u?.user?.id
      if (!uid) {
        setEntries([])
        return
      }
      const { data, error } = await supabase
        .from('entries')
        .select('id, content, source, created_at, user_id')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      setEntries(data || [])
    } catch (err) {
      console.error('fetchEntries error', err)
      setEntries([])
    }
  }

  const saveTextEntry = async (text: string, source = 'text') => {
    try {
      const { data: u } = await supabase.auth.getUser()
      const uid = u?.user?.id
      if (!uid) {
        showToast('Please sign in to save an entry.', 'info')
        return
      }
      const trimmed = (text || '').trim()
      if (!trimmed) {
        showToast('Cannot save empty entry.', 'info')
        return
      }

      const { data: inserted, error } = await supabase
        .from('entries')
        .insert([{ content: trimmed, source, user_id: uid }])
        .select('id')

      if (error) throw error

      const newId = Array.isArray(inserted) && inserted.length ? inserted[0].id : null
      if (newId) setRecentlyAddedId(newId)

      setFinalText('')
      showToast(randomAffirmation(), 'success', 2800)
      await fetchEntries()

      // fade out highlight after a moment
      setTimeout(() => setRecentlyAddedId(null), 2000)
    } catch (err: any) {
      console.error('saveTextEntry', err)
      showToast('Save failed: ' + (err?.message || String(err)), 'error')
    }
  }

  const confirmDeleteEntry = (entryId: string) => {
    setConfirmTitle('Delete entry')
    setConfirmDesc('Permanently delete this entry? This action cannot be undone.')
    confirmActionRef.current = async () => {
      // optimistic remove from frontend
      setPendingDeleteId(entryId)
      setEntries((prev) => prev.filter((e) => e.id !== entryId))
      try {
        const { error } = await supabase.from('entries').delete().eq('id', entryId)
        if (error) throw error
        showToast('Entry deleted', 'info')
      } catch (err: any) {
        console.error('delete entry failed', err)
        showToast('Could not delete entry: ' + (err?.message || String(err)), 'error')
        await fetchEntries() // restore from backend
      } finally {
        setPendingDeleteId(null)
      }
    }
    setConfirmOpen(true)
  }

  /* ---------------- CRUD: Summaries (fetch) ---------------- */
  const fetchSummaries = async () => {
    try {
      const { data: u } = await supabase.auth.getUser()
      const uid = u?.user?.id
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
      if (error) throw error
      setSummaries(data || [])
    } catch (err) {
      console.error('fetchSummaries error', err)
      setSummaries([])
    }
  }

  /* ---------------- Streak fetch ---------------- */
  const fetchStreak = async () => {
    try {
      const { data: u } = await supabase.auth.getUser()
      const uid = u?.user?.id
      if (!uid) return
      const { data, error } = await supabase
        .from('user_stats')
        .select('streak_count')
        .eq('user_id', uid)
        .single()
      if (!error && data) setStreakCount(data.streak_count || 0)
    } catch (err) {
      console.error('fetchStreak error', err)
    }
  }

  /* ---------------- Header fade when typing ---------------- */
  function handleTyping() {
    // hide header immediately and show it after idle
    setIsHeaderVisible(false)
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => {
      setIsHeaderVisible(true)
    }, 4000)
  }

  /* ---------------- Gentle reflection prompt (idle hint) ---------------- */
  const [showReflectPrompt, setShowReflectPrompt] = useState(false)

  useEffect(() => {
    const idleTimer = setTimeout(() => {
      setShowReflectPrompt(true)
    }, 10000) // show after 10s idle

    const resetIdle = () => setShowReflectPrompt(false)
    window.addEventListener('keydown', resetIdle)
    window.addEventListener('mousemove', resetIdle)
    window.addEventListener('click', resetIdle)

    return () => {
      clearTimeout(idleTimer)
      window.removeEventListener('keydown', resetIdle)
      window.removeEventListener('mousemove', resetIdle)
      window.removeEventListener('click', resetIdle)
    }
  }, [finalText, entries])

  /* ---------------- Voice recognition (hold to record) ---------------- */
  useEffect(() => {
    const Recog = window.SpeechRecognition || window.webkitSpeechRecognition || null
    if (!Recog) return
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
    const text = (finalText + (interim ? ' ' + interim : '')).trim()
    setInterim('')
    if (!text) {
      setStatus('No speech captured.')
      return
    }
    // put transcription into edit buffer (no auto-save)
    setFinalText(text)
    setStatus('Transcription ready — edit if needed, then click Save.')
    showToast('Transcription ready — edit and press Save', 'info')
  }

  /* ---------------- Generate 24h AI summary ---------------- */
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
        console.error('generate error payload', payload)
        showToast('Couldn’t generate reflection right now', 'error')
        return
      }
      setGeneratedSummary(payload.summary)
      setGeneratedAt(new Date().toISOString())
      showToast('Reflection ready', 'success')
    } catch (err: any) {
      console.error('generate24hSummary', err)
      showToast('Generation failed', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  /* ---------------- Save rated summary (persist reflection) ---------------- */
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
        showToast('Please sign in to save the reflection', 'info')
        setIsSavingRating(false)
        return
      }
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const upto = new Date().toISOString()
      const todayIso = new Date().toISOString().slice(0, 10)

      const insertResp = await supabase
        .from('summaries')
        .insert([
          {
            user_id: uid,
            range_start: since,
            range_end: upto,
            for_date: todayIso,
            summary_text: generatedSummary,
            rating
          }
        ])
        .select('*')
      const { data: inserted, error } = insertResp as any
      if (error) throw error
      const newRow = Array.isArray(inserted) && inserted.length ? inserted[0] : null
      if (newRow) {
        setSummaries((prev) => [newRow, ...prev])
        setRecentlyAddedId(newRow.id)
        setExpandedSummaryId(newRow.id)
        setTimeout(() => {
          setExpandedSummaryId(null)
          setRecentlyAddedId(null)
        }, 2600)
      } else {
        await fetchSummaries()
      }
      setGeneratedSummary(null)
      setGeneratedAt(null)
      setHoverRating(0)

      // update streak server-side (best-effort)
      try {
        await fetch('/api/user-stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: uid, for_date: todayIso })
        })
      } catch (err) {
        console.warn('streak update failed', err)
      }

      try {
        await fetchStreak()
      } catch (err) {}
      setTimeout(() => {
        const el = document.getElementById('your-summaries-section')
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 250)
    } catch (err: any) {
      console.error('saveRatedSummary error', err)
      showToast('Could not save reflection: ' + (err?.message || String(err)), 'error')
    } finally {
      setIsSavingRating(false)
    }
  }

  /* ---------------- Delete saved summary helper ---------------- */
  const deleteSavedSummary = async (summaryId: string) => {
    setPendingDeleteId(summaryId)
    setSummaries((prev) => prev.filter((s) => s.id !== summaryId))
    try {
      const { error } = await supabase.from('summaries').delete().eq('id', summaryId)
      if (error) throw error
      showToast('Reflection deleted', 'info')
    } catch (err: any) {
      console.error('delete summary failed', err)
      showToast('Could not delete reflection: ' + (err?.message || String(err)), 'error')
      await fetchSummaries()
    } finally {
      setPendingDeleteId(null)
    }
  }

  /* ---------------- Density (compact/comfortable) ---------------- */
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable')

  /* ---------------- Render ---------------- */
  return (
    <div className="min-h-screen p-8">
      <ToastContainer toast={toast} />
      <DebugOverlayHelper />

      {/* Confirm modal */}
      <ConfirmModal
        open={confirmOpen}
        title={confirmTitle}
        description={confirmDesc}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={async () => {
          setConfirmOpen(false)
          try {
            await (confirmActionRef.current() as Promise<void> | void)
          } catch (err) {
            console.error('confirm action error', err)
          }
        }}
        onCancel={() => setConfirmOpen(false)}
      />

      <main className="mx-auto w-full max-w-6xl">
        {/* Header (fades while typing) */}
        <div
          className={`overflow-hidden transition-all duration-700 ease-in-out ${isHeaderVisible ? 'opacity-100 translate-y-0 max-h-[520px]' : 'opacity-0 -translate-y-3 pointer-events-none max-h-0'}`}
        >
          <Header
            user={user}
            signOut={signOut}
            signInWithGoogle={signInWithGoogle}
            streakCount={streakCount}
        />

        </div>

        {/* TOP GRID: Reflect button (1fr) + Input capsule stretched (3fr) */}
        <div className="ms-top-grid mt-8">
          {/* Left: Reflect button (1 part) */}
          <div>
            <button
              onClick={generate24hSummary}
              disabled={isGenerating}
              className={`ms-full-height-btn ${!isGenerating ? 'animate-shimmer' : ''}`}
              title="Reflect on your day"
            >
              <span style={{ fontSize: 18 }}>{isGenerating ? 'Reflecting…' : 'Reflect on your day'}</span>
            </button>
            {showReflectPrompt && !isGenerating && (
              <div className="mt-3 text-sm text-slate-500">✨ Try a quick reflection — or press and hold to record.</div>
            )}
          </div>

          {/* Right: Input capsule (stretched) */}
          <div>
            <div className="ms-input-capsule">
              <EntryInput
                finalText={finalText}
                setFinalText={(text) => {
                  setFinalText(text)
                  handleTyping()
                }}
                interim={interim}
                isRecording={isRecording}
                startRecording={startRecording}
                stopRecording={stopRecording}
                saveTextEntry={saveTextEntry}
                status={status}
                setStatus={setStatus}
                showToast={showToast}
                stretch={true}
              />
            </div>
          </div>
        </div>

        {/* Column headers above the two-column section */}
        <div className="ms-two-col mt-8">
          <div className="ms-column-header">
            <h2>My Reflections</h2>
            <div className="controls">
              <div className="text-sm text-slate-400">{entries.length} items</div>
              <button onClick={() => { /* export logic placeholder */ }} title="Export">Export</button>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-500">View:</label>
                <select
                  value={density === 'compact' ? 'Compact' : 'Comfortable'}
                  onChange={(e) => setDensity(e.target.value === 'Compact' ? 'compact' : 'comfortable')}
                >
                  <option>Comfortable</option>
                  <option>Compact</option>
                </select>
              </div>
            </div>
          </div>

          <div className="ms-column-header">
            <h2>My Summaries</h2>
            <div className="controls">
              <div className="text-sm text-slate-400">{summaries.length} items</div>
              <button onClick={() => { /* export summaries */ }} title="Export">Export</button>
            </div>
          </div>
        </div>

        {/* TWO COLUMNS: left = Reflections list, right = Summaries list */}
        <div className="ms-two-col mt-6">
          {/* LEFT: Reflections */}
          <section>
            <div className={`${density === 'compact' ? 'compact' : ''} space-y-6`}>
              {/* NOTE: removed duplicate EntryInput from list — only the top stretched one remains */}
              {entries.length === 0 ? (
                <div className="text-slate-700 card">Your thoughts will appear here once you start speaking or typing.</div>
              ) : (
                <div className="space-y-4">
                  {entries.map((e) => {
                    const preview = preview20Words(e.content || '')
                    const date = e.created_at ? new Date(e.created_at).toLocaleDateString() : ''
                    const isHighlighted = recentlyAddedId === e.id
                    return (
                      <article key={e.id} className={`card ${isHighlighted ? 'ms-saved ring-2 ring-teal-100' : ''}`} role="article">
                        <div>
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="date-band">{date}</div>
                              <div className="card-preview mt-2">{preview}</div>
                            </div>

                            <div className="flex flex-col items-end gap-3">
                              <div className="card-actions">
                                {/* pin / edit icons kept if you have handlers (placeholders) */}
                                <button title="Edit" onClick={() => { /* optional edit */ }} aria-label="Edit reflection">✏️</button>
                                <button title="Pin" onClick={() => { /* optional pin */ }}>📌</button>
                                <button title="Delete" onClick={() => confirmDeleteEntry(e.id)} aria-label="Delete reflection">🗑️</button>
                              </div>
                            </div>
                          </div>

                          {/* In comfortable mode show timestamp under preview */}
                          {density === 'comfortable' && (
                            <div className="mt-3 text-xs text-slate-400">
                              {e.created_at ? new Date(e.created_at).toLocaleString() : ''}
                            </div>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          {/* RIGHT: Summaries */}
          <section id="your-summaries-section" ref={summariesRef as any}>
            <div className="rounded-lg bg-white p-4 border shadow-sm space-y-6">
              {summaries.length === 0 ? (
                <div className="text-slate-700">No summaries yet — generate one above.</div>
              ) : (
                Object.entries(
                  summaries.reduce((acc: Record<string, SummaryRow[]>, s) => {
                    const key = s.for_date || (s.created_at ? new Date(s.created_at).toLocaleDateString() : 'Other')
                    if (!acc[key]) acc[key] = []
                    acc[key].push(s)
                    return acc
                  }, {})
                ).map(([dateKey, list]) => (
                  <div key={dateKey}>
                    <div className="text-xs text-slate-400 mb-2">{dateKey}</div>
                    <ul className="space-y-3">
                      {list.map((s) => {
                        const isExpanded = expandedSummaryId === s.id
                        const preview = previewText(s.summary_text || '', 220)
                        const highlight = recentlyAddedId === s.id
                        return (
                          <li key={s.id} className={`rounded-md border bg-white overflow-hidden transition-shadow ${highlight ? 'ring-2 ring-teal-200' : ''}`}>
                            <div className="p-4 flex items-start gap-4">
                              <div className="flex-1">
                                <div className="text-sm text-slate-800 leading-snug line-clamp-4">
                                  {preview}
                                </div>
                                <div className="mt-2 text-xs text-slate-400 flex items-center gap-3">
                                  <span>
                                    {s.for_date ?? (s.created_at ? new Date(s.created_at).toLocaleDateString() : '')}
                                  </span>
                                  <span className="text-yellow-500" dangerouslySetInnerHTML={{ __html: renderStarsInline(s.rating) }} />
                                  <span className="text-slate-400">·</span>
                                  <span className="text-slate-500 text-xs">
                                    {s.summary_text?.length ?? 0} chars
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    aria-expanded={isExpanded}
                                    aria-controls={`summary-body-${s.id}`}
                                    onClick={() => setExpandedSummaryId((cur) => (cur === s.id ? null : s.id))}
                                    className="p-3 min-w-[44px] min-h-[44px] rounded-md border bg-white hover:bg-indigo-50"
                                    title={isExpanded ? 'Collapse summary' : 'Expand summary'}
                                  >
                                    <svg className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : 'rotate-0'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>

                                  <button
                                    onClick={() => {
                                      setConfirmTitle('Delete reflection')
                                      setConfirmDesc('Permanently delete this reflection? This action cannot be undone.')
                                      confirmActionRef.current = async () => deleteSavedSummary(s.id)
                                      setConfirmOpen(true)
                                    }}
                                    className="text-xl px-2 py-1 rounded-md hover:bg-rose-50"
                                    title="Delete reflection"
                                    aria-label="Delete reflection"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Expanded body */}
                            <div id={`summary-body-${s.id}`} className="px-4 pb-4 transition-[max-height,opacity] duration-300 ease-in-out overflow-hidden"
                              style={{ maxHeight: isExpanded ? '1200px' : '0px', opacity: isExpanded ? 1 : 0 }}
                              role="region"
                              aria-hidden={!isExpanded}
                            >
                              <div className="mt-2 text-slate-800 leading-relaxed whitespace-pre-wrap">
                                <div dangerouslySetInnerHTML={{ __html: markDownLike(s.summary_text) }} />
                              </div>

                              <div className="mt-3 flex items-center justify-between">
                                <div className="text-xs text-slate-400">
                                  Saved {s.for_date ?? (s.created_at ? new Date(s.created_at).toLocaleString() : '')}
                                </div>
                                <div className="text-sm text-slate-600">
                                  Your rating: <span className="text-yellow-500" dangerouslySetInnerHTML={{ __html: renderStarsInline(s.rating) }} />
                                </div>
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Visual status message */}
        {status && (
          <div className="mt-6 text-sm text-slate-600" aria-live="polite">
            {status}
          </div>
        )}

        <footer className="mt-8 text-xs text-slate-400">
          Private • Encrypted • Yours
        </footer>
      </main>
    </div>
  )
}
