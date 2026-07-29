import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';

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

    const { data: { user } } = await supabaseAnon.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    const body = await req.json();
    const { session_id, event_type, event_data, occurred_at } = body;

    if (!session_id || !event_type) {
      return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Missing session_id or event_type' } }, { status: 400 });
    }

    // Verify session belongs to user
    const { data: session } = await supabaseAdmin
      .from('exam_sessions')
      .select('id, student_id, security_violations, status')
      .eq('id', session_id)
      .single();

    if (!session || session.student_id !== user.id) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Forbidden session access' } }, { status: 403 });
    }

    // Insert into security_events table
    await supabaseAdmin.from('security_events').insert({
      session_id,
      event_type,
      event_data: event_data || {},
      occurred_at: occurred_at || new Date().toISOString(),
    });

    // Atomically increment security_violations counter
    let newViolationCount = (session.security_violations || 0) + 1;
    try {
      const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('increment_violations', { p_session_id: session_id });
      if (rpcErr) throw rpcErr;
      if (typeof rpcRes === 'number') newViolationCount = rpcRes;
    } catch {
      // Fallback if RPC function not present
      await supabaseAdmin
        .from('exam_sessions')
        .update({
          security_violations: newViolationCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', session_id)
        .eq('status', 'active');
    }

    return NextResponse.json({ success: true, security_violations: newViolationCount });
  } catch (err: unknown) {
    console.error('[POST /api/exam/security-event Error]', err);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } }, { status: 500 });
  }
}
