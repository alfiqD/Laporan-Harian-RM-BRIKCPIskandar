import { createClient } from '@supabase/supabase-js'

// 1. Ini Project URL kamu
const supabaseUrl = 'https://xmfwjwmjavebmamznylg.supabase.co'

// 2. Ini API Key yang baru saja kamu copy
const supabaseAnonKey = 'sb_publishable_3W7s8mg9AOZ9C9Mwbnr3hA_wYLFSm5T'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)