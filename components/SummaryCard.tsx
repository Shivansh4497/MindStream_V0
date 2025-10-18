// components/SummaryCard.tsx
import React, { useState } from 'react'
import { markDownLike } from '../lib/ui'

type SummaryCardProps = {
  summary: string
  generatedAt?: string | null
  isSavingRating: boolean
  hoverRating: number
  setHoverRating: (n: number) => void
  saveRatedSummary: (rating: number) => Promise<void>
  discardSummary: () => void
}

/**
 * SummaryCard
 * - Renders AI-generated summary sections
 * - Places interactive controls (stars, Save, Discard) into an absolutely positioned overlay
 *   to guarantee they receive pointer events and are not blocked by content areas.
 */
export default function SummaryCard({
  summary,
  generatedAt,
  isSavingRating,
  hoverRating,
  setHoverRating,
  saveRatedSummary,
  discardSummary,
}: SummaryCardProps) {
  const [selectedRating, setSelectedRating] = useState<number | null>(null)
  const [localSaving, setLocalSaving] = useState(false)

  const sections = parseSummary(summary)

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

  return (
    <div
      className="mb-8 relative rounded-lg border bg-gradient-to-b from-indigo-50/60 to-white p-5 shadow-md transition-opacity duration-300 ease-out"
      // create local stacking context (translateZ hack) so absolute overlay behaves predictably
      style={{ WebkitTransform: 'translateZ(0)' }}
      aria-live="polite"
    >
      {/* Top area: headline + small dismiss link */}
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
          style={{ pointerEvents: 'auto' }}
        >
          Dismiss
        </button>
      </div>

      {/* Content: the textual sections. Keep it purely presentational (non-interactive) so it can't intercept clicks */}
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

      {/* ACTIONS OVERLAY
          Rendered as an absolutely positioned overlay inside the card container.
          This overlay has pointer-events enabled and a high z-index so it reliably receives clicks.
      */}
      <div
        className="absolute left-0 right-0 bottom-3 px-6"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          position: 'absolute',
          zIndex: 99999,
          pointerEvents: 'auto',
          justifyContent: 'space-between',
        }}
        role="region"
        aria-label="Reflection actions"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="text-sm text-slate-600 mr-2">Rate this reflection:</div>

          <div style={{ display: 'flex', gap: 8 }}>
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
                  title={`${n} star`}
                  style={{
                    fontSize: 20,
                    lineHeight: 1,
                    cursor: 'pointer',
                    border: 'none',
                    background: 'transparent',
                    pointerEvents: 'auto',
                    zIndex: 99999,
                  }}
                >
                  <span style={{ color: filled ? '#f6c945' : '#cbd5e1' }}>{filled ? '★' : '☆'}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={handleDiscard}
            className="px-3 py-1 border rounded-md text-sm text-slate-600 bg-white hover:bg-slate-50"
            disabled={localSaving || isSavingRating}
            style={{ pointerEvents: localSaving || isSavingRating ? 'none' : 'auto', zIndex: 99999 }}
          >
            Discard
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-3 py-1 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50"
            disabled={localSaving || isSavingRating}
            style={{ pointerEvents: localSaving || isSavingRating ? 'none' : 'auto', zIndex: 99999 }}
          >
            {localSaving || isSavingRating ? 'Saving...' : 'Save Reflection'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** lightweight parser to split the AI summary into titled sections */
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
