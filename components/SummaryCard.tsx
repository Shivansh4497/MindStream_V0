// components/SummaryCard.tsx (debug version)
import React, { useState } from 'react'
import { markDownLike } from '../lib/ui'

export default function SummaryCard({
  summary,
  generatedAt,
  isSavingRating,
  hoverRating,
  setHoverRating,
  saveRatedSummary,
  discardSummary
}: any) {
  const [selectedRating, setSelectedRating] = useState<number | null>(null)
  const [localSaving, setLocalSaving] = useState(false)

  const sections = parseSummary(summary)

  const handleSave = async () => {
    const ratingToSave = selectedRating || hoverRating || 5
    console.log('[SummaryCard] handleSave clicked', { ratingToSave })
    if (localSaving) {
      console.warn('[SummaryCard] already saving')
      return
    }
    try {
      setLocalSaving(true)
      await saveRatedSummary(Number(ratingToSave))
      console.log('[SummaryCard] saveRatedSummary returned successfully')
    } catch (err) {
      console.error('[SummaryCard] save error', err)
    } finally {
      setLocalSaving(false)
    }
  }

  const handleDiscard = () => {
    console.log('[SummaryCard] handleDiscard clicked')
    try {
      discardSummary()
    } catch (err) {
      console.error('[SummaryCard] discard error', err)
    }
  }

  return (
    <div className="mb-8 rounded-lg border bg-gradient-to-b from-indigo-50/60 to-white p-5 shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-indigo-800">
            ✨ Reflection generated {generatedAt ? `— ${new Date(generatedAt).toLocaleTimeString()}` : ''}
          </div>
          <div className="text-xs text-slate-500">Read, rate, then save — or discard it permanently.</div>
        </div>
        <button onClick={handleDiscard} className="text-xs text-slate-400 underline">Dismiss</button>
      </div>

      <div className="mt-4 space-y-4 bg-white/80 rounded-md p-5 text-slate-800">
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

      <div className="mt-3 flex items-center gap-3">
        <div className="text-sm text-slate-600">Rate this reflection:</div>

        <div className="flex items-center gap-1">
          {[1,2,3,4,5].map(n => {
            const filled = selectedRating ? n <= selectedRating : n <= (hoverRating || 0)
            return (
              <button
                key={n}
                onClick={() => setSelectedRating(cur => cur === n ? null : n)}
                onMouseEnter={() => setHoverRating?.(n)}
                onMouseLeave={() => setHoverRating?.(0)}
                className={`text-2xl ${filled ? 'text-yellow-500' : 'text-slate-300'}`}
                title={`${n} star`}
              >
                {filled ? '★' : '☆'}
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex gap-3">
          <button onClick={handleDiscard} className="px-3 py-1 border rounded-md text-sm" disabled={localSaving || isSavingRating}>Discard</button>
          <button onClick={handleSave} className="px-3 py-1 bg-indigo-600 text-white rounded-md text-sm" disabled={localSaving || isSavingRating}>
            {localSaving || isSavingRating ? 'Saving...' : 'Save Reflection'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** parser */
function parseSummary(summary: string) {
  try {
    const parts = summary.split(/\n(?=\*\*|\d\.|[-–] )/g)
    const icons = ['🪞','📋','🌱','💡','❤️']
    return parts.map((p,i) => {
      const titleMatch = p.match(/\*\*(.*?)\*\*/)
      const title = titleMatch ? titleMatch[1].trim() : 'Reflection'
      const text = p.replace(/\*\*(.*?)\*\*/,'').trim()
      return { title, text, icon: icons[i % icons.length] }
    })
  } catch (err) {
    return [{ title: 'Reflection', text: summary || '', icon: '🪞' }]
  }
}
