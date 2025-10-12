// pages/api/generate-summary.ts
import type { NextApiRequest, NextApiResponse } from 'next'

type Entry = {
  content: string
  created_at: string
  source?: string
  metadata?: any
}

const OPENAI_KEY = process.env.OPENAI_API_KEY

if (!OPENAI_KEY) {
  console.error('OPENAI_API_KEY missing in environment')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { entries } = req.body as { entries?: Entry[] }
    if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries array required' })

    // limit size — keep only N most recent entries to control cost & tokens
    const MAX_ENTRIES = 200
    const trimmed = entries
      .sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, MAX_ENTRIES)
      .reverse() // chronological

    // Build a compact context string: timestamp + content
    const contextParts = trimmed.map(e =>
      `${new Date(e.created_at).toISOString()} — ${String(e.source ?? 'voice')}: ${e.content.replace(/\s+/g,' ')}`
    )

    // Construct the system + user prompt (careful, explicit instructions)
    const systemPrompt = `
You are a compassionate, factual, and helpful psychologist-like assistant for a personal journaling app.
When asked to summarize a user's entries (short voice/text reflections) from the past 24 hours, do the following:

1. Produce a brief **headline summary** (1-2 sentences) that accurately captures the overall state/mood.
2. Produce a short **detailed summary** (3-6 sentences) — factual, avoid invention. If the notes conflict, present both views neutrally.
3. Produce **3 concrete positive takeaways** (short bullet points) that are encouraging and appreciative (tone: motivating, empathetic, respectful).
4. Produce **2 practical suggestions** (simple, concrete actions the user can try in the next 24 hrs), prioritized by ease.
5. If any potential urgent risk (self-harm, harm to others) appears in the entries, call that out clearly and advise immediate help resources (do not diagnose).
6. Do not be an echo chamber — avoid repeating the same phrase back without insight. Avoid over-generalized platitudes like "everything will be fine" without context.
7. Use inclusive, nonjudgmental language. Keep the whole output ~200-350 words.

Always cite (inline) up to 3 direct quotes from the user's entries that support your summary (quote short fragments and attribute by time, e.g., "2025-10-12 07:10 — '...'").
If an entry is unclear, say "unclear" instead of guessing details.
Be concise and factual while being encouraging.
`

    // Compose the user content (the entries as context)
    const userMessage = `
Here are the user's entries (chronological). Summarize them according to the system instructions above.

${contextParts.join('\n\n')}
`

    // Call OpenAI Chat Completions (adjust model to your preference)
    const chatBody = {
      model: "gpt-4", // change to your preferred model; smaller models reduce cost
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature: 0.2,
      max_tokens: 800
    }

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(chatBody)
    })

    if (!r.ok) {
      const txt = await r.text()
      console.error('OpenAI error', r.status, txt)
      return res.status(500).json({ error: 'LLM error', detail: txt })
    }

    const json = await r.json()
    const text = json.choices?.[0]?.message?.content ?? ''
    return res.status(200).json({ summary: text, raw: json })
  } catch (err: any) {
    console.error('generate-summary error', err)
    return res.status(500).json({ error: err?.message ?? String(err) })
  }
}
