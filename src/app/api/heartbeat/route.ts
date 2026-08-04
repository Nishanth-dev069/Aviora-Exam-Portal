import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sha256Hex } from '@/lib/auth/hash';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
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
      return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    const deviceSessionUUID = cookieStore.get('aviora-device-session')?.value;
    if (!deviceSessionUUID) {
      return NextResponse.json({ error: { code: 'SESSION_TERMINATED' } }, { status: 401 });
    }

    const tokenHash = await sha256Hex(deviceSessionUUID);

    const { data: activeSession } = await supabaseAdmin
      .from('active_sessions')
      .select('id, status, expires_at')
      .eq('user_id', user.id)
      .eq('token_hash', tokenHash)
      .eq('status', 'active')
      .maybeSingle();

    if (!activeSession) {
      return NextResponse.json({ error: { code: 'SESSION_TERMINATED' } }, { status: 401 });
    }

    if (new Date(activeSession.expires_at) < new Date()) {
      return NextResponse.json({ error: { code: 'SESSION_EXPIRED' } }, { status: 401 });
    }

    // Extend session expiry by 24 hours from now (fire-and-forget)
    const nowIso = new Date().toISOString();
    const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    supabaseAdmin
      .from('active_sessions')
      .update({ last_active_at: nowIso, expires_at: newExpiresAt })
      .eq('id', activeSession.id)
      .then()
      .catch(console.error);

    return NextResponse.json({ valid: true, server_time: nowIso });
  } catch (err: unknown) {
    console.error('[Heartbeat Error]', err);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}

