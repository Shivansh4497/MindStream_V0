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
}

/**
 * EntryInput: the input/record controls. Stateless; uses callbacks from parent (index.tsx).
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
  showToast
}: EntryInputProps) {
  // Separate refs for input and textarea to satisfy React/TSX typing
  const inputElRef = useRef<HTMLInputElement | null>(null)
  const textareaElRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    // Focus textarea if present, otherwise focus input
    if (textareaElRef.current) {
      try {
        textareaElRef.current.focus()
      } catch {}
      return
    }
    if (inputElRef.current) {
      try {
        inputElRef.current.focus()
      } catch {}
    }
  }, [])

  const canSave = (finalText || '').trim().length > 0 && !isRecording

  return (
    <div className="mb-8">
      <div className="flex gap-3 items-start">
        {finalText ? (
          <textarea
            ref={textareaElRef}
            value={finalText}
            onChange={(e) => setFinalText(e.target.value)}
            rows={4}
            className="flex-1 rounded-md border px-4 py-3 shadow-sm text-[15px]"
            placeholder="Edit transcription before saving..."
            aria-label="Edit transcription"
          />
        ) : (
          <input
            ref={inputElRef}
            value={finalText}
            onChange={(e) => setFinalText(e.target.value)}
            className="flex-1 rounded-md border px-4 py-3 shadow-sm text-[15px]"
            placeholder="What’s on your mind?"
            aria-label="Quick thought input"
          />
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={() => saveTextEntry(finalText)}
            disabled={!canSave}
            className="rounded-md bg-indigo-700 text-white px-4 py-2 disabled:opacity-50"
            aria-disabled={!canSave}
          >
            Save
          </button>

          <button
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
            className={`rounded-md px-4 py-2 ${isRecording ? 'bg-teal-400 text-white' : 'bg-white border'}`}
            title="Hold to record"
            aria-pressed={isRecording}
          >
            {isRecording ? 'Recording…' : 'Hold to record'}
          </button>
        </div>
      </div>

      {/* inline helper and actions */}
      {finalText && (
        <div className="mt-3 flex justify-between items-center">
          <div className="text-xs text-slate-500">Edit transcription, then click Save or Cancel.</div>
          <div className="flex gap-2">
            <button
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
              onClick={() => saveTextEntry(finalText)}
              className="px-3 py-1 bg-indigo-600 text-white rounded-md text-sm"
            >
              Save transcription
            </button>
          </div>
        </div>
      )}

      {/* Recording pulse and interim transcripts */}
      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <RecordingPulse isRecording={isRecording} />

          {/* show live interim text while recording */}
          <div className="text-xs text-slate-500">
            {isRecording ? (interim ? interim : 'Listening…') : null}
          </div>
        </div>

        <div className="text-xs text-slate-400">{status}</div>
      </div>
    </div>
  )
}
