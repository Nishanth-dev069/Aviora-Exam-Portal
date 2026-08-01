import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabaseAnon = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );

    // Optimization 1: Use getSession() instead of getUser()
    const { data: { session }, error: authError } = await supabaseAnon.auth.getSession();
    const user = session?.user ?? null;

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' } },
        { status: 401 }
      );
    }

    const sessionToken = cookieStore.get('aviora_session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json(
        { error: { code: 'SESSION_TERMINATED', message: 'Session token missing.' } },
        { status: 401 }
      );
    }

    const tokenHash = await hashToken(sessionToken);

    // Check if this user's active_sessions entry is still valid
    const { data: activeSession } = await supabaseAdmin
      .from('active_sessions')
      .select('id, status, expires_at')
      .eq('user_id', user.id)
      .eq('token_hash', tokenHash)
      .eq('status', 'active')
      .maybeSingle();

    if (!activeSession) {
      return NextResponse.json(
        { error: { code: 'SESSION_TERMINATED', message: 'Your session was terminated. You have been logged in on another device.' } },
        { status: 401 }
      );
    }

    if (new Date(activeSession.expires_at) < new Date()) {
      return NextResponse.json(
        { error: { code: 'SESSION_EXPIRED', message: 'Your session has expired. Please log in again.' } },
        { status: 401 }
      );
    }

    // Optimization 3: Fire-and-forget last_active_at update (non-critical)
    const nowIso = new Date().toISOString();
    supabaseAdmin
      .from('active_sessions')
      .update({ last_active_at: nowIso })
      .eq('id', activeSession.id)
      .then()
      .catch(console.error);

    return NextResponse.json({ valid: true, server_time: nowIso });
  } catch (err: unknown) {
    console.error('[Exam Heartbeat Error]', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Internal error' } },
      { status: 500 }
    );
  }
}

