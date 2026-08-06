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
      return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    } 
    // Verify admin role
    const { data: adminUser } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!adminUser || !['admin', 'super_admin'].includes(adminUser.role)) {
      return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
    }

    // Fetch session
    const { data: session } = await supabaseAdmin
      .from('exam_sessions')
      .select('id, status, exam_id, student_id, submission_token')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Session not found' } }, { status: 404 });
    }

    if (session.status !== 'active' && session.status !== 'in_progress') {
      return NextResponse.json({ error: { code: 'SESSION_NOT_ACTIVE', message: `Session status is '${session.status}' and cannot be force submitted.` } }, { status: 400 });
    }

    // Mark session submitted with timestamp
    const nowIso = new Date().toISOString();
    await supabaseAdmin
      .from('exam_sessions')
      .update({
        status: 'submitted',
        submitted_at: nowIso,
        updated_at: nowIso
      })
      .eq('id', sessionId);

    // Compute result using submit_exam_session RPC
    const { data: resultData, error: submitErr } = await supabaseAdmin.rpc('submit_exam_session', {
      p_session_id: sessionId,
      p_student_id: session.student_id,
      p_submission_token: session.submission_token,
      p_ip_address: request.headers.get('x-forwarded-for') || 'admin-force-submit',
      p_student_role: 'admin'
    });

    if (submitErr) {
      console.warn('[Admin Force Submit RPC warning]', submitErr);
    }

    // Write audit log (fire-and-forget)
    void supabaseAdmin.from('audit_logs').insert({
      actor_id: user.id,
      actor_role: adminUser.role,
      action: 'admin.session_force_submitted',
      resource_type: 'exam_session',
      resource_id: sessionId,
      metadata: { reason: 'admin_force_submit' },
      ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1'
    }).then(({ error }) => {
      if (error) console.error('[audit_log_error]', error.message);
    });

    return NextResponse.json({ success: true, result: resultData });
  } catch (err: unknown) {
    console.error('[Admin Force Submit Error]', err);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Internal error' } }, { status: 500 });
  }
}
