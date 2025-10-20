// pages/index.tsx
import React, { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../lib/supabaseClient'
import Header from '../components/Header'
import EntryInput from '../components/EntryInput'
import SummaryCard from '../components/SummaryCard'
import ToastContainer from '../components/ToastContainer'
import DebugOverlayHelper from '../components/DebugOverlayHelper'
import {
  previewText as previewTextUtil,
  renderStarsInline as renderStarsInlineUtil,
  randomAffirmation,
} from '../lib/ui'

/* ---------- small helpers ---------- */
const previewText = previewTextUtil
const renderStarsInline = renderStarsInlineUtil

function escapeHTML(s: string) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
function safeMarkdown(src: string) {
  // escape first, then allow a tiny subset
  const t = escapeHTML(src || '')
  return t
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') // bold
    .replace(/(^|[\s])\*(.+?)\*(?=[\s.,!?:;)]|$)/g, '$1<em>$2</em>') // italic
    .replace(/(?:^|\n)\s*-\s+(.*)/g, (_m, p1) => `<br/>• ${p1}`) // bullets
    .replace(/(?:^|\n)\s*\d+\.\s+(.*)/g, (_m, p1) => `<br/>• ${p1}`) // numbers
    .replace(/\n/g, '<br/>') // line breaks
}

/* ---------- types ---------- */
type EntryRow = {
  id: string
  content: string
  source?: string
  user_id?: string
  created_at?: string
  pinned?: boolean
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

/* ---------- small modals ---------- */
function ConfirmModal({
  open, title, description, confirmLabel = 'Delete', cancelLabel = 'Cancel', onConfirm, onCancel,
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
      <div className="relative w-full max-w-md rounded-md bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {description && <p className="mt-2 text-sm text-slate-600">{description}</p>}
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onCancel} className="px-3 py-1 border rounded-md text-sm">{cancelLabel}</button>
          <button onClick={() => onConfirm()} className="px-3 py-1 bg-rose-600 text-white rounded-md text-sm" autoFocus>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

/* ===================================================================== */
/*                                PAGE                                    */
/* ===================================================================== */
export default function Home() {
  /* auth + status */
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [toast, setToast] = useState<{ text: string; kind?: 'info' | 'success' | 'error' } | null>(null)

  /* ui */
  const [isHeaderVisible, setIsHeaderVisible] = useState(true)
  const typingTimeout = useRef<NodeJS.Timeout | null>(null)
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => {
    try { return (localStorage.getItem('listDensity') as any) || 'comfortable' } catch { return 'comfortable' }
  })
  useEffect(() => { try { localStorage.setItem('listDensity', density) } catch {} }, [density])

  /* data */
  const [entries, setEntries] = useState<EntryRow[]>([])
  const [summaries, setSummaries] = useState<SummaryRow[]>([])
  const [streakCount, setStreakCount] = useState<number>(0)

  /* generated summary */
  const [generatedSummary, setGeneratedSummary] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSavingRating, setIsSavingRating] = useState(false)

  /* speech */
  const [isRecording, setIsRecording] = useState(false)
  const [interim, setInterim] = useState('')
  const [finalText, setFinalText] = useState('')
  const recogRef = useRef<any>(null)
  const holdingRef = useRef(false)
  const lastStartTimeRef = useRef<number>(0)

  /* ux helpers */
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [expandedSummaryId, setExpandedSummaryId] = useState<string | null>(() => {
    try { return localStorage.getItem('expandedSummaryId') } catch { return null }
  })
  useEffect(() => {
    try {
      expandedSummaryId ? localStorage.setItem('expandedSummaryId', expandedSummaryId)
                        : localStorage.removeItem('expandedSummaryId')
    } catch {}
  }, [expandedSummaryId])
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null)

  /* confirm modal */
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmTitle, setConfirmTitle] = useState('')
  const [confirmDesc, setConfirmDesc] = useState<string | undefined>(undefined)
  const confirmActionRef = useRef<() => Promise<void> | void>(() => {})
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  /* onboarding tip */
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    try { return !localStorage.getItem('ms_seen_onboarding') } catch { return true }
  })
  function dismissOnboarding() { try { localStorage.setItem('ms_seen_onboarding', '1') } catch {}; setShowOnboarding(false) }

  /* toasts */
  function showToast(text: string, kind: 'info' | 'success' | 'error' = 'info', ms = 2500) {
    setToast({ text, kind }); window.setTimeout(() => setToast(null), ms)
  }

  /* ---------------- auth bootstrap ---------------- */
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase.auth.getUser()
        if (data?.user) setUser({ id: data.user.id, email: data.user.email ?? undefined })
      } catch {}
      await fetchEntries(); await fetchSummaries(); await fetchStreak()
    }
    load()

    // correct cleanup for supabase-js v2
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) setUser({ id: session.user.id, email: session.user.email ?? undefined })
      else setUser(null)
      fetchEntries(); fetchSummaries()
    })
    return () => subscription.unsubscribe()
  }, [])

  /* ---------------- auth helpers ---------------- */
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
    setUser(null); setEntries([]); setSummaries([]); setStatus(null)
    showToast('Signed out', 'info')
  }

  /* ---------------- data ops: entries ---------------- */
  const fetchEntries = async () => {
    try {
      const { data: u } = await supabase.auth.getUser()
      const uid = u?.user?.id
      if (!uid) { setEntries([]); return }
      const { data, error } = await supabase
        .from('entries')
        .select('id, content, source, created_at, user_id')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(1000)
      if (error) throw error
      setEntries((data || []).map((d: any) => ({ ...d, pinned: false })))
    } catch { setEntries([]) }
  }

  const saveTextEntry = async (text: string, source = 'text') => {
    try {
      const { data: u } = await supabase.auth.getUser()
      const uid = u?.user?.id
      if (!uid) { showToast('Please sign in to save an entry.', 'info'); return }

      const trimmed = (text || '').normalize('NFC').trim()
      if (!trimmed) { showToast('Cannot save empty entry.', 'info'); return }

      const { data: inserted, error } = await supabase
        .from('entries')
        .insert([{ content: trimmed, source, user_id: uid }])
        .select('*')

      if (error) throw error
      const newRow: any = Array.isArray(inserted) && inserted.length ? inserted[0] : null
      if (newRow) {
        setRecentlyAddedId(newRow.id)
        setEntries((prev) => [{ ...newRow, pinned: false }, ...prev])
        setTimeout(() => setRecentlyAddedId(null), 1600)
      } else {
        await fetchEntries()
      }

      setFinalText('')
      showToast(randomAffirmation(), 'success', 1600)
    } catch (err: any) {
      showToast('Save failed: ' + (err?.message || String(err)), 'error')
    }
  }

  const togglePinEntry = (id: string) => {
    setEntries((p) => p.map((e) => (e.id === id ? { ...e, pinned: !e.pinned } : e)))
    showToast('Toggled pin', 'info', 900)
  }

  const confirmDeleteEntry = (entryId: string) => {
    setConfirmTitle('Delete entry')
    setConfirmDesc('Permanently delete this entry? This action cannot be undone.')
    confirmActionRef.current = async () => {
      setPendingDeleteId(entryId)
      setEntries((p) => p.filter((e) => e.id !== entryId))
      try {
        const { error } = await supabase.from('entries').delete().eq('id', entryId)
        if (error) throw error
        showToast('Entry deleted', 'info')
      } catch {
        await fetchEntries()
      } finally {
        setPendingDeleteId(null)
      }
    }
    setConfirmOpen(true)
  }

  /* ---------------- data ops: summaries ---------------- */
  const fetchSummaries = async () => {
    try {
      const { data: u } = await supabase.auth.getUser()
      const uid = u?.user?.id
      if (!uid) { setSummaries([]); return }
      const { data, error } = await supabase
        .from('summaries')
        .select('id, summary_text, created_at, rating, for_date, user_id, range_start, range_end')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      setSummaries(data || [])
      if (expandedSummaryId && !(data || []).some((s) => s.id === expandedSummaryId)) setExpandedSummaryId(null)
    } catch { setSummaries([]) }
  }

  const deleteSavedSummary = async (summaryId: string) => {
    setPendingDeleteId(summaryId)
    setSummaries((p) => p.filter((x) => x.id !== summaryId))
    try {
      const { error } = await supabase.from('summaries').delete().eq('id', summaryId)
      if (error) throw error
      showToast('Reflection deleted', 'info')
    } catch (err: any) {
      showToast('Could not delete reflection: ' + (err?.message || String(err)), 'error')
      await fetchSummaries()
    } finally {
      setPendingDeleteId(null)
    }
  }

  /* ---------------- streak ---------------- */
  const fetchStreak = async () => {
    try {
      const { data: u } = await supabase.auth.getUser()
      const uid = u?.user?.id
      if (!uid) return
      const { data, error } = await supabase.from('user_stats').select('streak_count').eq('user_id', uid).single()
      if (!error && data) setStreakCount(data.streak_count || 0)
    } catch {}
  }

  /* ---------------- header fade on typing ---------------- */
  function handleTyping() {
    setIsHeaderVisible(false)
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => setIsHeaderVisible(true), 4000)
  }

  /* ---------------- speech recognition ---------------- */
  useEffect(() => {
    const Recog = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null
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
      for (let i = event.resultIndex; i < event.results.length; i++) {
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
      holdingRef.current = false
      setIsRecording(false)
      showToast('Recognition error: ' + e.error, 'error')
    }

    r.onend = () => {
      if (holdingRef.current) {
        const now = Date.now()
        if (now - lastStartTimeRef.current > 1000) {
          try { lastStartTimeRef.current = now; recogRef.current?.start() } catch {}
        }
      } else {
        setIsRecording(false)
      }
    }

    return () => { recogRef.current = null }
  }, [])

  const startRecording = () => {
    if (!recogRef.current) { showToast('Speech API not available in this browser', 'info'); return }
    try {
      holdingRef.current = true
      lastStartTimeRef.current = Date.now()
      recogRef.current.start()
      setIsRecording(true)
      setInterim('')
      setFinalText('')
      setStatus('Recording...')
    } catch (err: any) {
      setStatus('Mic error: ' + err?.message)
      showToast('Mic error: ' + err?.message, 'error')
      holdingRef.current = false
    }
  }

  const stopRecording = () => {
    holdingRef.current = false
    try { recogRef.current?.stop() } catch {}
    setIsRecording(false)
    const text = (finalText + (interim ? ' ' + interim : '')).trim()
    setInterim('')
    if (!text) { setStatus('No speech captured.'); return }
    setFinalText(text)
    setStatus('Transcription ready — edit if needed, then click Save.')
    showToast('Transcription ready — edit and press Save', 'info')
  }

  /* ---------------- generate + save summary ---------------- */
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
      if (!entries24?.length) { showToast('No entries in the past 24 hours', 'info'); setIsGenerating(false); return }

      setStatus('Generating reflection — please wait...')
      const resp = await fetch('/api/generate-summary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: entries24 })
      })
      const payload = await resp.json()
      if (!resp.ok) { console.error(payload); showToast('Couldn’t generate reflection right now', 'error'); setIsGenerating(false); return }
      setGeneratedSummary(payload.summary)
      setGeneratedAt(new Date().toISOString())
      showToast('Reflection ready', 'success')
    } catch {
      showToast('Generation failed', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

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
      if (!uid) { showToast('Please sign in to save the reflection', 'info'); setIsSavingRating(false); return }

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const upto = new Date().toISOString()
      const todayIso = new Date().toISOString().slice(0, 10)

      const insertResp = await supabase
        .from('summaries')
        .insert([{ user_id: uid, range_start: since, range_end: upto, for_date: todayIso, summary_text: generatedSummary, rating }])
        .select('*')
      const { data: inserted, error } = insertResp as any
      if (error) throw error

      const newRow = Array.isArray(inserted) && inserted.length ? inserted[0] : null
      if (newRow) {
        setSummaries((prev) => [newRow, ...prev])
        setExpandedSummaryId(newRow.id)
        setRecentlyAddedId(newRow.id)
        setTimeout(() => { setExpandedSummaryId(null); setRecentlyAddedId(null) }, 2600)
      } else {
        await fetchSummaries()
      }

      setGeneratedSummary(null)
      setGeneratedAt(null)
      setHoverRating(0)

      try {
        await fetch('/api/user-stats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: uid, for_date: todayIso }) })
      } catch {}
      try { await fetchStreak() } catch {}
      setTimeout(() => { document.getElementById('your-summaries-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, 250)
    } catch (err: any) {
      showToast('Could not save reflection: ' + (err?.message || String(err)), 'error')
    } finally {
      setIsSavingRating(false)
    }
  }

  /* ---------------- exports ---------------- */
  function exportReflectionsAsMarkdown() {
    const md = entries.map((e) => `- ${new Date(e.created_at || '').toLocaleString()}\n\n${e.content}\n`).join('\n\n')
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `mindstream-reflections-${new Date().toISOString().slice(0,10)}.md`
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }
  function exportSummariesAsMarkdown() {
    const md = summaries.map((s) => `## ${s.for_date || (new Date(s.created_at || '')).toLocaleString()}\n\n${s.summary_text}\n`).join('\n\n')
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `mindstream-summaries-${new Date().toISOString().slice(0,10)}.md`
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }

  /* ---------------- utils: group entries by date (robust) ---------------- */
  function groupEntriesByDate(entriesList: EntryRow[]) {
    const byDate: Record<string, EntryRow[]> = {}
    entriesList.forEach((e) => {
      const key = e.created_at ? e.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)
      if (!byDate[key]) byDate[key] = []
      byDate[key].push(e)
    })
    const sorted = Object.keys(byDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    // Show Today/Yesterday labels if they exist
    const todayKey = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayKey = yesterday.toISOString().slice(0, 10)

    const groups: { title: string; items: EntryRow[] }[] = []
    if (byDate[todayKey]) groups.push({ title: 'Today', items: byDate[todayKey] })
    if (byDate[yesterdayKey]) groups.push({ title: 'Yesterday', items: byDate[yesterdayKey] })
    sorted.filter((k) => k !== todayKey && k !== yesterdayKey)
          .forEach((k) => groups.push({ title: new Date(k).toLocaleDateString(), items: byDate[k] }))
    return groups
  }

  /* ---------------- typing fade ---------------- */
  function handleTyping() {
    setIsHeaderVisible(false)
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => setIsHeaderVisible(true), 4000)
  }

  /* ============================= RENDER ============================= */

  // LEFT COLUMN — NOTE: NO EntryInput here (Option A)
  const LeftColumn = (
    <>
      {generatedSummary && (
        <SummaryCard
          summary={generatedSummary}
          generatedAt={generatedAt}
          isSavingRating={isSavingRating}
          hoverRating={hoverRating}
          setHoverRating={setHoverRating}
          saveRatedSummary={saveRatedSummary}
          discardSummary={() => { setGeneratedSummary(null); setGeneratedAt(null); showToast('Reflection discarded', 'info') }}
        />
      )}

      <section className={`mb-12 ${density === 'compact' ? 'text-sm' : ''}`}>
        <div className="rounded-lg bg-white p-4 border shadow-sm">
          {entries.length === 0 ? (
            <div className="text-slate-700">Your thoughts will appear here once you start speaking or typing.</div>
          ) : (
            <ul className="space-y-4">
              {groupEntriesByDate(entries).map((group) => (
                <li key={group.title}>
                  <div className="date-band mb-3 text-xs text-slate-400">{group.title}</div>
                  <ul className="space-y-3">
                    {group.items.map((e) => (
                      <li key={e.id} className={`rounded-md border bg-white overflow-hidden transition-shadow ${recentlyAddedId === e.id ? 'ring-2 ring-teal-200' : ''} ${e.pinned ? 'border-indigo-200' : ''}`}>
                        <div className="p-4 flex items-start gap-4">
                          <div className="flex-1">
                            <div className={`text-slate-800 whitespace-pre-wrap ${density === 'compact' ? 'line-clamp-2' : ''}`}>{e.content}</div>
                            <div className="mt-2 text-xs text-slate-400">{new Date(e.created_at || Date.now()).toLocaleString()}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => togglePinEntry(e.id)} title="Pin" className="p-2 rounded-md hover:bg-slate-50">📌</button>
                            <button onClick={() => { navigator.clipboard?.writeText(e.content); showToast('Copied', 'success') }} title="Copy" className="p-2 rounded-md hover:bg-slate-50">⎘</button>
                            <button onClick={() => confirmDeleteEntry(e.id)} title="Delete" className="p-2 rounded-md hover:bg-rose-50">🗑️</button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  )

  // RIGHT COLUMN — saved summaries
  const RightColumn = (
    <div>
      <div className="rounded-lg bg-white p-4 border shadow-sm space-y-6 mt-3">
        {summaries.length === 0 && <div className="text-slate-700">No summaries yet — generate one above.</div>}
        {summaries.map((s) => {
          const isExpanded = expandedSummaryId === s.id
          const preview = previewText(s.summary_text || '', 220)
          const highlight = recentlyAddedId === s.id
          return (
            <div key={s.id} className={`rounded-md border bg-white overflow-hidden transition-shadow ${highlight ? 'ring-2 ring-teal-200' : ''}`}>
              <div className="p-4 flex items-start gap-4">
                <div className="flex-1">
                  <div className="text-sm text-slate-800 leading-snug line-clamp-4">{preview}</div>
                  <div className="mt-2 text-xs text-slate-400 flex items-center gap-3">
                    <span>{s.for_date ?? (s.created_at ? new Date(s.created_at).toLocaleDateString() : '')}</span>
                    <span className="text-yellow-500" dangerouslySetInnerHTML={{ __html: renderStarsInline(s.rating) }} />
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500 text-xs">{s.summary_text?.length ?? 0} chars</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    aria-expanded={isExpanded}
                    aria-controls={`summary-body-${s.id}`}
                    onClick={() => setExpandedSummaryId((cur) => (cur === s.id ? null : s.id))}
                    className="p-3 min-w-[44px] min-h-[44px] rounded-md border bg-white hover:bg-indigo-50"
                    title={isExpanded ? 'Collapse summary' : 'Expand summary'}
                  >
                    <svg className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : 'rotate-0'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  <button onClick={() => { navigator.clipboard?.writeText(s.summary_text || ''); showToast('Copied summary', 'success') }} title="Copy" className="p-2 rounded-md hover:bg-slate-50">⎘</button>
                  <button onClick={() => { setConfirmTitle('Delete reflection'); setConfirmDesc('Permanently delete this reflection?'); confirmActionRef.current = async () => { await deleteSavedSummary(s.id) }; setConfirmOpen(true) }} className="p-2 rounded-md hover:bg-rose-50" title="Delete">🗑️</button>
                </div>
              </div>

              {/* Expanded body — XSS-safe */}
              <div
                id={`summary-body-${s.id}`}
                className="px-4 pb-4 transition-[max-height,opacity] duration-300 ease-in-out overflow-hidden"
                style={{ maxHeight: isExpanded ? '1200px' : '0px', opacity: isExpanded ? 1 : 0 }}
                role="region"
                aria-hidden={!isExpanded}
              >
                <div className="mt-2 text-slate-800 leading-relaxed whitespace-pre-wrap">
                  <div dangerouslySetInnerHTML={{ __html: safeMarkdown(s.summary_text || '') }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  /* ---------------- layout ---------------- */
  return (
    <>
      <Head><title>Mindstream — Calm private journaling</title></Head>

      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white p-8">
        <ToastContainer toast={toast} />
        <DebugOverlayHelper />

        <main className="mx-auto w-full max-w-3xl">
          {/* header */}
          <div className={`overflow-hidden transition-all duration-700 ease-in-out ${isHeaderVisible ? 'opacity-100 translate-y-0 max-h-[520px]' : 'opacity-0 -translate-y-3 pointer-events-none max-h-0'}`}>
            <Header
              user={user}
              email={email}
              setEmail={setEmail}
              signOut={signOut}
              sendMagicLink={sendMagicLink}
              signInWithGoogle={signInWithGoogle}
              streakCount={streakCount}
            />
          </div>

          {/* top 3:1 grid — the ONLY EntryInput */}
          <div className="ms-top-grid mt-6">
            <div className="flex items-stretch">
              <button
                onClick={generate24hSummary}
                disabled={isGenerating}
                className={`ms-full-height-btn bg-indigo-600 text-white text-base font-medium transition-all duration-300 rounded-lg ${isGenerating ? 'opacity-70 cursor-wait' : 'hover:bg-indigo-700'} ${!isGenerating ? 'animate-shimmer' : ''}`}
                title="Reflect on your day"
              >
                {isGenerating ? 'Reflecting...' : 'Reflect on your day'}
              </button>
            </div>
            <div className="flex items-stretch">
              <EntryInput
                finalText={finalText}
                setFinalText={(t) => { setFinalText(t); handleTyping() }}
                interim={interim}
                isRecording={isRecording}
                startRecording={startRecording}
                stopRecording={stopRecording}
                saveTextEntry={saveTextEntry}
                status={status}
                setStatus={setStatus}
                showToast={showToast}
                stretch
              />
            </div>
          </div>

          {/* two-column headers */}
          <div className="ms-two-col mt-8 items-start">
            <div className="ms-column-header flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold text-slate-700">My Reflections</span>
                <span className="text-xs text-slate-400">{entries.length} items</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={exportReflectionsAsMarkdown} className="px-2 py-1 text-xs border rounded-md">Export</button>
                <div className="text-xs text-slate-500">View:</div>
                <select value={density} onChange={(e) => setDensity(e.target.value as any)} className="text-sm border rounded-md px-2 py-1">
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
              </div>
            </div>

            <div className="ms-column-header flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold text-slate-700">My Summaries</span>
                <span className="text-xs text-slate-400">{summaries.length} items</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={exportSummariesAsMarkdown} className="px-2 py-1 text-xs border rounded-md">Export</button>
              </div>
            </div>

            {/* columns */}
            <div>{LeftColumn}</div>
            <div id="your-summaries-section">{RightColumn}</div>
          </div>

          {/* onboarding tip */}
          {showOnboarding && (
            <div className="mt-3 p-3 bg-indigo-600 text-white rounded-md shadow-md max-w-sm">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="font-semibold">Welcome to Mindstream</div>
                  <div className="text-sm mt-1">Type freely or hold the mic to record. Your voice stays in the browser.</div>
                </div>
                <div className="pl-3">
                  <button onClick={dismissOnboarding} className="text-xs underline">Got it</button>
                </div>
              </div>
            </div>
          )}

          {status && <div className="mt-6 text-sm text-slate-600" aria-live="polite">{status}</div>}
          <div aria-live="polite" aria-atomic="true" className="sr-only">{status}</div>

          <footer className="mt-8 text-xs text-slate-400">Private • Encrypted • Yours</footer>
        </main>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title={confirmTitle}
        description={confirmDesc}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={async () => { setConfirmOpen(false); try { await (confirmActionRef.current?.()) } finally { confirmActionRef.current = () => {} } }}
        onCancel={() => { setConfirmOpen(false); confirmActionRef.current = () => {} }}
      />
    </>
  )
}
