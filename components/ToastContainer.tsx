// components/ToastContainer.tsx
import React, { useEffect, useState } from 'react'

export type ToastState = { text: string; kind?: 'info' | 'success' | 'error' } | null

export default function ToastContainer({ toast }: { toast: ToastState }) {
  const [visible, setVisible] = useState(false)
  const [inner, setInner] = useState<ToastState>(null)

  useEffect(() => {
    if (toast) {
      setInner(toast)
      // small mount delay for CSS transition
      setTimeout(() => setVisible(true), 10)
      // auto-hide after the caller's timeout; keep 3s default here
      const t = window.setTimeout(() => {
        setVisible(false)
        // clear inner after animation
        setTimeout(() => setInner(null), 220)
      }, 3000)
      return () => clearTimeout(t)
    } else {
      // hide if toast cleared externally
      setVisible(false)
      const t = window.setTimeout(() => setInner(null), 220)
      return () => clearTimeout(t)
    }
  }, [toast])

  if (!inner) return null

  const { text, kind = 'info' } = inner
  const bg = kind === 'success' ? 'bg-teal-600' : kind === 'error' ? 'bg-rose-600' : 'bg-slate-700'
  const icon =
    kind === 'success' ? (
      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ) : kind === 'error' ? (
      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 9v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ) : null

  return (
    // aria-live region helps screen readers announce toast messages
    <div aria-live="polite" className="fixed top-6 right-6 z-50 pointer-events-none">
      <div
        className={`pointer-events-auto transform transition-all duration-200 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        <div className={`flex items-center text-white ${bg} px-3 py-2 rounded-md shadow-md text-sm min-w-[220px]`}>
          {icon}
          <div className="flex-1">{text}</div>
        </div>
      </div>
    </div>
  )
}
