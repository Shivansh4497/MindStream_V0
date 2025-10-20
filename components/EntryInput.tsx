// components/EntryInput.tsx
import React, { useRef, useEffect } from 'react'
import RecordingPulse from './RecordingPulse'

type EntryInputProps = {
  finalText: string
  setFinalText: (s: string) => void
  interim: string
  isRecording: boolean
  startRecording: () => void
  stopRecording: () => void
  saveTextEntry: (text: string, source?: string) => Promise<void>
  status?: string | null
  setStatus?: (s: string | null) => void
  showToast?: (text: string, kind?: 'info' | 'success' | 'error', ms?: number) => void
  // optional layout control: when true, input stretches and action button is fixed width
  stretch?: boolean
}

/**
 * EntryInput
 * Single top-level input used for typed or transcribed entries.
 * - `stretch` (optional): when true, the input will take remaining space and the action
 *   column will keep a fixed width, useful for side-by-side layouts.
 */
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
}: EntryInputProps) {
  const inputElRef = useRef<HTMLInputElement | null>(null)
  const textareaElRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const el = textareaElRef.current || inputElRef.current
    if (!el) return
    try {
      ;(el as HTMLElement).focus({ preventScroll: true })
    } catch {
      ;(el as HTMLElement).focus()
    }
  }, [])

  const canSave = (finalText || '').trim().length > 0 && !isRecording

  return (
    <div className="mb-8">
      <div className={`flex gap-4 items-start ${stretch ? 'w-full' : ''}`}>
        {/* Input area: grows when stretch === true */}
        <div className={`${stretch ? 'flex-1' : 'flex-1'} `}>
          {finalText ? (
            <textarea
              ref={textareaElRef}
              value={finalText}
              onChange={(e) => setFinalText(e.target.value)}
              rows={4}
              className="w-full rounded-xl border px-6 py-5 shadow-md text-[15px] resize-none bg-white"
              placeholder="Edit transcription before saving..."
              aria-label="Edit transcription"
            />
          ) : (
            <input
              ref={inputElRef}
              value={finalText}
              onChange={(e) => setFinalText(e.target.value)}
              className="w-full rounded-xl border px-6 py-5 shadow-md text-[15px] bg-white"
              placeholder="What’s on your mind?"
              aria-label="Quick thought input"
            />
          )}

          {/* inline helper and actions shown when editing */}
          {finalText ? (
            <div className="mt-3 flex justify-between items-center">
              <div className="text-xs text-slate-500">Edit transcription, then click Save or Cancel.</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFinalText('')
                    setStatus?.('Transcription discarded.')
                    showToast?.('Transcription discarded', 'info')
                  }}
                  className="px-3 py-1 border rounded-md text-sm text-slate-600 bg-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => saveTextEntry(finalText)}
                  className="px-3 py-1 bg-indigo-600 text-white rounded-md text-sm"
                >
                  Save transcription
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 text-xs text-slate-500">
              Tip: hold the mic to record or just type — everything stays in your browser.
            </div>
          )}
        </div>

        {/* Action column: fixed-width controls */}
        <div className="flex flex-col gap-3 w-36">
          <button
            type="button"
            onClick={() => saveTextEntry(finalText)}
            disabled={!canSave}
            className="rounded-xl bg-indigo-700 text-white px-4 py-3 disabled:opacity-50 shadow"
            aria-disabled={!canSave}
          >
            Save
          </button>

          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              startRecording()
            }}
            onMouseUp={(e) => {
              e.preventDefault()
              stopRecording()
            }}
            onTouchStart={(e) => {
              e.preventDefault()
              startRecording()
            }}
            onTouchEnd={(e) => {
              e.preventDefault()
              stopRecording()
            }}
            className={`rounded-xl px-4 py-3 text-sm transition-shadow ${isRecording ? 'bg-teal-500 text-white shadow-lg' : 'bg-white border shadow'}`}
            title="Hold to record"
            aria-pressed={isRecording}
          >
            {isRecording ? 'Recording…' : 'Hold to record'}
          </button>
        </div>
      </div>

      {/* Recording pulse and interim transcripts */}
      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <RecordingPulse isRecording={isRecording} />
          <div className="text-xs text-slate-500">
            {isRecording ? (interim ? interim : 'Listening…') : null}
          </div>
        </div>

        <div className="text-xs text-slate-400" aria-live="polite">
          {status}
        </div>
      </div>
    </div>
  )
}
