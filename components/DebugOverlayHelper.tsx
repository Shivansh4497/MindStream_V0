// components/DebugOverlayHelper.tsx
import React, { useEffect, useRef, useState } from 'react'

/**
 * DebugOverlayHelper
 *
 * - Installs a capture listener that finds the top DOM node under the pointer
 *   when the user clicks (useful when developer tools aren't available).
 * - Renders a floating panel with info about the top element (tag, classes, styles).
 * - Draws a visible red outline on the blocking element so you can see it.
 * - Allows disabling pointer-events on that element (temporary inline fix).
 *
 * Usage:
 *  - Import and render <DebugOverlayHelper /> near the top of pages/index.tsx
 *  - Click a non-working button (Save/Discard in SummaryCard)
 *  - The panel will show the blocking element and allow a one-click fix
 *
 * IMPORTANT: This is a temporary debugging utility. Remove it after you fix the root cause.
 */
export default function DebugOverlayHelper() {
  const [info, setInfo] = useState<null | {
    clickedTargetTag: string
    clickedTargetClass: string
    topTag: string
    topClass: string
    topStyles: { pointerEvents: string; opacity: string; zIndex: string; position: string }
    rect: DOMRect | null
  }>(null)

  const outlineRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    function onCapture(e: MouseEvent) {
      try {
        const pt = { x: e.clientX, y: e.clientY }
        const top = document.elementFromPoint(pt.x, pt.y) as HTMLElement | null
        const clicked = e.target as HTMLElement | null

        if (!top) {
          setInfo(null)
          return
        }

        const cs = window.getComputedStyle(top)
        const rect = top.getBoundingClientRect()

        setInfo({
          clickedTargetTag: clicked?.tagName ?? 'unknown',
          clickedTargetClass: clicked?.className ?? '',
          topTag: top.tagName,
          topClass: top.className ?? '',
          topStyles: {
            pointerEvents: cs.pointerEvents,
            opacity: cs.opacity,
            zIndex: cs.zIndex,
            position: cs.position,
          },
          rect: rect || null,
        })

        // Draw a visible outline on the blocking element
        removeOutline()
        const outline = document.createElement('div')
        outline.style.position = 'fixed'
        outline.style.left = `${rect.left}px`
        outline.style.top = `${rect.top}px`
        outline.style.width = `${Math.max(0, rect.width)}px`
        outline.style.height = `${Math.max(0, rect.height)}px`
        outline.style.border = '3px solid rgba(239, 68, 68, 0.9)'
        outline.style.zIndex = '99999'
        outline.style.pointerEvents = 'none'
        outline.style.borderRadius = '6px'
        outline.id = 'mindstream-debug-outline'
        document.body.appendChild(outline)
        outlineRef.current = outline as any

        // keep only one capture: remove listener (so users click once then act)
        // Comment this line if you want continuous captures
        // document.removeEventListener('click', onCapture, true)
      } catch (err) {
        console.error('DebugOverlayHelper.onCapture error', err)
      }
    }

    document.addEventListener('click', onCapture, true)
    return () => {
      document.removeEventListener('click', onCapture, true)
      removeOutline()
    }
  }, [])

  function removeOutline() {
    try {
      const existing = document.getElementById('mindstream-debug-outline')
      if (existing) existing.remove()
      outlineRef.current = null
    } catch {}
  }

  function disableTopElementPointerEvents() {
    // when user clicks "Disable pointer-events", find the element under the recorded rect
    if (!info || !info.rect) return
    const x = info.rect.left + 2
    const y = info.rect.top + 2
    const top = document.elementFromPoint(x, y) as HTMLElement | null
    if (!top) return
    // store existing style to data- attribute for possible restore
    const prev = top.getAttribute('data-prev-pointer-events')
    if (!prev) {
      const cs = window.getComputedStyle(top)
      top.setAttribute('data-prev-pointer-events', cs.pointerEvents || '')
    }
    top.style.pointerEvents = 'none'
    top.style.outline = '3px dashed rgba(16,24,40,0.2)'
    setInfo((s) =>
      s
        ? {
            ...s,
            topStyles: { ...s.topStyles, pointerEvents: 'none' },
          }
        : s
    )
    // remove outline overlay drawn earlier (the red box)
    removeOutline()
  }

  function restoreTopElementPointerEvents() {
    if (!info || !info.rect) return
    const x = info.rect.left + 2
    const y = info.rect.top + 2
    const top = document.elementFromPoint(x, y) as HTMLElement | null
    if (!top) return
    const prev = top.getAttribute('data-prev-pointer-events')
    if (prev !== null) {
      top.style.pointerEvents = prev
      top.removeAttribute('data-prev-pointer-events')
    } else {
      top.style.pointerEvents = ''
    }
    top.style.outline = ''
    setInfo((s) =>
      s
        ? {
            ...s,
            topStyles: { ...s.topStyles, pointerEvents: window.getComputedStyle(top).pointerEvents },
          }
        : s
    )
  }

  if (!info) {
    return (
      <div
        className="fixed right-4 bottom-4 z-[99999] p-2 rounded-md bg-white/90 border shadow-sm text-xs text-slate-600"
        style={{ maxWidth: 320 }}
      >
        Debug: click a non-working control (Save/Discard) to identify the blocking element.
      </div>
    )
  }

  return (
    <div className="fixed right-4 bottom-4 z-[99999] p-3 rounded-md bg-white/95 border shadow-md text-sm text-slate-700" style={{ width: 360 }}>
      <div className="mb-2 text-xs text-slate-500">Debug capture (click once on failing control)</div>
      <div className="text-xs mb-1"><strong>Clicked element:</strong> {info.clickedTargetTag} <span className="text-slate-400">({info.clickedTargetClass})</span></div>
      <div className="text-xs mb-1"><strong>Top element:</strong> {info.topTag} <span className="text-slate-400">({info.topClass})</span></div>
      <div className="text-xs mb-1"><strong>Computed styles:</strong></div>
      <div className="text-xs text-slate-500 mb-2">
        pointer-events: <strong>{info.topStyles.pointerEvents}</strong> · opacity: <strong>{info.topStyles.opacity}</strong> · z-index: <strong>{info.topStyles.zIndex}</strong>
      </div>

      <div className="flex gap-2">
        <button
          onClick={disableTopElementPointerEvents}
          className="px-2 py-1 bg-rose-500 text-white text-xs rounded-md"
        >
          Disable pointer-events (quick fix)
        </button>
        <button
          onClick={restoreTopElementPointerEvents}
          className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded-md"
        >
          Restore pointer-events
        </button>
        <button
          onClick={() => { removeOutline(); setInfo(null) }}
          className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md"
        >
          Dismiss
        </button>
      </div>

      <div className="mt-2 text-xs text-slate-400">
        Tip: after disabling, try Save/Discard again. When done, click Restore to revert.
      </div>
    </div>
  )
}
