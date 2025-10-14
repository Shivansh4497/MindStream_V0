// components/SummaryCard.tsx
import React, { useState } from 'react'
import { markDownLike } from '../lib/ui'

export default function SummaryCard({
  summary,
  generatedAt,
  isSavingRating,
  hoverRating, // still supported (optional)
  setHoverRating, // still supported (optional)
  saveRatedSummary,
  discardSummary
}: any) {
  // local selected rating so clicks are unambiguous and not tied to hover-only state
  const [selectedRating, setSelectedRating] = useState<number | null>(null)
  const [localSaving, setLocalSaving] = useState(false)

  const sections = parseSummary(summary)

  const handleSave = async () => {
    if (localSaving || isSavingRating) return
    const ratingToSave = selectedRating || hoverRating || 5
    try {
      setLocalSaving(true)
      // Await parent's save so UI reflects completion correctly
      await saveRatedSummary(Number(ratingToSave))
    } catch (err) {
      console.error('SummaryCard.handleSave error', err)
    } finally {
      setLocalSaving(false)
      // clear local selection after save (parent will remove card)
      setSelectedRating(null)
    }
  }

  const handleDiscard = () => {
    // ensure immediate synchronous UI reaction
    try {
      discardSummary()
    } catch (err) {
      console.error('SummaryCard.handleDiscard error', err)
    }
  }

  return (
    <div className="mb-8 rounded-lg border bg-gradient-to-b from-indigo-50/60 to-white p-5 shadow-md transition-opacity duration-300 ease-out">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-indigo-800">
            ✨ Reflection generated {generatedAt ? `— ${new Date(generatedAt).toLocaleTimeString()}` : ''}
          </div>
          <div className="text-xs text-slate-500">Read, rate, then save — or discard it permanently.</div>
        </div>

        <button onClick={handleDiscard} className="text-xs text-slate-400 underline hover:text-slate-600">
          Dismiss
        </button>
      </div>

      <div className="mt-4 space-y-4 bg-white/80 rounded-md p-5 text-slate-800 leading-relaxed">
        {sections.map((sec: any, i: number) => (
          <div key={i}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{sec.icon}</span>
              <h3 className="font-semibold text-indigo-700 text-sm">{sec.title}</h3>
            </div>
            <div className="text-[15px] whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: markDownLike(sec.text) }} />
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <div className="text-sm text-slate-600">Rate this reflection:</div>

        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = selectedRating ? n <= selectedRating : n <= (hoverRating || 0)
            return (
              <button
                key={n}
                type="button"
                onClick={() => {
                  // toggle selection (click again to unset)
                  setSelectedRating((cur) => (cur === n ? null : n))
                }}
                onMouseEnter={() => setHoverRating?.(n)}
                onMouseLeave={() => setHoverRating?.(0)}
                onFocus={() => setHoverRating?.(n)}
                onBlur={() => setHoverRating?.(0)}
                aria-label={`Select ${n} star`}
                className={`text-2xl cursor-pointer select-none transition-transform ${filled ? 'text-yellow-500 scale-105' : 'text-slate-300'} ${localSaving || isSavingRating ? 'opacity-50 pointer-events-none' : ''}`}
                title={`${n} star`}
              >
                {filled ? '★' : '☆'}
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex gap-3">
          <button
            onClick={handleDiscard}
            className="px-3 py-1 border rounded-md text-sm text-slate-600 bg-white hover:bg-slate-50"
            disabled={localSaving || isSavingRating}
          >
            Discard
          </button>

          <button
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
