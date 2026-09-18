import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const SUPABASE_READY = !!url && !!anonKey && !url.includes('YOURPROJECT')

export const supabase: SupabaseClient = SUPABASE_READY
  ? createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true } })
  : (null as unknown as SupabaseClient)
