// pages/index.tsx
import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Header from '../components/Header'
import EntryInput from '../components/EntryInput'
import ToastContainer from '../components/ToastContainer'
import SummaryCard from '../components/SummaryCard'
import DebugOverlayHelper from '../components/DebugOverlayHelper'
import EmptyState from '../components/EmptyState'

import {
  previewText as previewTextUtil,
  markDownLike as markDownLikeUtil,
  renderStarsInline as renderStarsInlineUtil,
  randomAffirmation
} from '../lib/ui'

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

/* util aliases */
const previewText = previewTextUtil
const markDownLike = markDownLikeUtil
const renderStarsInline = renderStarsInlineUtil

/* small inline Toast */
function Toast({ text, kind = 'info' }: { text: string; kind?: 'info' | 'success' | 'error' }) {
  const bg = kind === 'success' ? 'bg-teal-600' : kind === 'error' ? 'bg-rose-600' : 'bg-slate-700'
  return <div className={`text-white ${bg} px-3 py-2 rounded-md shadow-md text-sm`}>{text}</div>
}

/* Confirm modal */
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
          <button onClick={onCancel} className="px-3 py-1 border rounded-md text-sm">{cancelLabel}</button>
          <button onClick={() => onConfirm()} className="px-3 py-1 bg-rose-600 text-white rounded-md text-sm">{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

/* Edit modal */
function EditModal({
  open,
  initial,
  onSave,
  onCancel,
}: {
  open: boolean
  initial: string
  onSave: (text: string) => Promise<void> | void
  onCancel: () => void
}) {
  const [val, setVal] = useState(initial)
  useEffect(() => setVal(initial), [initial])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative z-60 w-full max-w-2xl rounded-md bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-slate-900">Edit reflection</h3>
        <textarea className="w-full mt-3 p-3 border rounded-md min-h-[120px] focus:outline-none" value={val} onChange={(e) => setVal(e.target.value)} />
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onCancel} className="px-3 py-1 border rounded-md text-sm">Cancel</button>
          <button onClick={async () => { await onSave(val) }} className="px-3 py-1 bg-indigo-600 text-white rounded-md text-sm">Save</button>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Main Page ---------------- */
export default function Home() {
  /* global UI */
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [toast, setToast] = useState<{ text: string; kind?: 'info' | 'success' | 'error' } | null>(null)

  /* header fade */
  const [isHeaderVisible, setIsHeaderVisible] = useState(true)
  const typingTimeout = useRef<NodeJS.Timeout | null>(null)

  /* data */
  const [entries, setEntries] = useState<EntryRow[]>([])
  const [summaries, setSummaries] = useState<SummaryRow[]>([])
  const [streakCount, setStreakCount] = useState<number>(0)

  /* generated */
  const [generatedSummary, setGeneratedSummary] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSavingRating, setIsSavingRating] = useState(false)

  /* voice */
  const [isRecording, setIsRecording] = useState(false)
  const [interim, setInterim] = useState('')
  const [finalText, setFinalText] = useState('')
  const recogRef = useRef<any>(null)
  const holdingRef = useRef(false)

  /* UI helpers */
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [expandedSummaryId, setExpandedSummaryId] = useState<string | null>(() => {
    try { if (typeof window !== 'undefined') return localStorage.getItem('expandedSummaryId') } catch {} return null
  })
  useEffect(() => {
    try {
      if (expandedSummaryId) {
        localStorage.setItem('expandedSummaryId', expandedSummaryId)
      } else {
        localStorage.removeItem('expandedSummaryId')
      }
    } catch (e) {
    // ignore localStorage errors (privacy/incognito)
    }
  }, [expandedSummaryId])

  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null)

  /* confirm modal */
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmTitle, setConfirmTitle] = useState('')
  const [confirmDesc, setConfirmDesc] = useState<string | undefined>(undefined)
  const confirmActionRef = useRef<() => Promise<void> | void>(() => {})
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const summariesRef = useRef<HTMLDivElement | null>(null)

  /* density (comfortable / compact) */
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => {
    try { return (localStorage.getItem('listDensity') as 'comfortable' | 'compact') || 'comfortable' } catch { return 'comfortable' }
  })
  useEffect(() => { try { localStorage.setItem('listDensity', density) } catch {} }, [density])

  /* onboarding tooltip show once */
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    try { return !localStorage.getItem('ms_seen_onboarding') } catch { return true }
  })
  const dismissOnboarding = () => { try { localStorage.setItem('ms_seen_onboarding', '1') } catch {} ; setShowOnboarding(false) }

  /* edit modal */
  const [editOpen, setEditOpen] = useState(false)
  const [editInitial, setEditInitial] = useState('')
  const [editSaveHandler, setEditSaveHandler] = useState<((t: string) => Promise<void>) | null>(null)

  /* confetti dom ref */
  const confettiRef = useRef<HTMLDivElement | null>(null)

  /* showToast */
  function showToast(text: string, kind: 'info' | 'success' | 'error' = 'info', ms = 2400) {
    setToast({ text, kind })
    window.setTimeout(() => setToast(null), ms)
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
      if (session?.user) setUser({ id: session.user.id, email: session.user.email ?? undefined }) else setUser(null)
      fetchEntries()
      fetchSummaries()
    })
    return () => sub.subscription.unsubscribe()
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

  /* ---------------- CRUD entries ---------------- */
  const fetchEntries = async () => {
    try {
      const { data: u } = await supabase.auth.getUser()
      const uid = u?.user?.id
      if (!uid) { setEntries([]); return }
      const { data, error } = await supabase.from('entries').select('id, content, source, created_at, user_id').eq('user_id', uid).order('created_at', { ascending: false }).limit(1000)
      if (error) throw error
      setEntries((data || []).map((d: any) => ({ ...d, pinned: false })))
    } catch (err) { console.error('fetchEntries', err); setEntries([]) }
  }

  const saveTextEntry = async (text: string, source = 'text') => {
    try {
      const { data: u } = await supabase.auth.getUser()
      const uid = u?.user?.id
      if (!uid) { showToast('Please sign in to save an entry.', 'info'); return }
      const trimmed = (text || '').trim()
      if (!trimmed) { showToast('Cannot save empty entry.', 'info'); return }

      const { data: inserted, error } = await supabase.from('entries').insert([{ content: trimmed, source, user_id: uid }]).select('*')
      if (error) throw error
      const newRow: any = Array.isArray(inserted) && inserted.length ? inserted[0] : null
      if (newRow) {
        setRecentlyAddedId(newRow.id)
        setEntries((prev) => [ { ...newRow, pinned: false }, ...prev ])
        setTimeout(() => setRecentlyAddedId(null), 1600)
      } else {
        await fetchEntries()
      }
      setFinalText('')
      showToast(randomAffirmation(), 'success', 1600)

      // small saved animation via DOM
      try {
        const el = confettiRef.current
        if (el) {
          // create a few confetti nodes
          for (let i = 0; i < 8; i++) {
            const sp = document.createElement('span')
            sp.style.left = `${30 + Math.random() * 40}%`
            sp.style.top = `${20 + Math.random() * 10}%`
            sp.style.background = i % 2 ? 'var(--ms-accent-start)' : 'var(--ms-accent-end)'
            el.appendChild(sp)
            sp.className = 'confetti-dot'
            // animate and remove
            setTimeout(() => sp.remove(), 900)
          }
          el.classList.add('show-confetti')
          setTimeout(() => el.classList.remove('show-confetti'), 1000)
        }
      } catch (e) {}
    } catch (err: any) { console.error('saveTextEntry', err); showToast('Save failed: ' + (err?.message || String(err)), 'error') }
  }

  const togglePinEntry = (id: string) => { setEntries((prev) => prev.map((e) => e.id === id ? { ...e, pinned: !e.pinned } : e )); showToast('Toggled pin', 'info', 900) }

  const openEditEntry = (e: EntryRow) => {
    setEditInitial(e.content)
    setEditOpen(true)
    setEditSaveHandler(async (text: string) => {
      try {
        setEntries((prev) => prev.map((x) => (x.id === e.id ? { ...x, content: text } : x)))
        const { error } = await supabase.from('entries').update({ content: text }).eq('id', e.id)
        if (error) throw error
        showToast('Updated entry', 'success')
      } catch (err: any) {
        console.error('edit entry error', err)
        showToast('Could not save edit', 'error')
        await fetchEntries()
      } finally { setEditOpen(false); setEditSaveHandler(null) }
    })
  }

  const confirmDeleteEntry = (entryId: string) => {
    setConfirmTitle('Delete entry')
    setConfirmDesc('Permanently delete this entry? This action cannot be undone.')
    confirmActionRef.current = async () => {
      setPendingDeleteId(entryId)
      setEntries((prev) => prev.filter((e) => e.id !== entryId))
      try {
        const { error } = await supabase.from('entries').delete().eq('id', entryId)
        if (error) throw error
        showToast('Entry deleted', 'info')
      } catch (err: any) {
        console.error('delete entry failed', err)
        showToast('Could not delete entry: ' + (err?.message || String(err)), 'error')
        await fetchEntries()
      } finally { setPendingDeleteId(null) }
    }
    setConfirmOpen(true)
  }

  /* ---------------- CRUD summaries ---------------- */
  const fetchSummaries = async () => {
    try {
      const { data: u } = await supabase.auth.getUser()
      const uid = u?.user?.id
      if (!uid) { setSummaries([]); return }
      const { data, error } = await supabase.from('summaries').select('id, summary_text, created_at, rating, for_date, user_id, range_start, range_end').eq('user_id', uid).order('created_at', { ascending: false }).limit(500)
      if (error) throw error
      setSummaries(data || [])
    } catch (err) { console.error('fetchSummaries', err); setSummaries([]) }
  }

  const deleteSavedSummary = async (summaryId: string) => {
    setPendingDeleteId(summaryId)
    setSummaries((prev) => prev.filter((x) => x.id !== summaryId))
    try {
      const { error } = await supabase.from('summaries').delete().eq('id', summaryId)
      if (error) throw error
      showToast('Reflection deleted', 'info')
    } catch (err: any) { console.error('delete summary failed', err); showToast('Could not delete reflection: ' + (err?.message || String(err)), 'error'); await fetchSummaries() } finally { setPendingDeleteId(null) }
  }

  /* streak */
  const fetchStreak = async () => {
    try {
      const { data: u } = await supabase.auth.getUser()
      const uid = u?.user?.id
      if (!uid) return
      const { data, error } = await supabase.from('user_stats').select('streak_count').eq('user_id', uid).single()
      if (!error && data) setStreakCount(data.streak_count || 0)
    } catch (err) { console.error('fetchStreak error', err) }
  }

  /* typing handling */
  function handleTyping() {
    setIsHeaderVisible(false)
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => { setIsHeaderVisible(true) }, 4000)
  }

  /* idle prompt */
  const [showReflectPrompt, setShowReflectPrompt] = useState(false)
  useEffect(() => {
    const idleTimer = setTimeout(() => setShowReflectPrompt(true), 10000)
    const resetIdle = () => setShowReflectPrompt(false)
    window.addEventListener('keydown', resetIdle); window.addEventListener('mousemove', resetIdle); window.addEventListener('click', resetIdle)
    return () => { clearTimeout(idleTimer); window.removeEventListener('keydown', resetIdle); window.removeEventListener('mousemove', resetIdle); window.removeEventListener('click', resetIdle) }
  }, [finalText, entries])

  /* voice recognition */
  useEffect(() => {
    const Recog = window.SpeechRecognition || window.webkitSpeechRecognition || null
    if (!Recog) return
    const r = new Recog()
    recogRef.current = r
    r.lang = 'en-US'; r.interimResults = true; r.maxAlternatives = 1; r.continuous = false

    r.onresult = (event: any) => {
      let interimT = ''
      let finalT = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const res = event.results[i]
        if (res.isFinal) finalT += res[0].transcript
        else interimT += res[0].transcript
      }
      if (interimT) setInterim(interimT)
      if (finalT) { setFinalText((s) => (s ? s + ' ' + finalT : finalT)); setInterim('') }
    }

    r.onerror = (e: any) => { console.error('SpeechRecognition error', e); showToast('Recognition error: ' + e.error, 'error'); setIsRecording(false) }
    r.onend = () => {
      if (holdingRef.current) { setTimeout(() => { try { recogRef.current?.start() } catch {} }, 150) } else setIsRecording(false)
    }
    return () => { recogRef.current = null }
  }, [])

  const startRecording = () => {
    if (!recogRef.current) { showToast('Speech API not available in this browser', 'info'); return }
    try { holdingRef.current = true; recogRef.current.start(); setIsRecording(true); setInterim(''); setFinalText(''); setStatus('Recording...') } catch (err: any) { setStatus('Mic error: ' + err?.message); showToast('Mic error: ' + err?.message, 'error') }
  }

  const stopRecording = async () => {
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

  /* generate */
  async function generate24hSummary() {
    try {
      setIsGenerating(true)
      setStatus('Loading recent entries...')
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data: entries24, error } = await supabase.from('entries').select('id, content, created_at, source').gte('created_at', since).order('created_at', { ascending: true })
      if (error) throw error
      if (!entries24?.length) { showToast('No entries in the past 24 hours', 'info'); setIsGenerating(false); return }
      setStatus('Generating reflection — please wait...')
      const resp = await fetch('/api/generate-summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entries: entries24 }) })
      const payload = await resp.json()
      if (!resp.ok) { console.error('generate error payload', payload); showToast('Couldn’t generate reflection right now', 'error'); setIsGenerating(false); return }
      setGeneratedSummary(payload.summary); setGeneratedAt(new Date().toISOString()); showToast('Reflection ready', 'success')
    } catch (err: any) { console.error('generate24hSummary', err); showToast('Generation failed', 'error') } finally { setIsGenerating(false) }
  }

  /* save rated summary */
  async function saveRatedSummary(rating: number) {
    if (!generatedSummary) return
    try {
      setIsSavingRating(true); setStatus('Saving reflection...')
      const { data: u } = await supabase.auth.getUser()
      let uid = u?.user?.id
      if (!uid) { const { data: sess } = await supabase.auth.getSession(); uid = (sess as any)?.session?.user?.id }
      if (!uid) { showToast('Please sign in to save the reflection', 'info'); setIsSavingRating(false); return }
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const upto = new Date().toISOString()
      const todayIso = new Date().toISOString().slice(0, 10)
      const insertResp = await supabase.from('summaries').insert([{ user_id: uid, range_start: since, range_end: upto, for_date: todayIso, summary_text: generatedSummary, rating }]).select('*')
      const { data: inserted, error } = insertResp as any
      if (error) throw error
      const newRow = Array.isArray(inserted) && inserted.length ? inserted[0] : null
      if (newRow) {
        setSummaries((prev) => [newRow, ...prev])
        setRecentlyAddedId(newRow.id)
        setExpandedSummaryId(newRow.id)
        setTimeout(() => { setExpandedSummaryId(null); setRecentlyAddedId(null) }, 2600)
      } else { await fetchSummaries() }
      setGeneratedSummary(null); setGeneratedAt(null); setHoverRating(0)

      try { await fetch('/api/user-stats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: uid, for_date: todayIso }) }) } catch (err) { console.warn('streak update failed', err) }
      try { await fetchStreak() } catch (err) {}
      setTimeout(() => { const el = document.getElementById('your-summaries-section'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, 250)
    } catch (err: any) { console.error('saveRatedSummary error', err); showToast('Could not save reflection: ' + (err?.message || String(err)), 'error') } finally { setIsSavingRating(false) }
  }

  /* export helpers */
  function exportReflectionsAsMarkdown() {
    const md = entries.map((e) => `- ${new Date(e.created_at || '').toLocaleString()}\n\n${e.content}\n`).join('\n\n')
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `mindstream-reflections-${new Date().toISOString().slice(0,10)}.md`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }
  function exportSummariesAsMarkdown() {
    const md = summaries.map((s) => `## ${s.for_date || (new Date(s.created_at || '')).toLocaleDateString()}\n\n${s.summary_text}\n`).join('\n\n')
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `mindstream-summaries-${new Date().toISOString().slice(0,10)}.md`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }

  /* grouping utility */
  function groupEntriesByDate(entriesList: EntryRow[]) {
    const today = new Date()
    const groups: { title: string; items: EntryRow[] }[] = []
    const byDate: Record<string, EntryRow[]> = {}
    entriesList.forEach((e) => {
      const dKey = e.created_at ? e.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)
      if (!byDate[dKey]) byDate[dKey] = []
      byDate[dKey].push(e)
    })
    const sortedKeys = Object.keys(byDate).sort((a, b) => (a > b ? -1 : 1))
    const todayKey = today.toISOString().slice(0, 10)
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1); const yesterdayKey = yesterday.toISOString().slice(0, 10)
    const todayItems = byDate[todayKey] || []
    const yesterdayItems = byDate[yesterdayKey] || []
    const otherKeys = sortedKeys.filter((k) => k !== todayKey && k !== yesterdayKey)
    if (todayItems.length) groups.push({ title: 'Today', items: todayItems })
    if (yesterdayItems.length) groups.push({ title: 'Yesterday', items: yesterdayItems })
    otherKeys.forEach((k) => groups.push({ title: new Date(k).toLocaleDateString(), items: byDate[k] }))
    return groups
  }

  /* confirm + edit modal nodes */
  const ConfirmModalNode = (
    <ConfirmModal open={confirmOpen} title={confirmTitle} description={confirmDesc} confirmLabel="Delete" cancelLabel="Cancel" onConfirm={async () => { setConfirmOpen(false); try { await confirmActionRef.current() } catch (err) { console.error('confirm action error', err) } }} onCancel={() => setConfirmOpen(false)} />
  )
  const EditModalNode = editOpen && editSaveHandler ? <EditModal open={editOpen} initial={editInitial} onSave={async (text) => await editSaveHandler(text)} onCancel={() => { setEditOpen(false); setEditSaveHandler(null) }} /> : null

  /* LEFT column content (EntryInput + generated preview + entries list) */
  const LeftColumn = (
    <>
      <div className="mb-4">
        <EntryInput finalText={finalText} setFinalText={(text) => { setFinalText(text); handleTyping() }} interim={interim} isRecording={isRecording} startRecording={startRecording} stopRecording={stopRecording} saveTextEntry={saveTextEntry} status={status} setStatus={setStatus} showToast={showToast} stretch={true} />
        {showOnboarding && <div className="mt-3"><div className="p-3 bg-indigo-600 text-white rounded-md shadow-md max-w-sm"><div className="flex justify-between"><div><div className="font-semibold">Welcome to Mindstream</div><div className="text-sm mt-1">Type freely or hold the mic to record. Your voice stays in the browser.</div></div><div className="pl-3"><button onClick={dismissOnboarding} className="text-xs underline">Got it</button></div></div></div></div>}
      </div>

      {generatedSummary && <SummaryCard summary={generatedSummary} generatedAt={generatedAt} isSavingRating={isSavingRating} hoverRating={hoverRating} setHoverRating={setHoverRating} saveRatedSummary={saveRatedSummary} discardSummary={() => { setGeneratedSummary(null); setGeneratedAt(null); setStatus('Reflection discarded.'); showToast('Reflection discarded', 'info') }} />}

      <section className={`mb-12 ${density === 'compact' ? 'compact' : ''}`}>
        <div className="card">
          {entries.length === 0 ? (
            <EmptyState title="Start your first reflection" description="Type or hold the mic to record. Your thoughts are private and stored only for you." ctaLabel="Start recording" onCta={startRecording} />
          ) : (
            <ul className="space-y-4">
              {groupEntriesByDate(entries).map((group) => (
                <li key={group.title}>
                  <div className="date-band mb-3">{group.title}</div>
                  <ul className="space-y-3">
                    {group.items.map((e) => (
                      <li key={e.id} className={`rounded-md border bg-white overflow-hidden transition-shadow ${recentlyAddedId === e.id ? 'ring-2 ring-teal-200' : ''} ${e.pinned ? 'border-indigo-200' : ''}`}>
                        <div className="p-4 flex items-start gap-4">
                          <div className="flex-1">
                            <div className={`text-slate-800 whitespace-pre-wrap ${density === 'compact' ? 'line-clamp-2' : ''}`}>{e.content}</div>
                            <div className="mt-2 text-xs text-slate-400">{new Date(e.created_at || Date.now()).toLocaleString()}</div>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <div className="card-actions">
                              <button onClick={() => openEditEntry(e)} title="Edit" className="p-2 rounded-md hover:bg-slate-50">✎</button>
                              <button onClick={() => togglePinEntry(e.id)} title="Pin" className={`p-2 rounded-md hover:bg-slate-50 ${e.pinned ? '' : ''}`}>📌</button>
                              <button onClick={() => { navigator.clipboard?.writeText(e.content); showToast('Copied', 'success') }} title="Copy" className="p-2 rounded-md hover:bg-slate-50">⎘</button>
                              <button onClick={() => confirmDeleteEntry(e.id)} title="Delete" className="p-2 rounded-md hover:bg-rose-50">🗑️</button>
                            </div>
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

  /* RIGHT column (summaries) */
  const RightColumn = (
    <div>
      <div className="card">
        {summaries.length === 0 ? (
          <EmptyState title="Summaries will appear here" description="Generate an AI reflection of your last 24 hours by clicking 'Reflect on your day'." ctaLabel="Reflect" onCta={generate24hSummary} small />
        ) : (
          <div className="space-y-6">
            {Object.entries(summaries.reduce((acc: Record<string, SummaryRow[]>, s) => { const key = s.for_date || (s.created_at ? new Date(s.created_at).toLocaleDateString() : 'Other'); if (!acc[key]) acc[key] = []; acc[key].push(s); return acc }, {})).map(([dateKey, list]) => (
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
                            <div className={`text-sm text-slate-800 leading-snug ${density === 'compact' ? 'line-clamp-2' : 'line-clamp-4'}`}>{preview}</div>
                            <div className="mt-2 text-xs text-slate-400 flex items-center gap-3">
                              <span>{s.for_date ?? (s.created_at ? new Date(s.created_at).toLocaleDateString() : '')}</span>
                              <span className="text-yellow-500" dangerouslySetInnerHTML={{ __html: renderStarsInline(s.rating) }} />
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-500 text-xs">{s.summary_text?.length ?? 0} chars</span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-2">
                              <button aria-expanded={isExpanded} aria-controls={`summary-body-${s.id}`} onClick={() => setExpandedSummaryId((cur) => cur === s.id ? null : s.id)} className="p-3 min-w-[44px] min-h-[44px] rounded-md border bg-white hover:bg-indigo-50" title={isExpanded ? 'Collapse summary' : 'Expand summary'}>
                                <svg className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : 'rotate-0'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                              </button>

                              <div className="card-actions">
                                <button onClick={() => { navigator.clipboard?.writeText(s.summary_text || ''); showToast('Copied summary', 'success') }} title="Copy" className="p-2 rounded-md hover:bg-slate-50">⎘</button>
                                <button onClick={() => { setConfirmTitle('Delete reflection'); setConfirmDesc('Permanently delete this reflection?'); confirmActionRef.current = async () => { await deleteSavedSummary(s.id) }; setConfirmOpen(true) }} className="p-2 rounded-md hover:bg-rose-50" title="Delete">🗑️</button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div id={`summary-body-${s.id}`} className="px-4 pb-4 transition-[max-height,opacity] duration-300 ease-in-out overflow-hidden" style={{ maxHeight: isExpanded ? '1200px' : '0px', opacity: isExpanded ? 1 : 0 }} role="region" aria-hidden={!isExpanded}>
                          <div className="mt-2 text-slate-800 leading-relaxed whitespace-pre-wrap">
                            <div dangerouslySetInnerHTML={{ __html: markDownLike(s.summary_text) }} />
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <div className="text-xs text-slate-400">Saved {s.for_date ?? (s.created_at ? new Date(s.created_at).toLocaleString() : '')}</div>
                            <div className="text-sm text-slate-600">Your rating: <span className="text-yellow-500" dangerouslySetInnerHTML={{ __html: renderStarsInline(s.rating) }} /></div>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )))}
          </div>
        )}
      </div>
    </div>
  )

  /* layout render */
  return (
    <div className="min-h-screen p-8">
      <ToastContainer toast={toast} />
      <DebugOverlayHelper />
      {ConfirmModalNode}
      {EditModalNode}

      <main className="mx-auto max-w-3xl">
        <div className={`overflow-hidden transition-all duration-700 ease-in-out ${isHeaderVisible ? 'opacity-100 translate-y-0 max-h-[520px]' : 'opacity-0 -translate-y-3 pointer-events-none max-h-0'}`}>
          <Header user={user} signOut={signOut} signInWithGoogle={signInWithGoogle} streakCount={streakCount} />
        </div>

        {/* top row */}
        <div className="ms-top-grid ms-top-gap">
          <div>
            <button onClick={generate24hSummary} disabled={isGenerating} className={`ms-full-height-btn ${!isGenerating ? 'animate-shimmer' : ''}`} title="Reflect on your day">
              <div className="text-center text-lg">{isGenerating ? 'Reflecting...' : 'Reflect on your day' }</div>
            </button>
          </div>

          <div>
            <EntryInput finalText={finalText} setFinalText={(text) => { setFinalText(text); handleTyping() }} interim={interim} isRecording={isRecording} startRecording={startRecording} stopRecording={stopRecording} saveTextEntry={saveTextEntry} status={status} setStatus={setStatus} showToast={showToast} stretch={true} />
          </div>
        </div>

        {/* two column headers */}
        <div className="ms-two-col mt-8">
          <div className="ms-column-header">
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-slate-700">My Reflections</span>
              <span className="text-xs text-slate-400">{entries.length} items</span>
            </div>
            <div className="controls">
              <button onClick={exportReflectionsAsMarkdown} className="px-2 py-1 text-xs border rounded-md">Export</button>
              <div className="text-xs text-slate-500">View:</div>
              <select value={density} onChange={(e) => setDensity(e.target.value as any)} className="text-sm border rounded-md px-2 py-1">
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </div>
          </div>

          <div className="ms-column-header">
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-slate-700">My Summaries</span>
              <span className="text-xs text-slate-400">{summaries.length} items</span>
            </div>
            <div className="controls">
              <button onClick={exportSummariesAsMarkdown} className="px-2 py-1 text-xs border rounded-md">Export</button>
            </div>
          </div>

          <div>{LeftColumn}</div>
          <div id="your-summaries-section" ref={summariesRef as any}>{RightColumn}</div>
        </div>

        {status && <div className="mt-6 text-sm text-slate-600" aria-live="polite">{status}</div>}
        <div aria-live="polite" aria-atomic="true" className="sr-only">{status}</div>

        <footer className="mt-8 text-xs text-slate-400">Private • Encrypted • Yours</footer>

        {/* confetti container */}
        <div ref={(r) => (confettiRef.current = r)} className="ms-confetti" />
      </main>
    </div>
  )
}
