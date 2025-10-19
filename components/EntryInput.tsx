// components/EntryInput.tsx
import React, { useRef, useEffect } from 'react'
import RecordingPulse from './RecordingPulse'

type EntryInputProps = {
  finalText: string
  setFinalText: (s: string) => void
  interim: string
  isRecording: boolean
  startRecording: () => void
  stopRecording: () => Promise<void> | void
  saveTextEntry: (text: string, source?: string) => Promise<void>
  status?: string | null
  setStatus?: (s: string | null) => void
  showToast?: (text: string, kind?: 'info' | 'success' | 'error', ms?: number) => void
  stretch?: boolean
}

/**
 * EntryInput component — primary input capsule + recording controls
 * - stretch: when true the component is expected to fill the containing grid cell height
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const el = textareaRef.current || inputRef.current
    if (el) {
      try {
        (el as HTMLElement).focus({ preventScroll: true })
      } catch {
        (el as HTMLElement).focus()
      }
    }
  }, [])

  const canSave = (finalText || '').trim().length > 0 && !isRecording

  return (
    <div className={`ms-input-capsule rounded-lg p-4 ${stretch ? 'h-full flex flex-col justify-center' : ''}`}>
      <div className="grid grid-cols-[1fr_auto] gap-4 items-center">
        <div>
          {/* show textarea when transcript exists, else show single-line input */}
          {finalText ? (
            <textarea
              ref={textareaRef}
              value={finalText}
              onChange={(e) => setFinalText(e.target.value)}
              rows={4}
              className="w-full rounded-md border px-4 py-3 shadow-sm text-[15px] resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100"
              placeholder="What’s on your mind?"
              aria-label="Edit your thought"
            />
          ) : (
            <input
              ref={inputRef}
              value={finalText}
              onChange={(e) => setFinalText(e.target.value)}
              className="w-full rounded-md border px-4 py-4 shadow-sm text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-100"
              placeholder="What’s on your mind?"
              aria-label="Quick thought input"
            />
          )}
          <div className="mt-3 text-xs text-slate-500">Tip: hold the mic to record or just type — everything stays in your browser.</div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="w-full flex flex-col items-stretch gap-2">
            <button
              type="button"
              onClick={() => saveTextEntry(finalText)}
              disabled={!canSave}
              className="rounded-md bg-indigo-600 text-white px-4 py-2 disabled:opacity-50"
              aria-disabled={!canSave}
            >
              Save
            </button>

            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); startRecording() }}
              onMouseUp={(e) => { e.preventDefault(); stopRecording() }}
              onTouchStart={(e) => { e.preventDefault(); startRecording() }}
              onTouchEnd={(e) => { e.preventDefault(); stopRecording() }}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  if (isRecording) stopRecording()
                  else startRecording()
                }
              }}
              className={`rounded-md px-4 py-2 ${isRecording ? 'bg-teal-500 text-white' : 'bg-white border'}`}
              title="Hold to record"
              aria-pressed={isRecording}
              aria-label={isRecording ? 'Stop recording' : 'Hold to record'}
            >
              <div className="flex items-center gap-2">
                <RecordingPulse isRecording={isRecording} />
                <span>{isRecording ? 'Recording…' : 'Hold to record'}</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* below controls: interim, status, cancel/save pair when transcript present */}
      {finalText && (
        <div className="mt-3 flex items-center justify-between">
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
            <button type="button" onClick={() => saveTextEntry(finalText)} className="px-3 py-1 bg-indigo-600 text-white rounded-md text-sm">Save transcription</button>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`rounded-full ${isRecording ? 'ms-mic-recording' : ''}`} style={{ width: 12, height: 12, background: isRecording ? '#06b6d4' : '#cbd5e1' }} />
          <div className="text-xs text-slate-500">{isRecording ? (interim || 'Listening…') : ''}</div>
        </div>
        <div className="text-xs text-slate-400">{status}</div>
      </div>
    </div>
  )
}
