import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { syncExamStatuses } from '@/lib/supabase/syncStatuses';

async function verifyAdmin() {
  const cookieStore = await cookies();
  const supabaseAnon = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );

  const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized', status: 401 };

  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!userData || !['admin', 'super_admin'].includes(userData.role)) {
    return { error: 'Forbidden', status: 403 };
  }

  return { user, supabaseAdmin };
}

export async function GET(request: Request) {
  const auth = await verifyAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const examId = searchParams.get('examId');

  if (!examId) {
    return NextResponse.json({ error: 'Missing examId parameter' }, { status: 400 });
  }

  try {
    await syncExamStatuses(supabaseAdmin);

    // Fetch enrollments and sessions in parallel
    const [enrollmentsRes, sessionsRes] = await Promise.all([
      supabaseAdmin
        .from('exam_enrollments')
        .select('id, student_id')
        .eq('exam_id', examId),
      supabaseAdmin
        .from('exam_sessions')
        .select('id, student_id, status, started_at, expires_at, submitted_at, last_synced_at, security_violations')
        .eq('exam_id', examId),
    ]);

    const enrollments = enrollmentsRes.data;
    const sessions = sessionsRes.data;

    // Collect all distinct student_ids
    const studentIds = Array.from(new Set([
      ...(enrollments?.map(e => e.student_id) || []),
      ...(sessions?.map(s => s.student_id) || [])
    ]));

    // Fetch profiles for these student_ids
    const { data: profiles } = studentIds.length > 0
      ? await supabaseAdmin.from('student_profiles').select('user_id, full_name, roll_number').in('user_id', studentIds)
      : { data: [] };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const studentMap = new Map<string, any>();

    // Add enrolled students
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (enrollments || []).forEach((e: any) => {
      const p = profileMap.get(e.student_id);
      studentMap.set(e.student_id, {
        enrolled_id: e.id,
        student_id: e.student_id,
        full_name: p?.full_name || 'Enrolled Student',
        roll_number: p?.roll_number || '—',
        session_id: null,
        status: null,
        started_at: null,
        expires_at: null,
        submitted_at: null,
        last_synced_at: null,
        security_violations: 0,
      });
    });

    // Add or merge active/submitted session students
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sessions || []).forEach((s: any) => {
      const p = profileMap.get(s.student_id);
      const existing = studentMap.get(s.student_id) || {};
      studentMap.set(s.student_id, {
        enrolled_id: existing.enrolled_id || s.id,
        student_id: s.student_id,
        full_name: p?.full_name || existing.full_name || 'Student',
        roll_number: p?.roll_number || existing.roll_number || '—',
        session_id: s.id,
        status: s.status,
        started_at: s.started_at,
        expires_at: s.expires_at,
        submitted_at: s.submitted_at,
        last_synced_at: s.last_synced_at,
        security_violations: s.security_violations || 0,
      });
    });

    const data = Array.from(studentMap.values());
    data.sort((a, b) => a.full_name.localeCompare(b.full_name));

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await verifyAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const adminUser = auth.user!;

  try {
    const { session_id } = await request.json();
    if (!session_id) throw new Error('Missing session_id');

    // Fetch submission token and student ID securely via Service Role
    const { data: sessionData, error: sessionErr } = await supabaseAdmin
      .from('exam_sessions')
      .select('student_id, submission_token')
      .eq('id', session_id)
      .single();
    
    if (sessionErr || !sessionData) throw new Error('Session not found');

    // Call submit_exam_session RPC
    const { data: resultData, error: submitErr } = await supabaseAdmin.rpc('submit_exam_session', {
      p_session_id: session_id,
      p_student_id: sessionData.student_id,
      p_submission_token: sessionData.submission_token,
      p_ip_address: request.headers.get('x-forwarded-for') || 'admin-force-submit',
      p_student_role: 'student'
    });

    if (submitErr) throw submitErr;

    // Log audit action
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: adminUser.id,
      actor_role: 'admin',
      action: 'admin.force_submit_exam',
      resource_type: 'exam_session',
      resource_id: session_id,
      metadata: { student_id: sessionData.student_id }
    });

    return NextResponse.json({ success: true, result: resultData });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal Error' }, { status: 500 });
  }
}
