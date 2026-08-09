import { createClient } from '@supabase/supabase-js';
import { env, isSupabaseConfigured } from './env.js';

if (!isSupabaseConfigured()) {
  console.warn(
    '[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. Fill in .env before running.',
  );
}

// This client uses the service_role key -> full DB access, bypasses Row Level Security.
// It must NEVER be exposed to the frontend. Only used inside backend request handlers
// after we've already verified the user's identity via verifyAuth middleware.
export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
