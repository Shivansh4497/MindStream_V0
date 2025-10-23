import React from 'react'

export default function EmptyState() {
  return (
    <div className="rounded-lg bg-white p-4 border shadow-sm">
      <div className="text-slate-700">
        Your thoughts will appear here once you start speaking or typing.
      </div>
      <div className="mt-2 text-xs text-slate-400">
        Tip: hold the mic to record or just type — everything stays in your browser.
      </div>
    </div>
  )
}
