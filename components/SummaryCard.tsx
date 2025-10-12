// components/SummaryCard.tsx
import React from 'react'
import { markDownLike } from '../lib/ui'

interface SummaryCardProps {
  summary: string
  generatedAt?: string | null
  isSavingRating: boolean
  hoverRating: number
  setHoverRating: (n: number) => void
  saveRatedSummary: (rating: number) => Promise<void>
  discardSummary: () => void
}

/**
 * SummaryCard: displays the AI-generated reflection with structured sections
 * and soft emotional polish.
 */
export default function SummaryCard({
  summary,
  generatedAt,
  isSavingRating,
  hoverRating,
  setHoverRating,
  saveRatedSummary,
  discardSummary
}: SummaryCardProps) {
  const sections = parseSummary(summary)

  return (
    <div className="mb-8 rounded-lg border bg-gradient-to-b from-indigo-50/60 to-white p-5 shadow-md transition-opacity duration-300 ease-out">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-indigo-800">
            ✨ Reflection generated {generatedAt ? `— ${new Date(generatedAt).toLocaleTimeString()}` : ''}
          </div>
          <div className="text-xs text-slate-500">
            Read it, then rate (1–5) to save — or discard it permanently.
          </div>
        </div>
        <button
          onClick={discardSummary}
          className="text-xs text-slate-400 underline"
        >
          Dismiss
        </button>
      </div>

      <div className="mt-4 space-y-4 bg-white/80 rounded-md p-5 text-slate-800 leading-relaxed">
        {sections.map((sec, i) => (
          <div key={i}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{sec.icon}</span>
              <h3 className="font-semibold text-indigo-700 text-sm">{sec.title}</h3>
            </div>
            <div
              className="text-[15px] whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: markDownLike(sec.text) }}
            />
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="text-sm text-slate-600">Rate this reflection (click a star to save):</div>

        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = n <= hoverRating
            return (
              <button
                key={n}
                onClick={() => saveRatedSummary(n)}
                onMouseEnter={() => setHoverRating(n)}
                onMouseLeave={() => setHoverRating(0)}
                onFocus={() => setHoverRating(n)}
                onBlur={() => setHoverRating(0)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    saveRatedSummary(n)
                  }
                }}
                aria-label={`Rate ${n} star`}
                className={`text-2xl cursor-pointer select-none transition-transform ${
                  filled ? 'text-yellow-500 scale-100' : 'text-slate-300'
                } ${isSavingRating ? 'opacity-50 pointer-events-none' : ''}`}
                title={`${n} star`}
              >
                {filled ? '★' : '☆'}
              </button>
            )
          })}
        </div>

        <button
          onClick={discardSummary}
          className="ml-auto px-3 py-1 border rounded-md text-sm text-slate-600 bg-white"
          disabled={isSavingRating}
        >
          Discard
        </button>
      </div>
    </div>
  )
}

/** lightweight parser to split the AI summary into titled sections */
function parseSummary(summary: string): { title: string; text: string; icon: string }[] {
  const parts = summary.split(/\n(?=\*\*|\d\.|[-–] )/g) // splits by newlines with bullets or markdown
  const icons = ['🪞', '📋', '🌱', '💡', '❤️']
  return parts.map((p, i) => {
    const titleMatch = p.match(/\*\*(.*?)\*\*/)
    const title = titleMatch ? titleMatch[1].trim() : 'Reflection'
    const text = p.replace(/\*\*(.*?)\*\*/, '').trim()
    return { title, text, icon: icons[i % icons.length] }
  })
}
