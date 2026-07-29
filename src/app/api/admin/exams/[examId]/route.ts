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

export async function GET(request: Request, { params }: { params: Promise<{ examId: string }> }) {
  const auth = await verifyAdmin();
  if (auth.error) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: auth.error } }, { status: auth.status });

  const { examId } = await params;

  await syncExamStatuses(supabaseAdmin);

  // Fetch full exam details
  const { data: exam, error: examError } = await supabaseAdmin
    .from('exams')
    .select('*')
    .eq('id', examId)
    .is('deleted_at', null)
    .single();

  if (examError || !exam) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Exam not found or has been deleted' } }, { status: 404 });
  }

  // Fetch questions in this exam
  const { data: examQuestions } = await supabaseAdmin
    .from('exam_questions')
    .select(`
      id,
      base_order,
      marks,
      questions!inner (
        id,
        content,
        difficulty,
        subject,
        topic,
        explanation
      )
    `)
    .eq('exam_id', examId)
    .order('base_order', { ascending: true });

  // Fetch enrollments
  const { data: rawEnrollments } = await supabaseAdmin
    .from('exam_enrollments')
    .select('id, created_at, student_id')
    .eq('exam_id', examId)
    .order('created_at', { ascending: false });

  let enrollments: any[] = [];
  if (rawEnrollments && rawEnrollments.length > 0) {
    const studentIds = rawEnrollments.map(e => e.student_id);
    const { data: profiles } = await supabaseAdmin
      .from('student_profiles')
      .select('user_id, full_name, roll_number, batch_id, batches(name)')
      .in('user_id', studentIds);

    const profileMap = new Map();
    (profiles || []).forEach((p: any) => profileMap.set(p.user_id, p));

    enrollments = rawEnrollments.map(e => {
      const prof = profileMap.get(e.student_id);
      return {
        id: e.id,
        created_at: e.created_at,
        student_id: e.student_id,
        student_profiles: prof ? {
          full_name: prof.full_name,
          roll_number: prof.roll_number,
          batch_id: prof.batch_id,
          batches: Array.isArray(prof.batches) ? prof.batches[0] : prof.batches,
        } : { full_name: 'Student', roll_number: '—' }
      };
    });
  }

  // Fetch submissions count
  const { count: submissionCount } = await supabaseAdmin
    .from('exam_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('exam_id', examId)
    .eq('status', 'submitted');

  return NextResponse.json({
    success: true,
    exam,
    questions: examQuestions || [],
    enrollments: enrollments || [],
    submission_count: submissionCount || 0
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ examId: string }> }) {
  const auth = await verifyAdmin();
  if (auth.error) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: auth.error } }, { status: auth.status });

  const { examId } = await params;

  // Check exam status
  const { data: exam } = await supabaseAdmin
    .from('exams')
    .select('id, status')
    .eq('id', examId)
    .single();

  if (!exam) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Exam not found' } }, { status: 404 });
  }

  if (exam.status !== 'draft') {
    return NextResponse.json({
      error: {
        code: 'FORBIDDEN',
        message: 'Completed or active exams cannot be deleted to preserve result history. Archive it instead.'
      }
    }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('exams')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', examId);

  if (error) {
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Draft exam deleted successfully' });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ examId: string }> }) {
  const auth = await verifyAdmin();
  if (auth.error) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: auth.error } }, { status: auth.status });

  const { examId } = await params;
  const body = await request.json();

  if (body.action === 'archive') {
    const { error } = await supabaseAdmin
      .from('exams')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', examId);

    if (error) return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
    return NextResponse.json({ success: true, message: 'Exam archived' });
  }

  if (body.action === 'update_info' || body.action === 'edit_exam') {
    const {
      title,
      subject,
      description,
      instructions,
      type,
      duration_minutes,
      marks_per_question,
      negative_marks,
      passing_marks,
      scheduled_at,
      ends_at,
      settings
    } = body;

    const parseToISO = (val: any) => {
      if (!val || typeof val !== 'string' || !val.trim()) return null;
      const d = new Date(val);
      if (isNaN(d.getTime())) return null;
      return d.toISOString();
    };

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (title !== undefined) updatePayload.title = title;
    if (subject !== undefined) updatePayload.subject = subject;
    if (description !== undefined) updatePayload.description = description ? description.trim() : null;
    if (instructions !== undefined) updatePayload.instructions = instructions ? instructions.trim() : null;
    if (type !== undefined) updatePayload.type = type;
    if (duration_minutes !== undefined) updatePayload.duration_minutes = Number(duration_minutes);
    if (marks_per_question !== undefined) updatePayload.marks_per_question = Number(marks_per_question);
    if (negative_marks !== undefined) updatePayload.negative_marks = Number(negative_marks);
    if (passing_marks !== undefined) updatePayload.passing_marks = passing_marks !== null && passing_marks !== '' ? Number(passing_marks) : null;
    
    if (type === 'practice') {
      updatePayload.scheduled_at = null;
      updatePayload.ends_at = null;
      updatePayload.status = 'active';
    } else {
      if (scheduled_at !== undefined) updatePayload.scheduled_at = parseToISO(scheduled_at);
      if (ends_at !== undefined) updatePayload.ends_at = parseToISO(ends_at);
    }

    if (settings !== undefined) updatePayload.settings = settings;

    const { error: updateError } = await supabaseAdmin
      .from('exams')
      .update(updatePayload)
      .eq('id', examId);

    if (updateError) {
      console.error('[Update Exam Error]', updateError);
      return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: updateError.message } }, { status: 500 });
    }

    await syncExamStatuses(supabaseAdmin);

    return NextResponse.json({ success: true, message: 'Exam details updated successfully' });
  }

  return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid action' } }, { status: 400 });
}
