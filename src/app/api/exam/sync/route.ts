import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

const syncSchema = z.object({
  session_id: z.string().uuid(),
  sync_id: z.string().uuid(),
  security_violations: z.number().optional(),
  answers: z.array(z.object({
    question_id: z.string().uuid(),
    selected_option_id: z.string().uuid().nullable(),
    is_marked_for_review: z.boolean(),
    is_visited: z.boolean(),
    time_spent_seconds: z.number(),
    updated_at: z.string()
  })),
  security_events: z.array(z.object({
    event_type: z.string(),
    occurred_at: z.string(),
    duration_seconds: z.number().nullable(),
    event_data: z.record(z.string(), z.unknown())
  })).optional()
});

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    
    // 1. Authenticate using anon client
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
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = syncSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Invalid sync payload' } }, { status: 400 });
    }
    const { session_id, answers, security_events, security_violations } = parseResult.data;

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

    // 2 & 3. Validate Session
    const { data: session } = await supabaseAdmin
      .from('exam_sessions')
      .select('student_id, status, expires_at, question_order, security_violations')
      .eq('id', session_id)
      .single();

    if (!session || session.student_id !== user.id) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Session not found or forbidden' } }, { status: 403 });
    }

    if (session.status !== 'active') {
      return NextResponse.json({ error: { code: 'SESSION_TERMINATED', message: 'Exam session is no longer active.' } }, { status: 401 });
    }

    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ error: { code: 'SESSION_TERMINATED', message: 'Exam time has expired.' } }, { status: 401 });
    }

    // 5. Filter valid answers
    const validQuestionIds = new Set(session.question_order as string[]);
    const validAnswers = answers.filter(a => validQuestionIds.has(a.question_id));

    if (validAnswers.length > 0) {
      const upsertPayload = validAnswers.map(a => ({
        session_id,
        question_id: a.question_id,
        selected_option_id: a.selected_option_id,
        is_marked_for_review: a.is_marked_for_review,
        is_visited: a.is_visited,
        time_spent_seconds: a.time_spent_seconds,
        updated_at: a.updated_at
      }));

      const { error: upsertError } = await supabaseAdmin
        .from('student_answers')
        .upsert(upsertPayload, { onConflict: 'session_id,question_id' });

      if (upsertError) {
        return NextResponse.json({ error: { code: 'SYNC_FAILED', message: 'Failed to write answers', details: upsertError } }, { status: 500 });
      }
    }

    // 6. Insert security events if present
    if (security_events && security_events.length > 0) {
      const eventsPayload = security_events.map(e => ({
        session_id,
        event_type: e.event_type,
        occurred_at: e.occurred_at,
        duration_seconds: e.duration_seconds,
        event_data: e.event_data
      }));

      await supabaseAdmin.from('security_events').insert(eventsPayload);
    }

    // Update security_violations count on session directly
    const prevCount = session.security_violations || 0;
    const payloadCount = typeof security_violations === 'number' ? security_violations : 0;
    const eventsCount = security_events?.length || 0;
    const newViolations = Math.max(prevCount + eventsCount, payloadCount);

    // 7. Update last_synced_at and security_violations
    await supabaseAdmin
      .from('exam_sessions')
      .update({ 
        last_synced_at: new Date().toISOString(),
        security_violations: newViolations
      })
      .eq('id', session_id);

    // 8. Return accepted confirmation
    return NextResponse.json({
      accepted: validAnswers.map(a => a.question_id),
      security_violations: newViolations,
      server_time: new Date().toISOString()
    });

  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred during sync.' } },
      { status: 500 }
    );
  }
}
