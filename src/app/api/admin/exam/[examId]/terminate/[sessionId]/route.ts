import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ examId: string; sessionId: string }> }
) {
  try {
    const { examId, sessionId } = await params;
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

    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    const { data: adminUser } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!adminUser || !['admin', 'super_admin'].includes(adminUser.role)) {
      return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
    }

    // Fetch session
    const { data: session, error: sessionErr } = await supabaseAdmin
      .from('exam_sessions')
      .select('id, status, student_id, exam_id, submission_token')
      .eq('id', sessionId)
      .single();

    if (sessionErr || !session) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Session not found' } }, { status: 404 });
    }

    if (session.status !== 'active' && session.status !== 'expired') {
      return NextResponse.json({ 
        error: { code: 'SESSION_NOT_ACTIVE', message: `Session status is already '${session.status}'.` } 
      }, { status: 400 });
    }

    // Set status to terminated and record submitted_at
    const nowIso = new Date().toISOString();
    await supabaseAdmin
      .from('exam_sessions')
      .update({
        status: 'terminated',
        submitted_at: nowIso,
        updated_at: nowIso
      })
      .eq('id', sessionId);

    // Call submit_exam_session RPC to compute result from saved answers
    const { data: resultData, error: submitErr } = await supabaseAdmin.rpc('submit_exam_session', {
      p_session_id: sessionId,
      p_student_id: session.student_id,
      p_submission_token: session.submission_token,
      p_ip_address: req.headers.get('x-forwarded-for') || 'admin-terminate',
      p_student_role: 'admin'
    });

    if (submitErr) {
      console.warn('[Admin Terminate submit_exam_session RPC warning]', submitErr);
    }

    // Write audit log
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: user.id,
      actor_role: adminUser.role,
      action: 'exam.session_terminated_by_admin',
      resource_type: 'exam_session',
      resource_id: sessionId,
      metadata: { examId: examId, studentId: session.student_id },
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1'
    });

    return NextResponse.json({ success: true, result: resultData });
  } catch (err: unknown) {
    console.error('[Admin Terminate Exam Error]', err);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Internal error' } }, { status: 500 });
  }
}
