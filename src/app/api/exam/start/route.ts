/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

const schema = z.object({ exam_id: z.string().uuid() });

function fisherYatesShuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function computeExpiresAt(
  startedAt: Date,
  durationMinutes: number,
  examType: string,
  examEndsAt: string | null
): Date {
  const durationExpiry = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);

  if (examType === 'scheduled' && examEndsAt) {
    const windowEnd = new Date(examEndsAt);
    // Take whichever comes first: duration expiry OR exam window close
    return durationExpiry < windowEnd ? durationExpiry : windowEnd;
  }

  // Practice exams: always full duration
  return durationExpiry;
}

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();

    // 1. Authenticate request using getSession()
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

    const { data: { session }, error: authError } = await supabaseAnon.auth.getSession();
    const user = session?.user ?? null;
    if (authError || !user) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // 2. Validate input
    const body = await request.json();
    const parseResult = schema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Invalid exam_id' } }, { status: 400 });
    }
    const { exam_id } = parseResult.data;

    // Use Service Role Client for all further checks and the RPC call
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

    const student_id = user.id;
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    // Parallelize all 6 independent pre-checks and data queries
    const [
      examRes,
      sessionCountRes,
      enrollmentRes,
      existingSessionsRes,
      studentUserRes,
      examQuestionsRes
    ] = await Promise.all([
      // 1. Fetch exam
      supabaseAdmin
        .from('exams')
        .select('*')
        .eq('id', exam_id)
        .eq('status', 'active')
        .is('deleted_at', null)
        .single(),

      // 2. Rate Limit check count
      supabaseAdmin
        .from('exam_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', student_id)
        .gte('created_at', tenMinutesAgo),

      // 3. Check enrollment
      supabaseAdmin
        .from('exam_enrollments')
        .select('id')
        .eq('exam_id', exam_id)
        .eq('student_id', student_id)
        .single(),

      // 4. Existing sessions check
      supabaseAdmin
        .from('exam_sessions')
        .select('*')
        .eq('exam_id', exam_id)
        .eq('student_id', student_id)
        .in('status', ['active', 'submitted']),

      // 5. Student status check
      supabaseAdmin
        .from('users')
        .select('status, role')
        .eq('id', student_id)
        .single(),

      // 6. Exam questions fetch
      supabaseAdmin
        .from('exam_questions')
        .select(`
          question_id,
          questions (
            id, content,
            question_options (id, content)
          )
        `)
        .eq('exam_id', exam_id)
    ]);

    const exam = examRes.data;
    if (!exam) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Exam not found or inactive' } }, { status: 404 });
    }

    if (exam.type === 'scheduled') {
      const sessionCount = sessionCountRes.count;
      if (sessionCount !== null && sessionCount >= 10) {
        return NextResponse.json({ error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many session creation attempts.' } }, { status: 429 });
      }
    }

    const enrollment = enrollmentRes.data;
    if (!enrollment) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Not enrolled in this exam' } }, { status: 403 });
    }

    if (exam.type === 'scheduled' && exam.ends_at) {
      const serverNow = new Date();
      const windowEnd = new Date(exam.ends_at);
      if (serverNow >= windowEnd) {
        return NextResponse.json(
          { error: { code: 'EXAM_WINDOW_CLOSED', message: 'The examination window has closed.' } },
          { status: 400 }
        );
      }
      if (exam.scheduled_at) {
        const windowStart = new Date(exam.scheduled_at);
        if (serverNow < windowStart) {
          return NextResponse.json(
            { error: { code: 'EXAM_NOT_STARTED_YET', message: 'The examination has not started yet.' } },
            { status: 400 }
          );
        }
      }
    }

    const existingSessions = existingSessionsRes.data;
    const activeSession = existingSessions?.find((s: any) => s.status === 'active');
    const submittedSessions = (existingSessions || []).filter((s: any) => s.status === 'submitted');

    if (activeSession) {
      // Compute capped expires_at for recovered active session
      const startedAtDate = new Date(activeSession.started_at);
      const computedExpiresAt = computeExpiresAt(
        startedAtDate,
        exam.duration_minutes,
        exam.type,
        exam.ends_at ?? null
      );
      const computedExpiresIso = computedExpiresAt.toISOString();

      if (activeSession.expires_at !== computedExpiresIso) {
        await supabaseAdmin
          .from('exam_sessions')
          .update({ expires_at: computedExpiresIso })
          .eq('id', activeSession.id);
        activeSession.expires_at = computedExpiresIso;
      }
      
      const questionsData = examQuestionsRes.data;
      const questionsMap = new Map();
      (questionsData || []).forEach((row: any) => {
        const qObj = Array.isArray(row.questions) ? row.questions[0] : row.questions;
        if (qObj) {
          questionsMap.set(qObj.id, qObj);
        }
      });

      const recoveredQuestions = ((activeSession.question_order as string[]) || []).map((qid: string) => {
        const q = questionsMap.get(qid);
        const optionOrderForQ = ((activeSession.option_orders as Record<string, string[]>)[qid]) || [];
        const optsMap = new Map();
        (q?.question_options || []).forEach((opt: any) => optsMap.set(opt.id, opt));
        
        return {
          id: q?.id || qid,
          content: q?.content || '',
          options: optionOrderForQ.map((optId: string) => {
             const o = optsMap.get(optId);
             return { id: o?.id || optId, content: o?.content || '' };
          })
        };
      });

      return NextResponse.json({
        session: {
          id: activeSession.id,
          exam_id: activeSession.exam_id,
          started_at: activeSession.started_at,
          expires_at: activeSession.expires_at,
          submission_token: activeSession.submission_token,
          status: activeSession.status
        },
        exam: {
          title: exam.title,
          duration_minutes: exam.duration_minutes,
          settings: exam.settings
        },
        questions: recoveredQuestions,
        server_time: new Date().toISOString()
      });
    } else if (submittedSessions.length > 0) {
      if (exam.type === 'scheduled') {
        return NextResponse.json(
          { error: { code: 'ALREADY_SUBMITTED', message: 'You have already submitted this examination.' } },
          { status: 400 }
        );
      }
      // Practice exams: retake is allowed — fall through to create a new session
    }

    const studentUser = studentUserRes.data;
    if (!studentUser || studentUser.status !== 'active') {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Student account is not active' } }, { status: 403 });
    }

    const examQuestions = examQuestionsRes.data;
    if (!examQuestions || examQuestions.length === 0) {
      return NextResponse.json({ error: { code: 'NO_QUESTIONS', message: 'This exam has no questions configured.' } }, { status: 400 });
    }

    const questionIds = examQuestions.map((row) => row.question_id);
    const shuffledQuestionIds = fisherYatesShuffle(questionIds);

    const optionOrders: Record<string, string[]> = {};
    const finalQuestions = [];

    const qDataMap = new Map();
    examQuestions.forEach(row => {
      const qObj = Array.isArray(row.questions) ? row.questions[0] : row.questions;
      if (qObj) {
        qDataMap.set(qObj.id, qObj);
      }
    });

    for (const qid of shuffledQuestionIds) {
      const q = qDataMap.get(qid);
      if (!q) continue;

      const allOptionIds: string[] = (q.question_options || []).map((o: any) => String(o.id));
      const shuffledOptions: string[] = fisherYatesShuffle(allOptionIds);
      optionOrders[qid] = shuffledOptions;

      const optsMap = new Map();
      (q.question_options || []).forEach((o: any) => optsMap.set(o.id, o));

      finalQuestions.push({
        id: q.id,
        content: q.content,
        options: shuffledOptions.map(optId => {
          const opt = optsMap.get(optId);
          return { id: opt.id, content: opt.content };
        })
      });
    }

    const ip_address = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const attemptNumber = submittedSessions.length + 1;
    const device_info = { ua: userAgent, attempt_number: attemptNumber };

    // 6. CREATE SESSION (via RPC)
    const { data: newSession, error: rpcError } = await supabaseAdmin.rpc('create_exam_session', {
      p_exam_id: exam_id,
      p_student_id: student_id,
      p_duration_minutes: exam.duration_minutes,
      p_question_order: shuffledQuestionIds,
      p_option_orders: optionOrders,
      p_device_info: device_info,
      p_ip_address: ip_address,
      p_student_role: studentUser.role
    });

    if (rpcError || !newSession) {
      return NextResponse.json({ error: { code: 'TRANSACTION_FAILED', message: 'Failed to create exam session.', details: rpcError } }, { status: 500 });
    }

    // 7. Calculate correct expires_at (capping at window end for scheduled exams)
    const startedAtDate = new Date(newSession.started_at);
    const computedExpiresAt = computeExpiresAt(
      startedAtDate,
      exam.duration_minutes,
      exam.type,
      exam.ends_at ?? null
    );
    const computedExpiresIso = computedExpiresAt.toISOString();

    if (newSession.expires_at !== computedExpiresIso) {
      await supabaseAdmin
        .from('exam_sessions')
        .update({ expires_at: computedExpiresIso })
        .eq('id', newSession.id);
      newSession.expires_at = computedExpiresIso;
    }

    // 8. RETURN
    return NextResponse.json({
      session: {
        id: newSession.id,
        exam_id: newSession.exam_id,
        started_at: newSession.started_at,
        expires_at: newSession.expires_at,
        submission_token: newSession.submission_token,
        status: newSession.status
      },
      exam: {
        title: exam.title,
        duration_minutes: exam.duration_minutes,
        settings: exam.settings
      },
      questions: finalQuestions,
      server_time: new Date().toISOString()
    });

  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } },
      { status: 500 }
    );
  }
}
