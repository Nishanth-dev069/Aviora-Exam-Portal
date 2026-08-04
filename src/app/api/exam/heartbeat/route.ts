import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sha256Hex } from '@/lib/auth/hash';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ENABLE_PROFILING = process.env.ENABLE_PROFILING === 'true';
  const tRouteStart = ENABLE_PROFILING ? performance.now() : 0;
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
    const tAuthStart = ENABLE_PROFILING ? performance.now() : 0;
    const { data: { session }, error: authError } = await supabaseAnon.auth.getSession();
    const tAuthEnd = ENABLE_PROFILING ? performance.now() : 0;
    const user = session?.user ?? null;

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' } },
        { status: 401 }
      );
    }

    const verifiedActiveSessionId = request.headers.get('x-active-session-id');
    let activeSessionId = verifiedActiveSessionId;

    if (!activeSessionId) {
      const deviceSessionUUID = cookieStore.get('aviora-device-session')?.value;
      if (!deviceSessionUUID) {
        return NextResponse.json(
          { error: { code: 'SESSION_TERMINATED', message: 'Session token missing.' } },
          { status: 401 }
        );
      }

      const tokenHash = await sha256Hex(deviceSessionUUID);

      // Check active_sessions entry
      const { data: activeSession } = await supabaseAdmin
        .from('active_sessions')
        .select('id, status, expires_at')
        .eq('user_id', user.id)
        .eq('token_hash', tokenHash)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (!activeSession) {
        // Distinguish real termination (another device active) from invalid/expired
        const { data: otherActiveSession } = await supabaseAdmin
          .from('active_sessions')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        const isRealTermination = !!otherActiveSession;

        return NextResponse.json(
          { 
            error: { 
              code: isRealTermination ? 'SESSION_TERMINATED' : 'UNAUTHORIZED', 
              message: isRealTermination 
                ? 'Your session was terminated. You have been logged in on another device.' 
                : 'Session expired or invalid.' 
            } 
          },
          { status: 401 }
        );
      }
      activeSessionId = activeSession.id;
    }

    const nowIso = new Date().toISOString();
    const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    supabaseAdmin
      .from('active_sessions')
      .update({ last_active_at: nowIso, expires_at: newExpiresAt })
      .eq('id', activeSessionId)
      .then();


    const requestId = request.headers.get('x-request-id') || 'unknown';

    if (ENABLE_PROFILING) {
      const isRsc = request.headers.get('rsc') === '1' || (request.headers.get('accept') || '').includes('text/x-component');
      console.log(`[IDENTITY_TRACE]\nRequest ID: ${requestId}\nLayer: exam_heartbeat\nOrigin: route_handler\nPath: /api/exam/heartbeat\nMethod: POST\nIs RSC: ${isRsc}\nSource: Supabase Auth Session\nUser ID: ${user.id}\nEmail: ${user.email || 'N/A'}\nActive Session ID: ${activeSessionId || 'none'}\nTimestamp: ${new Date().toISOString()}`);
    }

    if (!ENABLE_PROFILING) {
      return NextResponse.json({ valid: true, server_time: nowIso });
    }

    const routeTotalMs = performance.now() - tRouteStart;
    const authMs = tAuthEnd - tAuthStart;
    const mwTiming = request.headers.get('x-mw-timing') || '';
    const routeTimingStr = `route_auth;dur=${authMs.toFixed(1)}, route_total;dur=${routeTotalMs.toFixed(1)}`;
    const fullServerTiming = mwTiming ? `${mwTiming}, ${routeTimingStr}, req_id;desc="${requestId}"` : `${routeTimingStr}, req_id;desc="${requestId}"`;
    console.log(`[PROFILER][X-Request-ID: ${requestId}] [Heartbeat Route Telemetry] ${routeTimingStr}`);

    return NextResponse.json(
      { valid: true, server_time: nowIso },
      {
        headers: {
          'X-Request-ID': requestId,
          'Server-Timing': fullServerTiming
        }
      }
    );
  } catch (err: unknown) {
    console.error('[Exam Heartbeat Error]', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Internal error' } },
      { status: 500 }
    );
  }
}

