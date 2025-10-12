// lib/ui.ts
// Shared UI helper utilities used across components.
// Keep these pure & testable.

export type StarHtml = string

export function previewText(s: string, max = 220): string {
  if (!s) return ''
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + '…'
}

export function markDownLike(text = ''): string {
  // Minimal bold + paragraph markup that's safe for innerHTML usage
  // (Used in v0; kept intentionally small).
  const escaped = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const withBold = escaped.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#2563eb">$1</strong>')
  // convert double newlines to paragraphs and single newline to <br/>
  const paragraphs = withBold.split(/\n{2,}/g).map((p) => p.replace(/\n/g, '<br/>'))
  return paragraphs.join('<br/><br/>')
}

export function formatDateForGroup(s?: string | null): string {
  if (!s) return 'Unknown'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return 'Unknown'
  const today = new Date()
  if (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  )
    return 'Today'
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  )
    return 'Yesterday'
  // fallback to locale date string
  return d.toLocaleDateString()
}

export function renderStarsInline(r?: number | null): StarHtml {
  const rating = Math.max(0, Math.min(5, Number(r || 0)))
  // return a simple string of stars (for inline small displays)
  return Array.from({ length: 5 })
    .map((_, i) => (i < rating ? '★' : '☆'))
    .join('')
}

/** Small affirmation bank — subtle, non-gamified lines.
 * rotate randomly when saving entries/summaries to produce a gentle micro-affirmation.
 */
const AFFIRMATIONS = [
  'Thought saved — small step, big clarity.',
  'Saved — you’re building quiet momentum.',
  'Nice — that’s one more thing remembered.',
  'Reflection saved — small acts compound over time.',
  'Saved — you made space for a thought.'
]

export function randomAffirmation(): string {
  const i = Math.floor(Math.random() * AFFIRMATIONS.length)
  return AFFIRMATIONS[i]
}
