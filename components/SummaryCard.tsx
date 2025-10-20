// components/SummaryCard.tsx
import React, { useState } from 'react'

type SummaryCardProps = {
  summary: string
  generatedAt?: string | null
  isSavingRating: boolean
  hoverRating: number
  setHoverRating: (n: number) => void
  saveRatedSummary: (rating: number) => Promise<void>
  discardSummary: () => void
}

/* Minimal XSS-safe markdown converter (escape first, then format) */
function escapeHTML(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
function safeMarkdown(src: string) {
  const t = escapeHTML(src || '')
  return t
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s])\*(.+?)\*(?=[\s.,!?:;)]|$)/g, '$1<em>$2</em>')
    .replace(/(?:^|\n)\s*-\s+(.*)/g, (_m, p1) => `<br/>• ${p1}`)
    .replace(/(?:^|\n)\s*\d+\.\s+(.*)/g, (_m, p1) => `<br/>• ${p1}`)
    .replace(/\n/g, '<br/>')
}

/**
 * SummaryCard (v2, hardened)
 * - Presentational block is non-interactive; actions live outside it (no pointer-events traps)
 * - Local saved flash animation (pulse-ring)
 * - Compact/expanded toggle for long summaries
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
  const [savedFlash, setSavedFlash] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const sections = parseSummary(summary)

  const handleSave = async () => {
    if (localSaving || isSavingRating) return
    const ratingToSave = selectedRating || hoverRating || 5
    try {
      setLocalSaving(true)
      await saveRatedSummary(Number(ratingToSave))
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1600)
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

  const visibleSections = expanded ? sections : sections.slice(0, 2)

  return (
    <div
      className={`mb-8 relative rounded-lg border bg-gradient-to-b from-indigo-50/60 to-white p-5 shadow-md transition-opacity duration-300 ease-out ${savedFlash ? 'pulse-ring' : ''}`}
      aria-live="polite"
      aria-active={savedFlash ? 'true' : 'false'}
      style={{ WebkitTransform: 'translateZ(0)' }}
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
        >
          Dismiss
        </button>
      </div>

      {/* PURELY PRESENTATIONAL BLOCK (non-interactive) */}
      <div className="mt-4 space-y-4 bg-white/80 rounded-md p-5 text-slate-800" style={{ pointerEvents: 'none' }}>
        {visibleSections.map((sec, i) => (
          <div key={i}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{sec.icon}</span>
              <h3 className="font-semibold text-indigo-700 text-sm">{sec.title}</h3>
            </div>
            <div className="text-[15px] whitespace-pre-wrap">
              <div dangerouslySetInnerHTML={{ __html: safeMarkdown(sec.text) }} />
            </div>
          </div>
        ))}
      </div>

      {/* EXPAND / COLLAPSE CONTROLS OUTSIDE NON-INTERACTIVE AREA */}
      {!expanded && sections.length > 2 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-sm text-indigo-600 underline"
          >
            Show full reflection
          </button>
        </div>
      )}
      {expanded && sections.length > 2 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-sm text-slate-600 underline"
          >
            Collapse
          </button>
        </div>
      )}

      {/* actions overlay */}
      <div className="actions-overlay mt-4" role="region" aria-label="Reflection actions" style={{ pointerEvents: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                    zIndex: 10,
                  }}
                >
                  <span style={{ color: filled ? '#f6c945' : '#cbd5e1' }}>{filled ? '★' : '☆'}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-3" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleDiscard}
            className="px-3 py-1 border rounded-md text-sm text-slate-600 bg-white hover:bg-slate-50"
            disabled={localSaving || isSavingRating}
          >
            Discard
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-3 py-1 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50"
            disabled={localSaving || isSavingRating}
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
