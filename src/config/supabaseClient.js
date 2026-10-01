import { createClient } from '@supabase/supabase-js'

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
const rawUrl = env.VITE_SUPABASE_URL || 'https://oramwfvsxnrkhnvkpgwi.supabase.co';
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_LF3dnAi1k2Plddy4uIjELQ_oznGGMPy';

export const supabase = createClient(supabaseUrl, supabaseAnonKey)