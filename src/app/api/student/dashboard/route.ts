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
  const ENABLE_PROFILING = process.env.ENABLE_PROFILING === 'true';
  const tRouteStart = ENABLE_PROFILING ? performance.now() : 0;
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
    const tAuthStart = ENABLE_PROFILING ? performance.now() : 0;
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const tAuthEnd = ENABLE_PROFILING ? performance.now() : 0;
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
    const tRpcStart = ENABLE_PROFILING ? performance.now() : 0;
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('student_get_dashboard');
    const tRpcEnd = ENABLE_PROFILING ? performance.now() : 0;
    const rpcMs = ENABLE_PROFILING ? tRpcEnd - tRpcStart : 0;
    const authMs = ENABLE_PROFILING ? tAuthEnd - tAuthStart : 0;

    if (ENABLE_PROFILING) {
      const totalMs = performance.now() - tRouteStart;
      console.log(`[Dashboard API Telemetry] total=${totalMs.toFixed(1)}ms auth=${authMs.toFixed(1)}ms rpc=${rpcMs.toFixed(1)}ms fallback=${!!rpcError}`);
    }

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
      const requestId = request.headers.get('x-request-id') || 'unknown';
      const isRsc = request.headers.get('rsc') === '1' || (request.headers.get('accept') || '').includes('text/x-component');

      if (!profileData) {
        console.error(`[CRITICAL_IDENTITY_TRACE]\nRequest ID: ${requestId}\nLayer: dashboard\nOrigin: route_handler\nPath: /api/student/dashboard\nMethod: GET\nIs RSC: ${isRsc}\nSource: fallback student_profiles query\nUser ID: ${user.id}\nEmail: ${user.email || 'N/A'}\nError: PROFILE_RESOLUTION_FAILED\nTimestamp: ${new Date().toISOString()}`);
        return NextResponse.json(
          { error: { code: 'PROFILE_RESOLUTION_FAILED', message: 'Failed to resolve student profile identity.' } },
          { status: 500, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      const batchesData: any = profileData?.batches;
      const nowIso = new Date().toISOString();

      console.log(`[IDENTITY_TRACE]\nRequest ID: ${requestId}\nLayer: dashboard\nOrigin: route_handler\nPath: /api/student/dashboard\nMethod: GET\nIs RSC: ${isRsc}\nSource: fallback student_profiles query\nUser ID: ${user.id}\nEmail: ${user.email || 'N/A'}\nRole: student\nFull Name: ${profileData.full_name}\nTimestamp: ${new Date().toISOString()}`);

      return NextResponse.json({
        serverTime: nowIso,
        profile: {
          id: profileData.id,
          full_name: profileData.full_name,
          roll_number: profileData.roll_number || 'Unassigned',
          photo_url: profileData.photo_url || null,
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
    const requestId = request.headers.get('x-request-id') || 'unknown';
    const isRsc = request.headers.get('rsc') === '1' || (request.headers.get('accept') || '').includes('text/x-component');

    if (!profile || !profile.full_name) {
      console.error(`[CRITICAL_IDENTITY_TRACE]\nRequest ID: ${requestId}\nLayer: dashboard\nOrigin: route_handler\nPath: /api/student/dashboard\nMethod: GET\nIs RSC: ${isRsc}\nSource: student_get_dashboard RPC\nUser ID: ${user.id}\nEmail: ${user.email || 'N/A'}\nError: PROFILE_RESOLUTION_FAILED\nTimestamp: ${new Date().toISOString()}`);
      return NextResponse.json(
        { error: { code: 'PROFILE_RESOLUTION_FAILED', message: 'RPC payload missing student profile identity.' } },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

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

    const tSerStart = performance.now();
    const payload = {
      serverTime: nowIso,
      profile,
      practiceExams: enrichedPractice,
      scheduledExams: enrichedScheduled,
      recentResults: recentResults || [],
      examStatusMap,
    };
    const responseJson = JSON.stringify(payload);
    const tSerEnd = performance.now();
    const serMs = tSerEnd - tSerStart;
    const routeTotalMs = performance.now() - tRouteStart;

    const ENABLE_PROFILING = process.env.ENABLE_PROFILING === 'true';

    if (ENABLE_PROFILING) {
      console.log(`[IDENTITY_TRACE]\nRequest ID: ${requestId}\nLayer: dashboard\nOrigin: route_handler\nPath: /api/student/dashboard\nMethod: GET\nIs RSC: ${isRsc}\nSource: student_get_dashboard RPC\nUser ID: ${user.id}\nEmail: ${user.email || 'N/A'}\nRole: student\nFull Name: ${profile.full_name}\nTimestamp: ${new Date().toISOString()}`);
    }

    if (!ENABLE_PROFILING) {
      return NextResponse.json(payload, {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
      });
    }

    const reqHeaders = request.headers;
    const mwTiming = reqHeaders.get('x-mw-timing') || '';
    const routeTimingStr = `route_auth;dur=${authMs.toFixed(1)}, route_rpc;dur=${rpcMs.toFixed(1)}, route_ser;dur=${serMs.toFixed(1)}, route_total;dur=${routeTotalMs.toFixed(1)}`;
    const fullServerTiming = mwTiming ? `${mwTiming}, ${routeTimingStr}, req_id;desc="${requestId}"` : `${routeTimingStr}, req_id;desc="${requestId}"`;

    return new NextResponse(responseJson, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Request-ID': requestId,
        'Server-Timing': fullServerTiming
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

