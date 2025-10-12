// pages/api/generate-summary.ts
import type { NextApiRequest, NextApiResponse } from 'next'

type Entry = { content: string; created_at: string; source?: string; metadata?: any }

const GROQ_KEY = process.env.GROQ_API_KEY
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { entries } = req.body as { entries?: Entry[] }
    if (!entries?.length) return res.status(400).json({ error: 'entries array required' })

    const context = entries
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map(
        (e) =>
          `${new Date(e.created_at).toISOString()} — ${e.source ?? 'voice'}: ${e.content.replace(/\s+/g, ' ')}`
      )
      .join('\n')

    const systemPrompt = `
You are an empathetic but truthful reflection companion for a journaling app.
Summarize a user's past 24 hours of short voice/text entries into:
1. A two-sentence headline summary capturing their mood and themes.
2. A balanced factual recap (4-6 sentences, unbiased).
3. Three motivating positive takeaways (short bullets).
4. Two actionable suggestions for tomorrow.
Tone: warm, encouraging, yet realistic. Quote short phrases from entries when relevant.
Do not make up facts; if unclear, say so.`

    const body = {
      model: 'llama-3.1-70b-versatile', // or "mixtral-8x7b-32768"
      temperature: 0.3,
      max_tokens: 900,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `User's past-24h entries:\n${context}` },
      ],
    }

    // ✅ All requests go INSIDE the handler
    const r = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    // 👇 This is the debug block — keep it here
    if (!r.ok) {
      const txt = await r.text()
      console.error('Groq error details:', r.status, txt)
      return res.status(500).json({
        error: 'Groq request failed',
        status: r.status,
        detail: txt,
      })
    }

    const data = await r.json()
    const text = data.choices?.[0]?.message?.content ?? ''
    return res.status(200).json({ summary: text, raw: data })
  } catch (err: any) {
    console.error('generate-summary (groq) error', err)
    return res.status(500).json({ error: err?.message || String(err) })
  }
}
