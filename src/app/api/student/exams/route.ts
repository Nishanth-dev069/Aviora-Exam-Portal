/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );

    // Step 1: Optimization 1 - Use getSession() instead of getUser()
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!user || authError) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    const supabaseAdmin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() { return []; },
          setAll() {},
        },
      }
    );

    // Step 2: Optimization 2 - Call consolidated RPC
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('student_get_exams');

    if (rpcError || !rpcData) {
      // Fallback
      const { data: practiceExams } = await supabaseAdmin.from('exams').select('id, title, subject, type, duration_minutes, total_questions, marks_per_question, negative_marks, status, settings').eq('type', 'practice').eq('status', 'active').is('deleted_at', null).order('created_at', { ascending: false });
      const { data: scheduledEnrollments } = await supabaseAdmin.from('exam_enrollments').select('exam_id, created_at, exams!inner(id, title, subject, type, duration_minutes, total_questions, marks_per_question, negative_marks, status, scheduled_at, ends_at, settings, deleted_at)').eq('student_id', user.id).eq('exams.type', 'scheduled').in('exams.status', ['scheduled', 'active', 'completed']);
      const rawScheduled = (scheduledEnrollments || []).map((e: any) => Array.isArray(e.exams) ? e.exams[0] : e.exams).filter((e: any) => e && !e.deleted_at && e.type === 'scheduled');
      rawScheduled.sort((a: any, b: any) => (b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0) - (a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0));
      const allExamIds = [...(practiceExams?.map(e => e.id) || []), ...(rawScheduled?.map((e: any) => e.id) || [])];
      const sessions = allExamIds.length > 0 ? (await supabaseAdmin.from('exam_sessions').select('id, exam_id, status, started_at, submitted_at, expires_at').eq('student_id', user.id).in('exam_id', allExamIds).order('created_at', { ascending: false })).data || [] : [];
      const submittedSessionIds = sessions.filter(s => s.status === 'submitted').map(s => s.id);
      const results = submittedSessionIds.length > 0 ? (await supabaseAdmin.from('exam_results').select('id, session_id, exam_id, percentage, total_score, correct_count, incorrect_count, is_passed, computed_at').in('session_id', submittedSessionIds)).data || [] : [];

      const examStatusMap: Record<string, any> = {};
      sessions.forEach(sessionItem => {
        const priority = { submitted: 3, active: 2, expired: 1, terminated: 0 };
        const existingEntry = examStatusMap[sessionItem.exam_id];
        const currentPriority = priority[sessionItem.status as keyof typeof priority] ?? 0;
        const existingPriority = existingEntry ? (priority[existingEntry.sessionStatus as keyof typeof priority] ?? 0) : -1;
        if (currentPriority > existingPriority) {
          const examResults = results.filter(r => r.exam_id === sessionItem.exam_id);
          const maxResult = examResults.length > 0 ? examResults.reduce((max, r) => (Number(r.percentage) > Number(max.percentage) ? r : max), examResults[0]) : (results.find(r => r.session_id === sessionItem.id) || null);
          examStatusMap[sessionItem.exam_id] = { sessionId: sessionItem.id, sessionStatus: sessionItem.status, startedAt: sessionItem.started_at, submittedAt: sessionItem.submitted_at, expiresAt: sessionItem.expires_at, result: maxResult };
        }
      });

      return NextResponse.json({ practiceExams: practiceExams || [], scheduledExams: rawScheduled || [], examStatusMap });
    }

    const { practiceExams = [], scheduledExams = [], sessions = [], results = [] } = rpcData;

    const examStatusMap: Record<string, {
      sessionId: string;
      sessionStatus: string;
      startedAt: string;
      submittedAt: string | null;
      expiresAt?: string | null;
      result: any | null;
    }> = {};

    (sessions || []).forEach((sessionItem: any) => {
      const priority = { submitted: 3, active: 2, expired: 1, terminated: 0 };
      const existingEntry = examStatusMap[sessionItem.exam_id];
      const currentPriority = priority[sessionItem.status as keyof typeof priority] ?? 0;
      const existingPriority = existingEntry 
        ? (priority[existingEntry.sessionStatus as keyof typeof priority] ?? 0) 
        : -1;
      
      if (currentPriority > existingPriority) {
        const examResults = (results || []).filter((r: any) => r.exam_id === sessionItem.exam_id);
        const maxResult = examResults.length > 0
          ? examResults.reduce((max: any, r: any) => (Number(r.percentage) > Number(max.percentage) ? r : max), examResults[0])
          : (results.find((r: any) => r.session_id === sessionItem.id) || null);

        examStatusMap[sessionItem.exam_id] = {
          sessionId: sessionItem.id,
          sessionStatus: sessionItem.status,
          startedAt: sessionItem.started_at,
          submittedAt: sessionItem.submitted_at,
          expiresAt: sessionItem.expires_at,
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

