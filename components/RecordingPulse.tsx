// components/RecordingPulse.tsx
import React, { useEffect, useRef, useState } from 'react'

type RecordingPulseProps = {
  isRecording: boolean
}

/**
 * Small recording UI: animated bars + timer.
 * Self-contained styles for keyframes to keep integration simple.
 */
export default function RecordingPulse({ isRecording }: RecordingPulseProps) {
  const [seconds, setSeconds] = useState(0)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isRecording) {
      setSeconds(0)
      if (timerRef.current) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }
    // start timer
    timerRef.current = window.setInterval(() => {
      setSeconds((s) => s + 1)
    }, 1000)
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isRecording])

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')

  return (
    <div className="flex items-center gap-3">
      <style>{`
        @keyframes pulseBar {
          0% { transform: scaleY(0.4); opacity: 0.6; }
          50% { transform: scaleY(1.0); opacity: 1; }
          100% { transform: scaleY(0.4); opacity: 0.6; }
        }
      `}</style>

      <div
        aria-hidden
        className={`w-10 h-10 rounded-full flex items-center justify-center ${isRecording ? 'bg-teal-500/20 ring-2 ring-teal-200' : 'bg-slate-100'}`}
      >
        <div className="flex items-end gap-1 h-5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 bg-teal-500 rounded"
              style={{
                height: `${8 + i * 4}px`,
                transformOrigin: 'bottom',
                animation: isRecording ? `pulseBar 900ms ${i * 120}ms ease-in-out infinite` : 'none'
              }}
            />
          ))}
        </div>
      </div>

      <div className="text-xs text-slate-600" aria-live="polite">
        {isRecording ? `Recording — ${mm}:${ss}` : `Hold to record`}
      </div>
    </div>
  )
}
