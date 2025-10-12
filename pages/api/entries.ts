// pages/api/entries.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const serverSecret = process.env.SERVER_WRITE_SECRET

const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false }
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('entries')
        .select('id, content, source, metadata, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ data })
    }

    if (req.method === 'POST') {
      // SERVER WRITES MUST PROVIDE SECRET
      const provided = req.headers['x-server-secret'] || req.query.server_secret
      if (!serverSecret || provided !== serverSecret) {
        return res.status(401).json({ error: 'Unauthorized' })
      }

      const { content, source = 'text', user_id = null, metadata = {} } = req.body || {}
      if (!content || typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ error: 'Missing content' })
      }

      const { data, error } = await supabaseAdmin
        .from('entries')
        .insert([{ content, source, user_id, metadata }])
        .select()

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ data })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('entries API error', err)
    return res.status(500).json({ error: err.message ?? String(err) })
  }
}
