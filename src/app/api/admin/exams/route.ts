export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

  const { data: { session }, error: authError } = await supabaseAnon.auth.getSession();
  const user = session?.user ?? null;
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

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (auth.error) {
    return NextResponse.json({ error: { code: auth.error } }, { status: auth.status });
  }

  const adminUser = auth.user!;
  
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request body.' }
    }, { status: 400 });
  }

  // Handle both flat structure and nested wizard structure
  const basicInfo = body.basic_info || body;
  const questions = body.questions || body;
  const settings = body.settings || body.settings || {};
  const schedule = body.schedule || {};
  const enrollment = body.enrollment || {};

  const bankId = questions.bank_id || body.bank_id;
  const title = (basicInfo.title || body.title || '').trim();
  const subject = (basicInfo.subject || body.subject || '').trim();
  const examType = basicInfo.type || body.type;
  const duration = Number(basicInfo.duration || body.duration_minutes);
  const totalQuestions = Number(questions.count || body.total_questions);

  // Validate required fields
  const missingFields: string[] = [];
  if (!title) missingFields.push('title');
  if (!examType) missingFields.push('type');
  if (!subject) missingFields.push('subject');
  if (!duration || duration <= 0) missingFields.push('duration');
  if (!bankId) missingFields.push('bank_id');
  if (!totalQuestions || totalQuestions <= 0) missingFields.push('total_questions');

  if (missingFields.length > 0) {
    return NextResponse.json({
      error: {
        code: 'VALIDATION_ERROR',
        message: `Missing required fields: ${missingFields.join(', ')}`,
        details: missingFields.map(f => ({ field: f, message: `${f} is required` }))
      }
    }, { status: 400 });
  }

  try {
    // Step 1: Fetch Questions and Validate Constraints
    const { data: dbQuestions, error: qError } = await supabaseAdmin
      .from('questions')
      .select('id, difficulty')
      .eq('bank_id', bankId)
      .is('deleted_at', null);

    if (qError || !dbQuestions) {
      console.error('[Create Exam - Fetch Questions]', qError);
      return NextResponse.json({
        error: { code: 'VALIDATION_ERROR', message: 'Failed to fetch question bank data: ' + (qError?.message || 'Unknown error') }
      }, { status: 400 });
    }

    let selectedQuestions: { id: string, difficulty?: string }[] = [];
    const selectionType = questions.selection_type || 'Auto';

    if (selectionType === 'Auto') {
      if (dbQuestions.length < totalQuestions) {
        return NextResponse.json({
          error: {
            code: 'VALIDATION_ERROR',
            message: `Not enough questions in bank. Bank has ${dbQuestions.length}, need ${totalQuestions}.`
          }
        }, { status: 400 });
      }
      selectedQuestions = shuffle(dbQuestions).slice(0, totalQuestions);
    } else {
      // Manual difficulty selection
      const easy = dbQuestions.filter(q => (q.difficulty || '').toLowerCase() === 'easy');
      const medium = dbQuestions.filter(q => (q.difficulty || '').toLowerCase() === 'medium');
      const hard = dbQuestions.filter(q => (q.difficulty || '').toLowerCase() === 'hard');

      const reqEasy = questions.manual_counts?.easy || 0;
      const reqMedium = questions.manual_counts?.medium || 0;
      const reqHard = questions.manual_counts?.hard || 0;

      if (easy.length < reqEasy || medium.length < reqMedium || hard.length < reqHard) {
        return NextResponse.json({
          error: {
            code: 'VALIDATION_ERROR',
            message: `Not enough questions matching requested difficulty counts. (Easy: ${easy.length}/${reqEasy}, Medium: ${medium.length}/${reqMedium}, Hard: ${hard.length}/${reqHard})`
          }
        }, { status: 400 });
      }

      const selectedEasy = shuffle(easy).slice(0, reqEasy);
      const selectedMedium = shuffle(medium).slice(0, reqMedium);
      const selectedHard = shuffle(hard).slice(0, reqHard);

      selectedQuestions = shuffle([...selectedEasy, ...selectedMedium, ...selectedHard]);
    }

    // Step 2: Determine Exam Status
    const status = examType === 'practice' ? 'active' : 'scheduled';

    const marksPerQuestion = Number(basicInfo.marks_per_question || body.marks_per_question) || 1.0;
    const negativeMarking = basicInfo.negative_marking ?? body.negative_marking ?? false;
    const negativeMarksVal = negativeMarking ? (Number(basicInfo.negative_marks_value || body.negative_marks) || 0.25) : 0.0;

    const parseToISO = (val: any) => {
      if (!val || typeof val !== 'string' || !val.trim()) return null;
      const d = new Date(val);
      if (isNaN(d.getTime())) return null;
      return d.toISOString();
    };

    const scheduledAtVal = examType === 'scheduled' ? parseToISO(schedule.start_date || body.scheduled_at) : null;
    const endsAtVal = examType === 'scheduled' ? parseToISO(schedule.end_date || body.ends_at) : null;

    // Step 3: Insert into exams table
    const { data: exam, error: examError } = await supabaseAdmin
      .from('exams')
      .insert({
        bank_id: bankId,
        title,
        subject,
        description: (basicInfo.description || body.description)?.trim() || null,
        instructions: (basicInfo.instructions || body.instructions)?.trim() || null,
        type: examType,
        duration_minutes: duration,
        total_questions: totalQuestions,
        marks_per_question: marksPerQuestion,
        negative_marks: negativeMarksVal,
        passing_marks: basicInfo.passing_marks ? Number(basicInfo.passing_marks) : (body.passing_marks ? Number(body.passing_marks) : null),
        status,
        scheduled_at: scheduledAtVal,
        ends_at: endsAtVal,
        settings: {
          randomize_questions: settings.randomize_questions ?? true,
          randomize_options: settings.randomize_options ?? true,
          fullscreen_required: settings.fullscreen_required ?? true,
          max_tab_switches: settings.max_tab_switches ?? 5,
          auto_submit_on_max_violations: settings.auto_submit ?? false,
          show_result_immediately: settings.show_result ?? true,
          allow_question_review: settings.allow_review ?? true,
          show_leaderboard_after: settings.leaderboard_timing ?? 'exam_end',
          watermark_enabled: settings.watermark ?? true
        },
        created_by: adminUser.id,
        updated_by: adminUser.id
      })
      .select()
      .single();

    if (examError || !exam) {
      console.error('[Create Exam - Insert Exam]', examError);
      return NextResponse.json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create exam: ' + (examError?.message || 'Unknown error') }
      }, { status: 500 });
    }

    // Step 4: Insert into exam_questions
    const examQuestionsToInsert = selectedQuestions.map((q, index) => ({
      exam_id: exam.id,
      question_id: q.id,
      base_order: index,
      marks: marksPerQuestion
    }));

    const { error: eqError } = await supabaseAdmin
      .from('exam_questions')
      .insert(examQuestionsToInsert);

    if (eqError) {
      console.error('[Create Exam - Insert Questions]', eqError);
      await supabaseAdmin.from('exams').delete().eq('id', exam.id);
      return NextResponse.json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to assign questions to exam: ' + eqError.message }
      }, { status: 500 });
    }

    // Step 5: Expand Batches & Students into Enrollments
    const finalStudentIds = new Set<string>();

    const individualStudents = enrollment.individual_students || body.enrolled_student_ids || [];
    individualStudents.forEach((id: string) => finalStudentIds.add(id));

    const selectedBatches = enrollment.batches || body.enrolled_batch_ids || [];
    if (selectedBatches.length > 0) {
      const { data: batchStudents } = await supabaseAdmin
        .from('student_profiles')
        .select('user_id')
        .in('batch_id', selectedBatches)
        .is('deleted_at', null);
      
      if (batchStudents) {
        batchStudents.forEach(s => finalStudentIds.add(s.user_id));
      }
    }

    if (finalStudentIds.size > 0) {
      const enrollmentRows = Array.from(finalStudentIds).map(studentId => ({
        exam_id: exam.id,
        student_id: studentId,
        enrolled_by: adminUser.id
      }));

      const { error: enrError } = await supabaseAdmin
        .from('exam_enrollments')
        .insert(enrollmentRows);

      if (enrError) {
        console.error('[Create Exam - Insert Enrollments]', enrError);
      }
    }

    // Step 6: Audit Log
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: adminUser.id,
      actor_role: 'admin',
      action: 'admin.exam_published',
      resource_type: 'exam',
      resource_id: exam.id,
      metadata: { title: exam.title, type: exam.type, enrolled_count: finalStudentIds.size },
      ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1'
    });

    return NextResponse.json({ 
      success: true, 
      exam,
      exam_id: exam.id, 
      enrolled_count: finalStudentIds.size, 
      question_count: selectedQuestions.length 
    }, { status: 201 });

  } catch (err: unknown) {
    console.error('[Create Exam - Unexpected Exception]', err);
    return NextResponse.json({
      error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'An unexpected error occurred.' }
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (auth.error) {
    return NextResponse.json({ error: { code: auth.error } }, { status: auth.status });
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const pageSize = parseInt(url.searchParams.get('pageSize') || '10', 10);
  const search = url.searchParams.get('search') || '';
  
  let query = supabaseAdmin
    .from('exams')
    .select('*, question_banks(name)', { count: 'exact' })
    .is('deleted_at', null);
    
  if (search) {
    query = query.ilike('title', `%${search}%`);
  }
  
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);
    
  if (error) return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 400 });
  return NextResponse.json({ data: data ?? [], count: count ?? 0, page, pageSize });
}
