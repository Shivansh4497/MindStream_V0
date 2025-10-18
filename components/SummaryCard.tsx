// components/SummaryCard.tsx
import React, { useState } from 'react'
import { markDownLike } from '../lib/ui'

type Props = {
  summary: string
  generatedAt?: string | null
  isSavingRating: boolean
  hoverRating: number
  setHoverRating: (n: number) => void
  saveRatedSummary: (rating: number) => Promise<void>
  discardSummary: () => void
}

/**
 * SummaryCard (fixed)
 *
 * - Ensures interactive controls sit on a guaranteed clickable layer (high z-index + pointer-events).
 * - Keeps visual layout and calm styling.
 * - Adds minimal capture logging to help detect remaining blockers (safe to remove once confirmed).
 */
export default function SummaryCard({
  summary,
  generatedAt,
  isSavingRating,
  hoverRating,
  setHoverRating,
  saveRatedSummary,
  discardSummary
}: Props) {
  // local selected rating so clicks are unambiguous
  const [selectedRating, setSelectedRating] = useState<number | null>(null)
  const [localSaving, setLocalSaving] = useState(false)

  const sections = parseSummary(summary)

  // helper — called by Save button
  const handleSave = async () => {
    if (localSaving || isSavingRating) return
    const ratingToSave = selectedRating || hoverRating || 5
    try {
      setLocalSaving(true)
      await saveRatedSummary(Number(ratingToSave))
    } catch (err) {
      console.error('[SummaryCard] save error', err)
    } finally {
      setLocalSaving(false)
    }
  }

  const handleDiscard = () => {
    try {
      discardSummary()
    } catch (err) {
      console.error('[SummaryCard] discard error', err)
    }
  }

  // Capture handler to help debugging stacking/pointer issues if they remain.
  // Safe to keep (just logs), but can be removed after verification.
  const handleCapture = (e: React.MouseEvent) => {
    // comment out or remove in production later if you want zero logs
    // eslint-disable-next-line no-console
    console.log('[SummaryCard] onClickCapture target:', (e.target as HTMLElement)?.tagName, (e.target as any)?.className)
  }

  return (
    <div
      onClickCapture={handleCapture}
      className="mb-8 relative z-20 rounded-lg border bg-gradient-to-b from-indigo-50/60 to-white p-5 shadow-md transition-opacity duration-300 ease-out"
      aria-live="polite"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-indigo-800">
            ✨ Reflection generated {generatedAt ? `— ${new Date(generatedAt).toLocaleTimeString()}` : ''}
          </div>
          <div className="text-xs text-slate-500">Read, rate, then save — or discard it permanently.</div>
        </div>

        <button
          type="button"
          onClick={handleDiscard}
          aria-label="Dismiss reflection"
          className="text-xs text-slate-400 underline"
          style={{ position: 'relative', zIndex: 99999, pointerEvents: 'auto' }}
        >
          Dismiss
        </button>
      </div>

      {/* CONTENT: non-interactive so it cannot cover buttons */}
      <div className="mt-4 space-y-4 bg-white/80 rounded-md p-5 text-slate-800" style={{ pointerEvents: 'none' }}>
        {sections.map((sec, i) => (
          <div key={i}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{sec.icon}</span>
              <h3 className="font-semibold text-indigo-700 text-sm">{sec.title}</h3>
            </div>
            <div className="text-[15px] whitespace-pre-wrap">
              <div dangerouslySetInnerHTML={{ __html: markDownLike(sec.text) }} />
            </div>
          </div>
        ))}
      </div>

      {/* ACTIONS — guaranteed interactive area on top of content */}
      <div
        className="mt-3 flex items-center gap-3"
        style={{ position: 'relative', zIndex: 99999, pointerEvents: 'auto' }}
      >
        <div className="text-sm text-slate-600">Rate this reflection:</div>

        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = selectedRating ? n <= selectedRating : n <= (hoverRating || 0)
            return (
              <button
                key={n}
                type="button"
                onClick={() => setSelectedRating((cur) => (cur === n ? null : n))}
                onMouseEnter={() => setHoverRating?.(n)}
                onMouseLeave={() => setHoverRating?.(0)}
                onFocus={() => setHoverRating?.(n)}
                onBlur={() => setHoverRating?.(0)}
                aria-label={`Select ${n} star`}
                className={`text-2xl cursor-pointer select-none transition-transform ${filled ? 'text-yellow-500 scale-105' : 'text-slate-300'}`}
                style={{ position: 'relative', zIndex: 99999, pointerEvents: 'auto' }}
                title={`${n} star`}
              >
                {filled ? '★' : '☆'}
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex gap-3" style={{ position: 'relative', zIndex: 99999, pointerEvents: 'auto' }}>
          <button
            type="button"
            onClick={handleDiscard}
            className="px-3 py-1 border rounded-md text-sm text-slate-600 bg-white hover:bg-slate-50"
            disabled={localSaving || isSavingRating}
            style={{ pointerEvents: localSaving || isSavingRating ? 'none' : 'auto' }}
          >
            Discard
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-3 py-1 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50"
            disabled={localSaving || isSavingRating}
            style={{ pointerEvents: localSaving || isSavingRating ? 'none' : 'auto' }}
          >
            {localSaving || isSavingRating ? 'Saving...' : 'Save Reflection'}
          </button>
        </div>
      </div>
    </div>
  )


/** small parser to split the AI summary into titled sections */
function parseSummary(summary: string) {
  try {
    const parts = summary.split(/\n(?=\*\*|\d\.|[-–] )/g)
    const icons = ['🪞', '📋', '🌱', '💡', '❤️']
    return parts.map((p, i) => {
      const titleMatch = p.match(/\*\*(.*?)\*\*/)
      const title = titleMatch ? titleMatch[1].trim() : 'Reflection'
      const text = p.replace(/\*\*(.*?)\*\*/, '').trim()
      return { title, text, icon: icons[i % icons.length] }
    })
  } catch (err) {
    return [{ title: 'Reflection', text: summary || '', icon: '🪞' }]
  }
}
