import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
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

    const { data: { session: authSession }, error: authError } = await supabaseAnon.auth.getSession();
    const user = authSession?.user ?? null;
    if (authError || !user) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // Verify admin / super_admin role
    const { data: adminUser } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!adminUser || !['admin', 'super_admin'].includes(adminUser.role)) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin permissions required' } }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const extraMinutes = typeof body.extra_minutes === 'number' ? Math.max(1, body.extra_minutes) : 30;
    const resetViolations = body.reset_violations !== false; // Default true
    const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'Admin session restore';

    // Fetch existing session
    const { data: session, error: sessionFetchErr } = await supabaseAdmin
      .from('exam_sessions')
      .select('id, status, exam_id, student_id, expires_at, security_violations')
      .eq('id', sessionId)
      .single();

    if (sessionFetchErr || !session) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Exam session not found' } }, { status: 404 });
    }

    if (!['submitted', 'expired', 'terminated'].includes(session.status)) {
      return NextResponse.json({
        error: {
          code: 'SESSION_NOT_RESTORABLE',
          message: `Session is currently '${session.status}' and cannot be restored.`
        }
      }, { status: 400 });
    }

    // Try RPC first if created in Supabase
    const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc('admin_restore_exam_session', {
      p_session_id: sessionId,
      p_extra_minutes: extraMinutes,
      p_reset_violations: resetViolations,
      p_admin_id: user.id,
      p_reason: reason
    });

    if (!rpcErr && rpcData?.success) {
      return NextResponse.json({
        success: true,
        message: 'Session successfully restored',
        session: rpcData
      });
    }

    // Fallback: Direct database updates if RPC is not yet executed in Supabase instance
    const currentExpiry = new Date(session.expires_at).getTime();
    const baseTime = Math.max(currentExpiry, Date.now());
    const newExpiresAt = new Date(baseTime + extraMinutes * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    // 1. Remove premature result
    await supabaseAdmin
      .from('exam_results')
      .delete()
      .eq('session_id', sessionId);

    // 2. Update session status back to active
    const { data: updatedSession, error: updateErr } = await supabaseAdmin
      .from('exam_sessions')
      .update({
        status: 'active',
        submitted_at: null,
        security_violations: resetViolations ? 0 : session.security_violations,
        expires_at: newExpiresAt,
        updated_at: nowIso
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (updateErr) {
      throw updateErr;
    }

    // 3. Write audit log (fire-and-forget)
    void supabaseAdmin.from('audit_logs').insert({
      actor_id: user.id,
      actor_role: adminUser.role,
      action: 'admin.session_restored',
      resource_type: 'exam_session',
      resource_id: sessionId,
      metadata: {
        reason,
        extra_minutes: extraMinutes,
        reset_violations: resetViolations,
        previous_status: session.status,
        new_expires_at: newExpiresAt
      },
      ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1'
    }).then(({ error }) => {
      if (error) console.error('[audit_log_error]', error.message);
    });

    return NextResponse.json({
      success: true,
      message: 'Session successfully restored',
      session: {
        id: updatedSession.id,
        status: updatedSession.status,
        expires_at: updatedSession.expires_at,
        security_violations: updatedSession.security_violations
      }
    });

  } catch (err: unknown) {
    console.error('[Admin Restore Session Error]', err);
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Internal server error while restoring session'
      }
    }, { status: 500 });
  }
}
