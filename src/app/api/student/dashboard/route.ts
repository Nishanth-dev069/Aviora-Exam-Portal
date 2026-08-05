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

export async function GET(request: Request) {
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

    // 1. Route JWT Verification
    const tAuthStart = performance.now();
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const tAuthEnd = performance.now();
    const authMs = tAuthEnd - tAuthStart;

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

    // 2. RPC Consolidated Call vs Fallback
    const tRpcStart = performance.now();
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('student_get_dashboard');
    const tRpcEnd = performance.now();
    const rpcMs = tRpcEnd - tRpcStart;

    let profileDataObj: any = null;
    let practiceExamsList: any[] = [];
    let scheduledExamsList: any[] = [];
    let recentResultsList: any[] = [];
    let examStatusMapObj: Record<string, any> = {};
    let nowIsoStr = new Date().toISOString();

    let tDashboardQuery = rpcMs;
    let tRecentExamsQuery = rpcMs;
    let tResultsQuery = rpcMs;
    let tStatisticsQuery = rpcMs;

    if (rpcError || !rpcData) {
      // Fallback: Individual Queries
      const tFallbackStart = performance.now();
      const [profileResult, practiceExamsResult, enrollmentsResult, recentResultsResult] = await Promise.all([
        supabaseAdmin.from('student_profiles').select('id, full_name, roll_number, photo_url, batch_id, batches(id, name)').eq('user_id', user.id).maybeSingle(),
        supabaseAdmin.from('exams').select('id, title, subject, type, duration_minutes, total_questions, marks_per_question, negative_marks, settings, status, scheduled_at, ends_at').eq('type', 'practice').eq('status', 'active').is('deleted_at', null).order('created_at', { ascending: false }),
        supabaseAdmin.from('exam_enrollments').select('exam_id, exams!inner(id, title, subject, type, duration_minutes, total_questions, marks_per_question, negative_marks, status, scheduled_at, ends_at, settings, deleted_at)').eq('student_id', user.id).eq('exams.type', 'scheduled').in('exams.status', ['scheduled', 'active', 'completed']),
        supabaseAdmin.from('exam_results').select('id, session_id, exam_id, percentage, total_score, max_score, correct_count, incorrect_count, is_passed, computed_at, exams(id, title, subject, type)').eq('student_id', user.id).order('computed_at', { ascending: false }).limit(5),
      ]);
      const tFallbackEnd = performance.now();
      const fallbackMs = tFallbackEnd - tFallbackStart;

      tDashboardQuery = fallbackMs;
      tRecentExamsQuery = fallbackMs;
      tResultsQuery = fallbackMs;
      tStatisticsQuery = fallbackMs;

      profileDataObj = profileResult.data;
      if (!profileDataObj) {
        return NextResponse.json(
          { error: { code: 'PROFILE_RESOLUTION_FAILED', message: 'Failed to resolve student profile identity.' } },
          { status: 500, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      practiceExamsList = practiceExamsResult.data || [];
      const rawScheduled = (enrollmentsResult.data || []).map((e: any) => Array.isArray(e.exams) ? e.exams[0] : e.exams).filter((e: any) => e && !e.deleted_at && e.type === 'scheduled');
      rawScheduled.sort((a: any, b: any) => (b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0) - (a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0));
      scheduledExamsList = rawScheduled;
      recentResultsList = recentResultsResult.data || [];

      const allExamIds = [...practiceExamsList.map(e => e.id), ...scheduledExamsList.map((e: any) => e.id)];
      const sessions = allExamIds.length > 0 ? (await supabaseAdmin.from('exam_sessions').select('id, exam_id, status, started_at, submitted_at, expires_at').eq('student_id', user.id).in('exam_id', allExamIds).order('created_at', { ascending: false })).data || [] : [];
      const submittedSessions = sessions.filter(s => s.status === 'submitted');
      const sessionResults = submittedSessions.length > 0 ? (await supabaseAdmin.from('exam_results').select('id, session_id, exam_id, percentage, total_score, correct_count, incorrect_count, is_passed').in('session_id', submittedSessions.map(s => s.id))).data || [] : [];

      sessions.forEach(sessionItem => {
        const priority: Record<string, number> = { submitted: 3, active: 2, expired: 1, terminated: 0 };
        const existing = examStatusMapObj[sessionItem.exam_id];
        const currentPriority = priority[sessionItem.status] ?? 0;
        const existingPriority = existing ? (priority[existing.sessionStatus] ?? -1) : -1;
        if (currentPriority > existingPriority) {
          const examResults = sessionResults.filter(r => r.exam_id === sessionItem.exam_id);
          const maxResult = examResults.length > 0
            ? examResults.reduce((max, r) => (Number(r.percentage) > Number(max.percentage) ? r : max), examResults[0])
            : (sessionResults.find(r => r.session_id === sessionItem.id) || null);

          examStatusMapObj[sessionItem.exam_id] = {
            sessionId: sessionItem.id,
            sessionStatus: sessionItem.status,
            startedAt: sessionItem.started_at,
            submittedAt: sessionItem.submitted_at,
            expiresAt: sessionItem.expires_at,
            result: maxResult,
          };
        }
      });
    } else {
      // RPC path
      const { profile, practiceExams = [], scheduledExams = [], recentResults = [], sessions = [], sessionResults = [] } = rpcData;
      if (!profile || !profile.full_name) {
        return NextResponse.json(
          { error: { code: 'PROFILE_RESOLUTION_FAILED', message: 'RPC payload missing student profile identity.' } },
          { status: 500, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      nowIsoStr = rpcData.serverTime || new Date().toISOString();
      profileDataObj = profile;
      practiceExamsList = practiceExams;
      scheduledExamsList = scheduledExams;
      recentResultsList = recentResults;

      (sessions || []).forEach((sessionItem: any) => {
        const priority: Record<string, number> = { submitted: 3, active: 2, expired: 1, terminated: 0 };
        const existing = examStatusMapObj[sessionItem.exam_id];
        const currentPriority = priority[sessionItem.status] ?? 0;
        const existingPriority = existing ? (priority[existing.sessionStatus] ?? -1) : -1;
        if (currentPriority > existingPriority) {
          const examResults = (sessionResults || []).filter((r: any) => r.exam_id === sessionItem.exam_id);
          const maxResult = examResults.length > 0
            ? examResults.reduce((max: any, r: any) => (Number(r.percentage) > Number(max.percentage) ? r : max), examResults[0])
            : (sessionResults.find((r: any) => r.session_id === sessionItem.id) || null);

          examStatusMapObj[sessionItem.exam_id] = {
            sessionId: sessionItem.id,
            sessionStatus: sessionItem.status,
            startedAt: sessionItem.started_at,
            submittedAt: sessionItem.submitted_at,
            expiresAt: sessionItem.expires_at,
            result: maxResult,
          };
        }
      });
    }

    const enrichedScheduled = (scheduledExamsList || []).map((exam: any) => ({
      ...exam,
      is_available: computeExamAvailability(exam, nowIsoStr),
    }));

    const enrichedPractice = (practiceExamsList || []).map((exam: any) => ({
      ...exam,
      is_available: computeExamAvailability(exam, nowIsoStr),
    }));

    // 3. Response Serialization
    const tSerStart = performance.now();
    const mwHeaderTiming = request.headers.get('x-mw-timing') || '';
    
    // Parse middleware timing values if available
    let mwJwt = 0;
    let mwUser = 0;
    let mwSession = 0;
    if (mwHeaderTiming) {
      const matchAuth = mwHeaderTiming.match(/mw_auth;dur=([\d.]+)/);
      const matchUsers = mwHeaderTiming.match(/mw_users;dur=([\d.]+)/);
      const matchSessions = mwHeaderTiming.match(/mw_sessions;dur=([\d.]+)/);
      if (matchAuth) mwJwt = parseFloat(matchAuth[1]);
      if (matchUsers) mwUser = parseFloat(matchUsers[1]);
      if (matchSessions) mwSession = parseFloat(matchSessions[1]);
    }

    const totalJwt = mwJwt + authMs;
    const routeTotalMs = performance.now() - tRouteStart;

    const payload = {
      serverTime: nowIsoStr,
      profile: profileDataObj,
      practiceExams: enrichedPractice,
      scheduledExams: enrichedScheduled,
      recentResults: recentResultsList || [],
      examStatusMap: examStatusMapObj,
      timing: {
        jwt_verification: parseFloat(totalJwt.toFixed(2)),
        session_verification: parseFloat(mwSession.toFixed(2)),
        user_lookup: parseFloat(mwUser.toFixed(2)),
        dashboard_query: parseFloat(tDashboardQuery.toFixed(2)),
        recent_exams_query: parseFloat(tRecentExamsQuery.toFixed(2)),
        results_query: parseFloat(tResultsQuery.toFixed(2)),
        statistics_query: parseFloat(tStatisticsQuery.toFixed(2)),
        response_serialization: 0, // set below
        total: parseFloat(routeTotalMs.toFixed(2)),
      }
    };

    const responseJsonStr = JSON.stringify(payload);
    const tSerEnd = performance.now();
    const serMs = tSerEnd - tSerStart;
    payload.timing.response_serialization = parseFloat(serMs.toFixed(2));

    const finalJsonStr = JSON.stringify(payload);

    return new NextResponse(finalJsonStr, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Timing-Jwt-Verification': totalJwt.toFixed(2),
        'X-Timing-Session-Verification': mwSession.toFixed(2),
        'X-Timing-User-Lookup': mwUser.toFixed(2),
        'X-Timing-Dashboard-Query': tDashboardQuery.toFixed(2),
        'X-Timing-Recent-Exams': tRecentExamsQuery.toFixed(2),
        'X-Timing-Results-Query': tResultsQuery.toFixed(2),
        'X-Timing-Statistics-Query': tStatisticsQuery.toFixed(2),
        'X-Timing-Response-Serialization': serMs.toFixed(2),
        'X-Timing-Route-Total': routeTotalMs.toFixed(2),
      }
    });

  } catch (err: any) {
    console.error('[GET /api/student/dashboard] Exception:', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to load dashboard data.' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
