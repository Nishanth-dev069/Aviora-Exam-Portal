/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { syncExamStatuses } from '@/lib/supabase/syncStatuses';

function computeExamAvailability(exam: any, nowIso: string): boolean {
  if (exam.status === 'completed' || exam.deleted_at) return false;
  if (exam.type === 'practice') return exam.status === 'active';
  if (exam.type === 'scheduled') {
    const nowDate = new Date(nowIso);
    const start = exam.scheduled_at ? new Date(exam.scheduled_at) : null;
    const end = exam.ends_at ? new Date(exam.ends_at) : null;
    return (
      (exam.status === 'active' || exam.status === 'scheduled') &&
      (!start || nowDate >= start) &&
      (!end || nowDate <= end)
    );
  }
  return false;
}

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

    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    await syncExamStatuses(supabaseAdmin);

    // Run primary dashboard queries in parallel using supabaseAdmin for authenticated student
    const [
      profileResult,
      practiceExamsResult,
      enrollmentsResult,
      recentResultsResult,
    ] = await Promise.all([
      // 1. Student profile + batch
      supabaseAdmin
        .from('student_profiles')
        .select('id, full_name, roll_number, photo_url, batch_id, batches(id, name)')
        .eq('user_id', user.id)
        .maybeSingle(),

      // 2. All active practice exams
      supabaseAdmin
        .from('exams')
        .select('id, title, subject, type, duration_minutes, total_questions, marks_per_question, negative_marks, settings, status, scheduled_at, ends_at')
        .eq('type', 'practice')
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),

      // 3. Scheduled exam enrollments with exam data
      supabaseAdmin
        .from('exam_enrollments')
        .select(`
          exam_id,
          exams!inner(id, title, subject, type, duration_minutes, total_questions, 
                      marks_per_question, negative_marks, status, scheduled_at, ends_at, settings, deleted_at)
        `)
        .eq('student_id', user.id)
        .eq('exams.type', 'scheduled')
        .in('exams.status', ['scheduled', 'active', 'completed']),

      // 4. Last 5 results
      supabaseAdmin
        .from('exam_results')
        .select('id, session_id, exam_id, percentage, total_score, max_score, correct_count, incorrect_count, is_passed, computed_at, exams(id, title, subject, type)')
        .eq('student_id', user.id)
        .order('computed_at', { ascending: false })
        .limit(5),
    ]);

    const practiceExams = practiceExamsResult.data || [];
    
    const rawScheduled = (enrollmentsResult.data || [])
      .map((e: any) => Array.isArray(e.exams) ? e.exams[0] : e.exams)
      .filter((e: any) => e && !e.deleted_at && e.type === 'scheduled');

    rawScheduled.sort((a: any, b: any) => {
      const timeA = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
      const timeB = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
      return timeB - timeA;
    });

    const scheduledExams = rawScheduled;

    // Get all exam IDs to fetch sessions
    const allExamIds = [
      ...practiceExams.map(e => e.id),
      ...scheduledExams.map((e: any) => e.id),
    ];

    let sessions: any[] = [];
    if (allExamIds.length > 0) {
      const { data } = await supabaseAdmin
        .from('exam_sessions')
        .select('id, exam_id, status, started_at, submitted_at, expires_at')
        .eq('student_id', user.id)
        .in('exam_id', allExamIds)
        .order('created_at', { ascending: false });
      sessions = data || [];
    }

    // Fetch results for submitted sessions to show scores on exam cards
    const submittedSessions = sessions.filter(s => s.status === 'submitted');
    let sessionResults: any[] = [];
    if (submittedSessions.length > 0) {
      const { data } = await supabaseAdmin
        .from('exam_results')
        .select('id, session_id, exam_id, percentage, total_score, correct_count, incorrect_count, is_passed')
        .in('session_id', submittedSessions.map(s => s.id));
      sessionResults = data || [];
    }

    // Build examStatusMap
    const examStatusMap: Record<string, any> = {};
    sessions.forEach(session => {
      const priority: Record<string, number> = { submitted: 3, active: 2, expired: 1, terminated: 0 };
      const existing = examStatusMap[session.exam_id];
      const currentPriority = priority[session.status] ?? 0;
      const existingPriority = existing ? (priority[existing.sessionStatus] ?? -1) : -1;
      if (currentPriority > existingPriority) {
        const examResults = sessionResults.filter(r => r.exam_id === session.exam_id);
        const maxResult = examResults.length > 0
          ? examResults.reduce((max, r) => (Number(r.percentage) > Number(max.percentage) ? r : max), examResults[0])
          : (sessionResults.find(r => r.session_id === session.id) || null);

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

    const profileData = profileResult.data;
    const batchesData: any = profileData?.batches;
    const nowIso = new Date().toISOString();

    const enrichedScheduled = scheduledExams.map((exam: any) => ({
      ...exam,
      is_available: computeExamAvailability(exam, nowIso),
    }));

    const enrichedPractice = practiceExams.map((exam: any) => ({
      ...exam,
      is_available: computeExamAvailability(exam, nowIso),
    }));

    return NextResponse.json(
      {
        serverTime: nowIso,
        profile: {
          id: profileData?.id,
          full_name: profileData?.full_name || 'Student',
          roll_number: profileData?.roll_number || 'Unassigned',
          photo_url: profileData?.photo_url || null,
          batch_name: (Array.isArray(batchesData) ? batchesData[0]?.name : batchesData?.name) || null,
        },
        practiceExams: enrichedPractice,
        scheduledExams: enrichedScheduled,
        recentResults: recentResultsResult.data || [],
        examStatusMap,
      },
      {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      }
    );

  } catch (err: any) {
    console.error('[GET /api/student/dashboard] Exception:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to load dashboard data.' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
