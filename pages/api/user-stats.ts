// pages/api/user-stats.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // requires a service role key for writes
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { user_id, for_date } = req.body
    if (!user_id || !for_date) {
      return res.status(400).json({ error: 'Missing user_id or for_date' })
    }

    const today = new Date(for_date)
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)

    const { data: existing, error: fetchErr } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', user_id)
      .single()

    if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr // ignore "No rows found"

    let newStreak = 1
    if (existing) {
      const last = existing.last_summary_date ? new Date(existing.last_summary_date) : null
      if (last) {
        const diffDays = Math.floor(
          (today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
        )
        if (diffDays === 1) newStreak = (existing.streak_count || 0) + 1
        else if (diffDays === 0) newStreak = existing.streak_count
      }
    }

    const { error: upErr } = await supabase
      .from('user_stats')
      .upsert({
        user_id,
        last_summary_date: for_date,
        streak_count: newStreak
      })

    if (upErr) throw upErr

    return res.status(200).json({ streak_count: newStreak })
  } catch (err: any) {
    console.error('user-stats error', err)
    res.status(500).json({ error: err.message })
  }
}
