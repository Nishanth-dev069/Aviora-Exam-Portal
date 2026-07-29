/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { syncExamStatuses } from '@/lib/supabase/syncStatuses';

export async function GET() {
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

    // Step 1: Get authenticated user
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();
    if (!user || authError) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    await syncExamStatuses(supabaseAdmin);

    // Step 2: Fetch PRACTICE exams — available to all students
    const { data: practiceExams, error: practiceError } = await supabaseAdmin
      .from('exams')
      .select(`
        id,
        title,
        subject,
        type,
        duration_minutes,
        total_questions,
        marks_per_question,
        negative_marks,
        status,
        settings
      `)
      .eq('type', 'practice')
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (practiceError) {
      console.error('[GET /api/student/exams] practiceError:', practiceError);
      return NextResponse.json({ 
        error: { code: 'INTERNAL_ERROR', message: 'Failed to load practice exams.' } 
      }, { status: 500 });
    }

    // Step 3: Fetch SCHEDULED exams — only scheduled type exams this student is enrolled in
    const { data: scheduledEnrollments, error: schedError } = await supabaseAdmin
      .from('exam_enrollments')
      .select(`
        exam_id,
        created_at,
        exams!inner (
          id,
          title,
          subject,
          type,
          duration_minutes,
          total_questions,
          marks_per_question,
          negative_marks,
          status,
          scheduled_at,
          ends_at,
          settings,
          deleted_at
        )
      `)
      .eq('student_id', user.id)
      .eq('exams.type', 'scheduled')
      .in('exams.status', ['scheduled', 'active', 'completed']);

    if (schedError) {
      console.error('[GET /api/student/exams] schedError:', schedError);
      return NextResponse.json({ 
        error: { code: 'INTERNAL_ERROR', message: 'Failed to load scheduled exams.' } 
      }, { status: 500 });
    }

    const rawScheduled = (scheduledEnrollments || [])
      .map((e: any) => Array.isArray(e.exams) ? e.exams[0] : e.exams)
      .filter((e: any) => e && !e.deleted_at && e.type === 'scheduled');

    rawScheduled.sort((a: any, b: any) => {
      const timeA = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
      const timeB = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
      return timeB - timeA;
    });

    const scheduledExams = rawScheduled;

    // Step 4: Get student sessions for all relevant exam IDs
    const allExamIds = [
      ...(practiceExams?.map(e => e.id) || []),
      ...(scheduledExams?.map((e: any) => e.id) || []),
    ];

    let sessions: any[] = [];
    if (allExamIds.length > 0) {
      const { data: sessionData, error: sessionError } = await supabaseAdmin
        .from('exam_sessions')
        .select(`
          id,
          exam_id,
          status,
          started_at,
          submitted_at,
          expires_at
        `)
        .eq('student_id', user.id)
        .in('exam_id', allExamIds)
        .order('created_at', { ascending: false });
      
      if (!sessionError) {
        sessions = sessionData || [];
      }
    }

    // Step 5: Get exam results for submitted sessions
    const submittedSessionIds = sessions
      .filter(s => s.status === 'submitted')
      .map(s => s.id);
    
    let results: any[] = [];
    if (submittedSessionIds.length > 0) {
      const { data: resultsData } = await supabaseAdmin
        .from('exam_results')
        .select('id, session_id, exam_id, percentage, total_score, correct_count, incorrect_count, is_passed, computed_at')
        .in('session_id', submittedSessionIds);
      results = resultsData || [];
    }

    // Step 6: Build lookup map: examId -> { sessionId, sessionStatus, startedAt, submittedAt, expiresAt, result }
    const examStatusMap: Record<string, {
      sessionId: string;
      sessionStatus: string;
      startedAt: string;
      submittedAt: string | null;
      expiresAt?: string | null;
      result: any | null;
    }> = {};

    sessions.forEach(session => {
      const existingEntry = examStatusMap[session.exam_id];
      const priority = { submitted: 3, active: 2, expired: 1, terminated: 0 };
      const currentPriority = priority[session.status as keyof typeof priority] ?? 0;
      const existingPriority = existingEntry 
        ? (priority[existingEntry.sessionStatus as keyof typeof priority] ?? 0) 
        : -1;
      
      if (currentPriority > existingPriority) {
        const examResults = results.filter(r => r.exam_id === session.exam_id);
        const maxResult = examResults.length > 0
          ? examResults.reduce((max, r) => (Number(r.percentage) > Number(max.percentage) ? r : max), examResults[0])
          : (results.find(r => r.session_id === session.id) || null);

        examStatusMap[session.exam_id] = {
          sessionId: session.id,
          sessionStatus: session.status,
          startedAt: session.started_at,
          submittedAt: session.submitted_at,
          expiresAt: session.expires_at,
          result: maxResult,
        };
      }
    });

    return NextResponse.json({
      practiceExams: practiceExams || [],
      scheduledExams: scheduledExams || [],
      examStatusMap,
    });

  } catch (err: any) {
    console.error('[GET /api/student/exams] Exception:', err);
    return NextResponse.json({ 
      error: { code: 'INTERNAL_ERROR', message: 'Failed to load exams.' } 
    }, { status: 500 });
  }
}
