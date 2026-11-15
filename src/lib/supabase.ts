import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const hotClient = import.meta.hot?.data.supabaseClient as SupabaseClient | undefined;

export const supabase = supabaseUrl && supabaseAnonKey
  ? hotClient ?? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

if (import.meta.hot && supabase) {
  import.meta.hot.data.supabaseClient = supabase;
}

export const isSupabaseConfigured = supabase !== null;
