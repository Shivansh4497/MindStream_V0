// pages/api/entries.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false }
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { content, source = 'text', user_id = null, metadata = {} } = req.body || {}

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Missing content' })
    }

    // IMPORTANT: This uses the service role key => it bypasses RLS.
    // Make sure you do not expose the service key client-side.
    const { data, error } = await supabaseAdmin
      .from('entries')
      .insert([{ content, source, user_id, metadata }])
      .select()

    if (error) {
      console.error('Supabase admin insert error:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ data })
  } catch (err: any) {
    console.error('entries API error', err)
    return res.status(500).json({ error: err.message ?? String(err) })
  }
}
