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

  return { user };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const auth = await verifyAdmin();
  if (auth.error) {
    return NextResponse.json({ error: { code: auth.error } }, { status: auth.status });
  }

  const { batchId } = await params;

  // Validate UUID format before querying
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(batchId)) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Batch not found or invalid ID' } }, { status: 404 });
  }

  // Fetch batch details — use maybeSingle() NOT single()
  const { data: batch, error: batchError } = await supabaseAdmin
    .from('batches')
    .select('id, name, description, created_at, status, deleted_at')
    .eq('id', batchId)
    .is('deleted_at', null)
    .maybeSingle();

  if (batchError) {
    console.error('[Batch API GET] Batch fetch error:', batchError);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: batchError.message } }, { status: 500 });
  }

  if (!batch) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Batch not found or has been archived' } }, { status: 404 });
  }

  // Step 1: Fetch student profiles in this batch
  const { data: studentProfiles, error: studentsError } = await supabaseAdmin
    .from('student_profiles')
    .select(`
      user_id,
      full_name,
      roll_number,
      phone,
      users!inner (
        id,
        email,
        status,
        deleted_at
      )
    `)
    .eq('batch_id', batchId)
    .is('users.deleted_at', null)
    .order('full_name', { ascending: true });

  if (studentsError) {
    console.error('[Batch API GET] Students fetch error:', studentsError);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: studentsError.message } }, { status: 500 });
  }

  const students = studentProfiles ?? [];

  // Step 2: Fetch exam_results for these students
  let examResults: any[] = [];
  if (students.length > 0) {
    const studentUserIds = students.map((s: any) => s.user_id);
    const { data: results, error: resultsError } = await supabaseAdmin
      .from('exam_results')
      .select(`
        id,
        student_id,
        percentage,
        total_score,
        max_score,
        correct_count,
        incorrect_count,
        unanswered_count,
        computed_at,
        exams (
          id,
          title,
          type,
          subject
        )
      `)
      .in('student_id', studentUserIds);

    if (resultsError) {
      console.error('[Batch API GET] Exam results error:', resultsError);
    }
    examResults = results ?? [];
  }

  // Step 3: Compute per-student aggregated metrics & ranks
  const studentStats = students.map((student: any) => {
    const sResults = examResults.filter((r: any) => r.student_id === student.user_id);
    const practiceResults = sResults.filter((r: any) => r.exams?.type === 'practice');
    const scheduledResults = sResults.filter((r: any) => r.exams?.type === 'scheduled');

    const practiceScore = practiceResults.length > 0
      ? practiceResults.reduce((sum: number, r: any) => sum + (Number(r.percentage) || 0), 0) / practiceResults.length
      : 0;

    const examScore = scheduledResults.length > 0
      ? scheduledResults.reduce((sum: number, r: any) => sum + (Number(r.percentage) || 0), 0) / scheduledResults.length
      : 0;

    const totalScore = (practiceScore * 0.3) + (examScore * 0.7);

    return {
      id: student.user_id,
      full_name: student.full_name,
      roll_number: student.roll_number,
      phone: student.phone,
      email: student.users?.email ?? '',
      status: student.users?.status ?? 'active',
      practice_score: Math.round(practiceScore * 10) / 10,
      exam_score: Math.round(examScore * 10) / 10,
      total_score: Math.round(totalScore * 10) / 10,
      practices_taken: practiceResults.length,
      exams_taken: scheduledResults.length,
      practice_results: practiceResults,
      scheduled_results: scheduledResults,
    };
  })
  .sort((a, b) => b.total_score - a.total_score)
  .map((s, idx) => ({ ...s, rank: idx + 1 }));

  return NextResponse.json({
    success: true,
    batch,
    students: studentStats
  });
}
