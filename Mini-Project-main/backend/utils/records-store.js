import { createClient } from '@supabase/supabase-js'

let cachedSupabaseClient = null

const getSupabaseClient = () => {
  if (cachedSupabaseClient) return cachedSupabaseClient

  const supabaseUrl = process.env.SUPABASE_URL || 'https://yrwjqzbpdigjzzxmmqnm.supabase.co'
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyd2pxemJwZGlnanp6eG1tcW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4Njc0NjYsImV4cCI6MjA4OTQ0MzQ2Nn0.9sHzHehUr6u2eL8LYXKBxR9jdQcBj9-bLc0lGfPgQtw'

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.warn('Supabase env missing. Records search will fail.')
    return null
  }

  cachedSupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return cachedSupabaseClient
}

export const getPatientRecordsByMemberId = async (memberId) => {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase client not initialized')

  const getFallbackMemberId = (name, userId) => {
    const firstName = String(name || 'user').trim().split(/\s+/)[0]
    const base = String(firstName || 'user').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'user'
    const compact = String(userId || '').replace(/-/g, '')
    const tail = compact.slice(-8)
    const numeric = tail ? String(Math.abs(parseInt(tail, 16)) % 10000).padStart(4, '0') : '0001'
    return `${base}@${numeric}`
  }

  // 1. Find profile by member_id or username
  let { data: profile } = await supabase
    .from('profiles')
    .select('id, name, member_id, username')
    .or(`member_id.eq."${memberId}",username.eq."${memberId}"`)
    .maybeSingle()

  if (!profile) {
    const { data: allProfiles } = await supabase.from('profiles').select('id, name, member_id, username')
    if (allProfiles) {
       profile = allProfiles.find(p => getFallbackMemberId(p.name, p.id) === memberId)
    }
  }

  if (!profile) {
    return null
  }

  // 2. Find documents by user_id
  console.log(`Fetching documents for user_id: ${profile.id} (${profile.name})`)
  const { data: documents, error: docsError } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })

  if (docsError) {
      console.error("SUPABASE DOCS ERROR:", docsError);
      throw docsError;
  }

  console.log(`Documents found for ${profile.name}: ${documents ? documents.length : 0}`)

  return {
    patient: {
      id: profile.id,
      name: profile.name,
      memberId: memberId.includes('@') ? memberId : (profile.member_id || profile.username || memberId),
    },
    documents: documents || [],
  }
}
