import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://yrwjqzbpdigjzzxmmqnm.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyd2pxemJwZGlnanp6eG1tcW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4Njc0NjYsImV4cCI6MjA4OTQ0MzQ2Nn0.9sHzHehUr6u2eL8LYXKBxR9jdQcBj9-bLc0lGfPgQtw'

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
