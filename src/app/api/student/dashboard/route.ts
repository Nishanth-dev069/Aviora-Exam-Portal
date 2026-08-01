/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

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
  const tRouteStart = performance.now();
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

    // Optimization 1: Use getSession() instead of getUser()
    const tAuthStart = performance.now();
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const tAuthEnd = performance.now();
    const user = session?.user ?? null;
    if (authError || !user) {
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

    // Optimization 2: Call consolidated RPC function
    const tRpcStart = performance.now();
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('student_get_dashboard');
    const tRpcEnd = performance.now();
    const rpcMs = tRpcEnd - tRpcStart;
    const authMs = tAuthEnd - tAuthStart;
    const totalMs = performance.now() - tRouteStart;

    console.log(`[Dashboard API Telemetry] total=${totalMs.toFixed(1)}ms auth=${authMs.toFixed(1)}ms rpc=${rpcMs.toFixed(1)}ms fallback=${!!rpcError}`);

    if (rpcError || !rpcData) {
      // Fallback in case migration RPC is not applied in current DB environment yet
      const [profileResult, practiceExamsResult, enrollmentsResult, recentResultsResult] = await Promise.all([
        supabaseAdmin.from('student_profiles').select('id, full_name, roll_number, photo_url, batch_id, batches(id, name)').eq('user_id', user.id).maybeSingle(),
        supabaseAdmin.from('exams').select('id, title, subject, type, duration_minutes, total_questions, marks_per_question, negative_marks, settings, status, scheduled_at, ends_at').eq('type', 'practice').eq('status', 'active').is('deleted_at', null).order('created_at', { ascending: false }),
        supabaseAdmin.from('exam_enrollments').select('exam_id, exams!inner(id, title, subject, type, duration_minutes, total_questions, marks_per_question, negative_marks, status, scheduled_at, ends_at, settings, deleted_at)').eq('student_id', user.id).eq('exams.type', 'scheduled').in('exams.status', ['scheduled', 'active', 'completed']),
        supabaseAdmin.from('exam_results').select('id, session_id, exam_id, percentage, total_score, max_score, correct_count, incorrect_count, is_passed, computed_at, exams(id, title, subject, type)').eq('student_id', user.id).order('computed_at', { ascending: false }).limit(5),
      ]);

      const practiceExams = practiceExamsResult.data || [];
      const rawScheduled = (enrollmentsResult.data || []).map((e: any) => Array.isArray(e.exams) ? e.exams[0] : e.exams).filter((e: any) => e && !e.deleted_at && e.type === 'scheduled');
      rawScheduled.sort((a: any, b: any) => (b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0) - (a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0));
      
      const allExamIds = [...practiceExams.map(e => e.id), ...rawScheduled.map((e: any) => e.id)];
      const sessions = allExamIds.length > 0 ? (await supabaseAdmin.from('exam_sessions').select('id, exam_id, status, started_at, submitted_at, expires_at').eq('student_id', user.id).in('exam_id', allExamIds).order('created_at', { ascending: false })).data || [] : [];
      const submittedSessions = sessions.filter(s => s.status === 'submitted');
      const sessionResults = submittedSessions.length > 0 ? (await supabaseAdmin.from('exam_results').select('id, session_id, exam_id, percentage, total_score, correct_count, incorrect_count, is_passed').in('session_id', submittedSessions.map(s => s.id))).data || [] : [];

      const examStatusMap: Record<string, any> = {};
      sessions.forEach(sessionItem => {
        const priority: Record<string, number> = { submitted: 3, active: 2, expired: 1, terminated: 0 };
        const existing = examStatusMap[sessionItem.exam_id];
        const currentPriority = priority[sessionItem.status] ?? 0;
        const existingPriority = existing ? (priority[existing.sessionStatus] ?? -1) : -1;
        if (currentPriority > existingPriority) {
          const examResults = sessionResults.filter(r => r.exam_id === sessionItem.exam_id);
          const maxResult = examResults.length > 0
            ? examResults.reduce((max, r) => (Number(r.percentage) > Number(max.percentage) ? r : max), examResults[0])
            : (sessionResults.find(r => r.session_id === sessionItem.id) || null);

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

      const profileData = profileResult.data;
      const batchesData: any = profileData?.batches;
      const nowIso = new Date().toISOString();

      return NextResponse.json({
        serverTime: nowIso,
        profile: {
          id: profileData?.id,
          full_name: profileData?.full_name || 'Student',
          roll_number: profileData?.roll_number || 'Unassigned',
          photo_url: profileData?.photo_url || null,
          batch_name: (Array.isArray(batchesData) ? batchesData[0]?.name : batchesData?.name) || null,
        },
        practiceExams: practiceExams.map((exam: any) => ({ ...exam, is_available: computeExamAvailability(exam, nowIso) })),
        scheduledExams: rawScheduled.map((exam: any) => ({ ...exam, is_available: computeExamAvailability(exam, nowIso) })),
        recentResults: recentResultsResult.data || [],
        examStatusMap,
      }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
    }

    // Unpack RPC payload
    const { profile, practiceExams = [], scheduledExams = [], recentResults = [], sessions = [], sessionResults = [] } = rpcData;
    const nowIso = rpcData.serverTime || new Date().toISOString();

    const examStatusMap: Record<string, any> = {};
    (sessions || []).forEach((sessionItem: any) => {
      const priority: Record<string, number> = { submitted: 3, active: 2, expired: 1, terminated: 0 };
      const existing = examStatusMap[sessionItem.exam_id];
      const currentPriority = priority[sessionItem.status] ?? 0;
      const existingPriority = existing ? (priority[existing.sessionStatus] ?? -1) : -1;
      if (currentPriority > existingPriority) {
        const examResults = (sessionResults || []).filter((r: any) => r.exam_id === sessionItem.exam_id);
        const maxResult = examResults.length > 0
          ? examResults.reduce((max: any, r: any) => (Number(r.percentage) > Number(max.percentage) ? r : max), examResults[0])
          : (sessionResults.find((r: any) => r.session_id === sessionItem.id) || null);

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

    const enrichedScheduled = (scheduledExams || []).map((exam: any) => ({
      ...exam,
      is_available: computeExamAvailability(exam, nowIso),
    }));

    const enrichedPractice = (practiceExams || []).map((exam: any) => ({
      ...exam,
      is_available: computeExamAvailability(exam, nowIso),
    }));

    return NextResponse.json(
      {
        serverTime: nowIso,
        profile: profile || { full_name: 'Student', roll_number: 'Unassigned', photo_url: null, batch_name: null },
        practiceExams: enrichedPractice,
        scheduledExams: enrichedScheduled,
        recentResults: recentResults || [],
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

