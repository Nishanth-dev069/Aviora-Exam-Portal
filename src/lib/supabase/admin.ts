import { createClient } from '@supabase/supabase-js';

// This client bypasses RLS. ONLY use it in server-side API routes.
// NEVER import this in any client component or expose it to the browser.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
