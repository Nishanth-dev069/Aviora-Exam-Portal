import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';

async function verifyAdmin() {
  const cookieStore = await cookies();
  const supabaseAnon = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );

  const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();
  if (authError || !user) return { error: 'UNAUTHORIZED', status: 401 };

  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('role, deleted_at')
    .eq('id', user.id)
    .single();

  if (!userData || !['admin', 'super_admin'].includes(userData.role) || userData.deleted_at) {
    return { error: 'FORBIDDEN', status: 403 };
  }

  return { user, adminRole: userData.role };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const auth = await verifyAdmin();
  if (auth.error) {
    return NextResponse.json({ error: { code: auth.error } }, { status: auth.status });
  }

  const { examId } = await params;

  const { data: enrollments, error } = await supabaseAdmin
    .from('exam_enrollments')
    .select(`
      id,
      student_id,
      enrolled_at,
      student_profiles (
        full_name,
        roll_number,
        batch_id,
        batches (
          name
        )
      )
    `)
    .eq('exam_id', examId);

  if (error) {
    console.error('[Get Enrollments Error]', error);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatted = (enrollments || []).map((e: any) => ({
    id: e.id,
    student_id: e.student_id,
    enrolled_at: e.enrolled_at,
    full_name: e.student_profiles?.full_name || 'Student',
    roll_number: e.student_profiles?.roll_number || '—',
    batch_name: e.student_profiles?.batches?.name || 'Unassigned',
  }));

  return NextResponse.json({ enrollments: formatted });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const auth = await verifyAdmin();
  if (auth.error) {
    return NextResponse.json({ error: { code: auth.error } }, { status: auth.status });
  }

  const { examId } = await params;

  const user = auth.user!;
  const adminRole = auth.adminRole!;

  const body = await request.json();
  const { student_ids = [], batch_ids = [] }: { student_ids: string[]; batch_ids: string[] } = body;

  let allStudentIds = [...student_ids];

  if (batch_ids.length > 0) {
    const { data: batchStudents } = await supabaseAdmin
      .from('student_profiles')
      .select('user_id')
      .in('batch_id', batch_ids);

    const batchStudentIds = (batchStudents || []).map((s: any) => s.user_id).filter(Boolean);
    allStudentIds = Array.from(new Set([...allStudentIds, ...batchStudentIds]));
  }

  if (allStudentIds.length === 0) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'No students selected.' } }, { status: 400 });
  }

  const enrollmentRows = allStudentIds.map(studentId => ({
    exam_id: examId,
    student_id: studentId,
    enrolled_by: user.id,
  }));

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('exam_enrollments')
    .upsert(enrollmentRows, {
      onConflict: 'exam_id,student_id',
      ignoreDuplicates: true,
    })
    .select('id');

  if (insertError) {
    console.error('[Add Enrollments Error]', insertError);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: insertError.message } }, { status: 500 });
  }

  // Write audit log
  await supabaseAdmin.from('audit_logs').insert({
    actor_id: user.id,
    actor_role: adminRole,
    action: 'admin.exam_enrollments_updated',
    resource_type: 'exam',
    resource_id: examId,
    metadata: {
      added_student_ids: allStudentIds,
      added_batch_ids: batch_ids,
      new_enrollment_count: inserted?.length ?? 0,
    },
    ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1'
  });

  return NextResponse.json({
    success: true,
    added_count: inserted?.length ?? 0,
  });
}
