// components/EntryInput.tsx
import React, { useEffect, useRef, useState } from 'react'

type Props = {
  finalText: string
  setFinalText: (t: string) => void
  interim: string
  isRecording: boolean
  startRecording: () => void
  stopRecording: () => Promise<void>
  saveTextEntry: (text: string, source?: string) => Promise<any>
  status?: string | null
  setStatus?: (s: string | null) => void
  showToast?: (text: string, kind?: 'info' | 'success' | 'error') => void
  // stretch controls visual width/height for the top-row capsule
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
  const [localText, setLocalText] = useState(finalText || '')
  const [isSaving, setIsSaving] = useState(false)
  const buttonHoldRef = useRef(false)
  const holdTimeoutRef = useRef<number | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    // keep local buffer in sync with parent finalText (useful when transcription arrives)
    setLocalText(finalText ?? '')
  }, [finalText])

  useEffect(() => {
    return () => {
      if (holdTimeoutRef.current) window.clearTimeout(holdTimeoutRef.current)
    }
  }, [])

  // Save handler
  async function handleSave(source: string = 'text') {
    const text = (localText || '').trim()
    if (!text) {
      if (showToast) showToast('Cannot save an empty reflection', 'info')
      setStatus?.('Cannot save empty entry.')
      return
    }
    setIsSaving(true)
    setStatus?.('Saving reflection...')
    try {
      await saveTextEntry(text, source)
      setLocalText('')
      setFinalText('')
      setStatus?.('Saved.')
    } catch (err: any) {
      console.error('EntryInput: save failed', err)
      setStatus?.('Save failed.')
      if (showToast) showToast('Save failed', 'error')
    } finally {
      setIsSaving(false)
      // small delay to let status be read
      setTimeout(() => setStatus?.(null), 900)
    }
  }

  // Handlers for hold-to-record (mouse + touch)
  function beginHoldRecord() {
    // small debounce to avoid accidental taps
    if (!navigator) return
    buttonHoldRef.current = true
    holdTimeoutRef.current = window.setTimeout(() => {
      if (buttonHoldRef.current) {
        try {
          startRecording()
        } catch (e) {
          console.warn('startRecording failed', e)
          if (showToast) showToast('Could not start mic', 'error')
        }
      }
    }, 160) // short delay
  }

  function endHoldRecord() {
    buttonHoldRef.current = false
    if (holdTimeoutRef.current) {
      window.clearTimeout(holdTimeoutRef.current)
      holdTimeoutRef.current = null
    }
    // If currently recording, stop
    if (isRecording) {
      stopRecording().catch((e) => console.warn('stopRecording err', e))
    }
  }

  // keyboard shortcuts: Cmd/Ctrl+Enter to save
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSave('text')
    }
  }

  // small helper to compute combined preview (final + interim)
  const combinedText = (localText || '') + (interim ? (localText ? ' ' : '') + interim : '')

  return (
    <div
      className={`ms-input-capsule ${stretch ? '' : ''}`}
      aria-live="polite"
    >
      <div className={`flex ${stretch ? 'flex-row' : 'flex-col'} gap-3 items-start`}>
        {/* Left: textarea */}
        <div className={`flex-1`}>
          <label htmlFor="ms-entry" className="sr-only">
            What's on your mind
          </label>
          <textarea
            id="ms-entry"
            ref={inputRef}
            value={localText}
            onChange={(e) => {
              setLocalText(e.target.value)
              setFinalText(e.target.value)
            }}
            onKeyDown={handleKeyDown}
            placeholder="What’s on your mind?"
            rows={stretch ? 5 : 4}
            className="w-full bg-transparent resize-none border-none focus:outline-none text-lg leading-relaxed text-slate-800 placeholder:text-slate-400"
            aria-label="Write your reflection"
          />
          <div className="mt-3 text-xs text-slate-400">
            {interim ? (
              <span>
                <strong className="text-slate-600">Transcribing:</strong>{' '}
                <span className="italic text-slate-500">{interim}</span>
              </span>
            ) : (
              'Tip: hold the mic to record or just type — everything stays in your browser.'
            )}
          </div>
        </div>

        {/* Right: mic icon + save */}
        <div className="flex flex-col items-center gap-3">
          {/* mic button */}
          <div
            role="button"
            aria-pressed={isRecording}
            aria-label={isRecording ? 'Release to stop recording' : 'Hold to record'}
            onMouseDown={() => beginHoldRecord()}
            onMouseUp={() => endHoldRecord()}
            onMouseLeave={() => endHoldRecord()}
            onTouchStart={() => beginHoldRecord()}
            onTouchEnd={() => endHoldRecord()}
            className={`w-12 h-12 rounded-md flex items-center justify-center ${isRecording ? 'ms-mic-recording' : ''}`}
            style={{
              background: isRecording ? 'linear-gradient(180deg,var(--ms-accent-start),var(--ms-accent-end))' : 'rgba(243,244,246,0.7)',
              color: isRecording ? 'white' : 'var(--ms-accent-end)',
              boxShadow: isRecording ? '0 8px 20px rgba(20,184,166,0.12)' : '0 4px 10px rgba(16,24,40,0.04)',
              cursor: 'pointer',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z" />
              <path d="M19 11v1a7 7 0 0 1-7 7 7 7 0 0 1-7-7v-1" stroke="none" />
            </svg>
          </div>

          {/* Save button */}
          <button
            onClick={() => handleSave('text')}
            disabled={isSaving || !combinedText.trim()}
            className={`px-4 py-2 rounded-md text-white ${isSaving ? 'opacity-60 cursor-wait' : 'bg-gradient-teal-indigo hover:opacity-95'}`}
            aria-label="Save reflection"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
