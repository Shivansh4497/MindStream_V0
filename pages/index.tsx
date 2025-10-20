// pages/index.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import Header from '../components/Header'
import EntryInput from '../components/EntryInput'
import SummaryCard from '../components/SummaryCard'
import ToastContainer from '../components/ToastContainer'
import EmptyState from '../components/EmptyState'
import DebugOverlayHelper from '../components/DebugOverlayHelper'
import TwoColumnLayout from '../components/TwoColumnLayout'
import RecordingPulse from '../components/RecordingPulse'
import { supabase } from '../lib/supabaseClient'
import { markDownLike } from '../lib/ui'

type Entry = {
  id: string
  text: string
  created_at: string
  user_id?: string | null
}

type Summary = {
  id: string
  entry_id?: string | null
  summary: string
  created_at: string
  rating?: number | null
}

export default function HomePage() {
  // Auth & user
  const [user, setUser] = useState<any | null>(null)

  // Data
  const [entries, setEntries] = useState<Entry[]>([])
  const [summaries, setSummaries] = useState<Summary[]>([])

  // UI states
  const [finalText, setFinalText] = useState('')
  const [interim, setInterim] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [toast, setToast] = useState<{ text: string; kind?: 'info' | 'success' | 'error' } | null>(null)
  const [hoverRating, setHoverRating] = useState(0)
  const [isSavingRating, setIsSavingRating] = useState(false)
  const [viewMode, setViewMode] = useState<'compact' | 'full'>('compact')
  const [showIdlePrompt, setShowIdlePrompt] = useState(false)

  const mountedRef = useRef(false)

  // --------------------------
  // Helpers: Toast + status
  // --------------------------
  const showToast = useCallback((text: string, kind: 'info' | 'success' | 'error' = 'info', ms = 3000) => {
    setToast({ text, kind })
    window.setTimeout(() => setToast(null), ms)
  }, [])

  // --------------------------
  // Auth: subscribe to Supabase auth changes
  // --------------------------
  useEffect(() => {
    mountedRef.current = true
    // initial session
    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        setUser(session?.user ?? null)
      } catch (err) {
        console.warn('Auth init error', err)
      }
    }
    init()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => {
      mountedRef.current = false
      sub.subscription?.unsubscribe?.()
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    try {
      await supabase.auth.signInWithOAuth({ provider: 'google' })
      // Supabase will redirect; onAuthStateChange will set user.
    } catch (err) {
      console.error('Google sign-in error', err)
      showToast('Failed to sign in with Google', 'error')
    }
  }, [showToast])

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      showToast('Signed out', 'info')
    } catch (err) {
      console.error('Sign out error', err)
      showToast('Sign out failed', 'error')
    }
  }, [showToast])

  // --------------------------
  // Data loaders
  // --------------------------
  const loadEntries = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) {
        console.error('loadEntries supabase error:', error)
        throw error
      }
      setEntries((data ?? []) as Entry[])
    } catch (err) {
      console.error('loadEntries error', err)
      showToast('Failed to load entries', 'error')
    }
  }, [showToast])

  const loadSummaries = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('summaries')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) {
        console.error('loadSummaries supabase error:', error)
        throw error
      }
      setSummaries((data ?? []) as Summary[])
    } catch (err) {
      console.error('loadSummaries error', err)
      showToast('Failed to load summaries', 'error')
    }
  }, [showToast])

  // load data on user or mount
  useEffect(() => {
    if (!mountedRef.current) return
    loadEntries()
    loadSummaries()
  }, [loadEntries, loadSummaries, user])

  // --------------------------
  // Save entry + generate AI summary (FIXED)
  // --------------------------
  /**
   * saveTextEntry:
   * - Waits for supabase insert to confirm
   * - Only shows success toast AFTER insert succeeds
   * - If insert fails, shows a clear error toast and logs the supabase error
   *
   * Important: returns a Promise<void> that resolves after DB write completes (or rejects on fatal error)
   */
  const saveTextEntry = useCallback(
    async (text: string, source: string = 'typed'): Promise<void> => {
      const trimmed = text?.trim()
      if (!trimmed) {
        showToast('Nothing to save', 'info')
        return
      }

      setStatus('Saving entry…')
      try {
        // Insert into entries table
        const payload = {
          text: trimmed,
          user_id: user?.id ?? null,
        }
        const { data, error } = await supabase.from('entries').insert(payload).select().single()

        if (error) {
          // Detailed logging for debugging RLS / validation issues
          console.error('supabase insert entries error:', error)
          // If RLS denies: show actionable message
          if ((error as any)?.message?.toLowerCase().includes('rbac') || (error as any)?.message?.toLowerCase().includes('permission') || (error as any)?.details?.toLowerCase?.()?.includes('rls')) {
            showToast('Save failed: permission denied (RLS). Check Supabase Row Level Security and auth.', 'error')
          } else {
            showToast('Failed to save entry', 'error')
          }
          setStatus(null)
          throw error
        }

        const inserted = data as Entry
        if (!inserted || !inserted.id) {
          console.error('Insert returned no inserted row', data)
          showToast('Failed to save entry (no data returned)', 'error')
          setStatus(null)
          throw new Error('No inserted row returned')
        }

        // Confirmed persisted — now update UI
        setEntries((s) => [inserted, ...s])
        setFinalText('')
        showToast('Entry saved', 'success')
        setStatus(null)

        // Kick off summary generation in background; do not block save UX
        (async () => {
          try {
            const res = await fetch('/api/generate-summary', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ entryId: inserted.id, text: inserted.text }),
            })
            const json = await res.json().catch(() => null)
            if (json?.savedSummary) {
              // server persisted the summary — refresh
              await loadSummaries()
              showToast('AI reflection created', 'success')
            } else if (json?.summary) {
              // fallback client insert (try)
              const fallback = {
                entry_id: inserted.id,
                summary: json.summary,
                created_at: new Date().toISOString(),
              }
              const { data: sdata, error: serror } = await supabase.from('summaries').insert(fallback).select().single()
              if (!serror && sdata) {
                setSummaries((prev) => [sdata as Summary, ...(prev ?? [])])
                showToast('AI reflection created', 'success')
              }
            }
          } catch (err) {
            console.warn('generate-summary background error', err)
          }
        })()

        return
      } catch (err) {
        // Bubble up for callers if needed
        setStatus(null)
        throw err
      }
    },
    [user, showToast, loadSummaries]
  )

  // --------------------------
  // Summary rating + discard
  // --------------------------
  const saveRatedSummary = useCallback(
    async (summaryId: string, rating: number) => {
      try {
        setIsSavingRating(true)
        const { error } = await supabase.from('summaries').update({ rating }).eq('id', summaryId)
        if (error) {
          console.error('saveRatedSummary supabase error:', error)
          showToast('Failed to save rating', 'error')
          return
        }
        setSummaries((s) => s.map((x) => (x.id === summaryId ? { ...x, rating } : x)))
        showToast('Reflection rating saved', 'success')
      } catch (err) {
        console.error('saveRatedSummary error', err)
        showToast('Failed to save rating', 'error')
      } finally {
        setIsSavingRating(false)
      }
    },
    [showToast]
  )

  const discardSummary = useCallback(
    async (summaryId: string) => {
      try {
        const { error } = await supabase.from('summaries').delete().eq('id', summaryId)
        if (error) {
          console.error('discardSummary supabase error:', error)
          showToast('Failed to discard reflection', 'error')
          return
        }
        setSummaries((s) => s.filter((x) => x.id !== summaryId))
        showToast('Reflection discarded', 'info')
      } catch (err) {
        console.error('discardSummary error', err)
        showToast('Failed to discard reflection', 'error')
      }
    },
    [showToast]
  )

  // --------------------------
  // Export helpers (CSV)
  // --------------------------
  const exportEntries = useCallback(async () => {
    try {
      showToast('Preparing export…', 'info')
      const { data, error } = await supabase.from('entries').select('*')
      if (error) throw error
      const rows = data ?? []
      const csv = [
        ['id', 'text', 'created_at', 'user_id'],
        ...rows.map((r) => [r.id, `"${String(r.text).replace(/"/g, '""')}"`, r.created_at, r.user_id ?? '']),
      ]
        .map((r) => r.join(','))
        .join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mindstream-entries-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Export started', 'success')
    } catch (err) {
      console.error('exportEntries error', err)
      showToast('Export failed', 'error')
    }
  }, [showToast])

  const exportSummaries = useCallback(async () => {
    try {
      showToast('Preparing export…', 'info')
      const { data, error } = await supabase.from('summaries').select('*')
      if (error) throw error
      const rows = data ?? []
      const csv = [
        ['id', 'entry_id', 'summary', 'created_at', 'rating'],
        ...rows.map((r) => [r.id, r.entry_id ?? '', `"${String(r.summary).replace(/"/g, '""')}"`, r.created_at, r.rating ?? '']),
      ]
        .map((r) => r.join(','))
        .join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mindstream-summaries-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Export started', 'success')
    } catch (err) {
      console.error('exportSummaries error', err)
      showToast('Export failed', 'error')
    }
  }, [showToast])

  // --------------------------
  // Recording handlers (assume Web Speech API wired elsewhere)
  // --------------------------
  const startRecording = useCallback(() => {
    setIsRecording(true)
    setStatus('Recording…')
    // Expect external transcription service to set `interim` and `finalText` via callbacks you already have in your app
  }, [])

  const stopRecording = useCallback(() => {
    setIsRecording(false)
    setStatus('Processing transcription…')
    // Post-process: final text should have been set by your transcription callbacks. Clear status shortly.
    setTimeout(() => setStatus(null), 600)
  }, [])

  // --------------------------
  // Idle Prompt: non-intrusive behavioral nudge (once per session)
  // --------------------------
  useEffect(() => {
    let idleTimer: number | null = null
    function startTimer() {
      if (idleTimer) window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(() => setShowIdlePrompt(true), 90000) // 90s
    }
    function cancelTimer() {
      if (idleTimer) window.clearTimeout(idleTimer)
      idleTimer = null
    }
    function onActivity() {
      cancelTimer()
      startTimer()
      setShowIdlePrompt(false)
    }
    window.addEventListener('mousemove', onActivity)
    window.addEventListener('keydown', onActivity)
    window.addEventListener('touchstart', onActivity)
    startTimer()
    return () => {
      window.removeEventListener('mousemove', onActivity)
      window.removeEventListener('keydown', onActivity)
      window.removeEventListener('touchstart', onActivity)
      cancelTimer()
    }
  }, [])

  // --------------------------
  // Debug overlay gate
  // --------------------------
  const showDebug = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development'

  // --------------------------
  // Minimal demo data on first load (keeps UI friendly if DB empty)
  // --------------------------
  useEffect(() => {
    if (entries.length === 0) {
      if (process.env.NODE_ENV === 'development') {
        setEntries([
          { id: 'd1', text: 'So today we will try to solve some more UI issues…', created_at: '2025-10-18T19:29:58Z' },
          { id: 'd2', text: 'Hi third day of making Mindstream, ...', created_at: '2025-10-14T22:04:24Z' },
          { id: 'd3', text: "I am creating one more entry on mindstream...", created_at: '2025-10-13T03:33:22Z' },
        ])
      }
    }
    if (summaries.length === 0 && process.env.NODE_ENV === 'development') {
      setSummaries([
        { id: 's-demo-1', entry_id: 'd1', summary: '**Headline Summary:**\nThe user is preparing ...\n\n**Factual Recap:**\nA few facts here.', created_at: '2025-10-18T10:00:00Z', rating: 5 },
      ])
    }
  }, [entries.length, summaries.length])

  // --------------------------
  // IdlePrompt component (inline)
  // --------------------------
  function IdlePrompt() {
    if (!showIdlePrompt) return null
    return (
      <div className="fixed bottom-8 left-8 z-40">
        <div className="card p-3 rounded-md shadow-md bg-white text-sm text-slate-700" role="dialog" aria-modal={false}>
          <div className="font-semibold">Moment of reflection</div>
          <div className="text-xs text-slate-500 mt-1">Quick prompt — what's one small thing you noticed today?</div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => {
                const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>('input[aria-label="Quick thought input"], textarea[aria-label="Edit transcription"]')
                el?.focus()
                setShowIdlePrompt(false)
              }}
              className="px-3 py-1 rounded-md bg-indigo-600 text-white text-sm"
            >
              Reflect now
            </button>
            <button onClick={() => setShowIdlePrompt(false)} className="px-3 py-1 rounded-md bg-slate-100 text-slate-700 text-sm">
              Later
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --------------------------
  // Render
  // --------------------------
  return (
    <>
      <Head>
        <title>Mindstream — Calm private journaling</title>
      </Head>

      <div className="max-w-[1200px] mx-auto px-4 lg:px-0">
        <Header
          user={user ? { id: user.id, email: user.email } : null}
          signOut={signOut}
          signInWithGoogle={signInWithGoogle}
          streakCount={1}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8 items-start">
          <div>
            <div className="rounded-lg p-8 bg-indigo-700 text-white h-full card">
              <div className="text-lg font-semibold">Reflect on your day</div>
              <div className="text-sm text-indigo-100 mt-2">A calm place for quick 3–5 minute reflections.</div>
            </div>
          </div>

          <div>
            {/* Top input */}
            <EntryInput
              finalText={finalText}
              setFinalText={setFinalText}
              interim={interim}
              isRecording={isRecording}
              startRecording={startRecording}
              stopRecording={stopRecording}
              saveTextEntry={saveTextEntry}
              status={status}
              setStatus={setStatus}
              showToast={(t, k) => showToast(t, k)}
              stretch={true}
            />

            {/* Controls row */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="text-2xl font-semibold">My Reflections</div>
                <div className="text-sm text-slate-400">{entries.length} items</div>
                <button onClick={exportEntries} className="px-3 py-1 border rounded-md text-sm text-slate-700">Export</button>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span>View:</span>
                  <select value={viewMode} onChange={(e) => setViewMode(e.target.value as any)} className="border rounded-md px-2 py-1 text-sm">
                    <option value="compact">Compact</option>
                    <option value="full">Full</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-2xl font-semibold">My Summaries</div>
                <div className="text-sm text-slate-400">{summaries.length} items</div>
                <button onClick={exportSummaries} className="px-3 py-1 border rounded-md text-sm text-slate-700">Export</button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
              {/* left column: reflections list */}
              <main className="space-y-6">
                {entries.length === 0 ? (
                  <EmptyState title="No reflections yet" description="This is a calm, private space to capture your thoughts." onCta={() => {}} />
                ) : (
                  <div>
                    {entries.map((e) => (
                      <div key={e.id} className="mb-6">
                        <div className="text-xs text-slate-400 mb-2">{new Date(e.created_at).toLocaleDateString()}</div>
                        <div className="rounded-md border p-4 bg-white card">
                          <div className="text-[15px] text-slate-800 mb-2">
                            {viewMode === 'compact' ? (e.text.length > 140 ? `${e.text.slice(0, 140)}…` : e.text) : e.text}
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-slate-400">{new Date(e.created_at).toLocaleString()}</div>
                            <div className="flex items-center gap-2">
                              {/* example small action icons — keep as simple placeholders */}
                              <button
                                title="Edit"
                                onClick={() => {
                                  setFinalText(e.text)
                                  const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>('input[aria-label="Quick thought input"], textarea[aria-label="Edit transcription"]')
                                  el?.focus()
                                }}
                                className="text-slate-400 hover:text-slate-600"
                              >
                                ✏️
                              </button>
                              <button
                                title="Pin"
                                onClick={() => showToast('Pinned (UI-only)', 'info')}
                                className="text-slate-400 hover:text-slate-600"
                              >
                                📌
                              </button>
                              <button
                                title="Delete"
                                onClick={async () => {
                                  try {
                                    const { error } = await supabase.from('entries').delete().eq('id', e.id)
                                    if (error) throw error
                                    setEntries((s) => s.filter((it) => it.id !== e.id))
                                    showToast('Entry deleted', 'info')
                                  } catch (err) {
                                    console.error('delete entry', err)
                                    showToast('Failed to delete', 'error')
                                  }
                                }}
                                className="text-slate-400 hover:text-rose-500"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </main>

              {/* right column: summaries */}
              <aside className="space-y-6">
                {summaries.length === 0 ? (
                  <EmptyState title="No summaries yet" description="AI reflections appear here after saving an entry." />
                ) : (
                  summaries.map((s) => (
                    <SummaryCard
                      key={s.id}
                      summary={s.summary}
                      generatedAt={s.created_at}
                      isSavingRating={isSavingRating}
                      hoverRating={hoverRating}
                      setHoverRating={(n) => setHoverRating(n)}
                      saveRatedSummary={async (rating) => await saveRatedSummary(s.id, rating)}
                      discardSummary={async () => await discardSummary(s.id)}
                    />
                  ))
                )}
              </aside>
            </div>
          </div>
        </div>
      </div>

      <ToastContainer toast={toast} />
      {showDebug && <DebugOverlayHelper />}
      <IdlePrompt />
    </>
  )
}
