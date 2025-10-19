// components/EmptyState.tsx
import React from 'react'

type Props = {
  title: string
  description: string
  ctaLabel?: string
  onCta?: () => void
  small?: boolean
}

export default function EmptyState({ title, description, ctaLabel = 'Start', onCta, small = false }: Props) {
  return (
    <div className={`rounded-lg border bg-white p-8 ${small ? 'p-4' : ''} text-center`}>
      <div className="text-3xl mb-3">✨</div>
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
      {onCta && (
        <div className="mt-4">
          <button onClick={onCta} className="px-4 py-2 bg-indigo-600 text-white rounded-md">{ctaLabel}</button>
        </div>
      )}
    </div>
  )
}
