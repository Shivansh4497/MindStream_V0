import React, { useEffect, useRef } from 'react'

declare global {
  interface Window {
    __ms_entry_input_rendered__?: boolean
  }
}

type Props = {
  finalText: string
  setFinalText: (t: string) => void
  interim: string
  isRecording: boolean
  startRecording: () => void
  stopRecording: () => void
  saveTextEntry: (text: string, source?: string) => void
  status: string | null
  setStatus: (s: string | null) => void
  showToast: (text: string, kind?: 'info' | 'success' | 'error', ms?: number) => void
  stretch?: boolean
}

export default function EntryInput({
  finalText,
  setFinalText,
  interim,
  isRecording,
  startRecording,
  stopRecording,
  saveTextEntry,
  status,
  setStatus,
  showToast,
  stretch = false,
}: Props) {
  // ---------- SINGLETON GUARD ----------
  const skipRef = useRef(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.__ms_entry_input_rendered__) {
      skipRef.current = true
      return
    }
    window.__ms_entry_input_rendered__ = true
    return () => {
      // release lock on unmount
      if (typeof window !== 'undefined') window.__ms_entry_input_rendered__ = false
    }
  }, [])
  if (skipRef.current) return null
  // -------------------------------------

  function onSave() {
    const text = (finalText || '').trim()
    if (!text) { showToast('Nothing to save', 'info'); return }
    saveTextEntry(text, 'text')
  }

  return (
    <div className={`rounded-xl bg-white border shadow-sm ${stretch ? 'w-full' : ''}`}>
      <div className="p-4">
        <label className="sr-only" htmlFor="entry-textarea">What’s on your mind?</label>
        <div className="text-slate-500 mb-2">What’s on your mind?</div>

        <textarea
          id="entry-textarea"
          className="w-full min-h-[110px] resize-vertical rounded-md border p-3 focus:outline-none"
          value={finalText}
          onChange={(e) => setFinalText(e.target.value)}
          placeholder="Tip: hold the mic to record or just type — everything stays in your browser."
        />

        {interim && (
          <div className="mt-2 text-sm text-slate-400">
            <span className="italic">Listening…</span> {interim}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="px-3 py-2 rounded-md border hover:bg-slate-50"
                title="Hold to start recording"
              >
                🎙️
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="px-3 py-2 rounded-md border hover:bg-slate-50"
                title="Stop recording"
              >
                ⏹
              </button>
            )}
            {status && <div className="text-xs text-slate-500">{status}</div>}
          </div>

          <button
            onClick={onSave}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Save
          </button>
        </div>

        <div className="mt-2 text-xs text-slate-400">
          Tip: hold the mic to record or just type — everything stays in your browser.
        </div>
      </div>
    </div>
  )
}
