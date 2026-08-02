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
    
    // Optimization 1: Use getSession() instead of getUser()
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

    const body = await request.json();
    const parseResult = syncSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Invalid sync payload' } }, { status: 400 });
    }
    const { session_id, sync_id, answers, security_events, security_violations } = parseResult.data;

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

    // Execute consolidated RPC for session validation + answers upsert + security event recording
    const { data: rpcResult, error: rpcError } = await supabaseAnon.rpc('sync_exam_answers', {
      p_session_id: session_id,
      p_sync_id: sync_id,
      p_answers: answers,
      p_security_events: security_events || [],
      p_security_violations: security_violations || 0
    });

    if (rpcError) {
      if (rpcError.message.includes('UNAUTHORIZED')) {
        return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
      }
      if (rpcError.message.includes('SESSION_FORBIDDEN')) {
        return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Session not found or forbidden' } }, { status: 403 });
      }
      if (rpcError.message.includes('SESSION_TERMINATED')) {
        return NextResponse.json({ error: { code: 'SESSION_TERMINATED', message: 'Exam session is no longer active.' } }, { status: 401 });
      }
      return NextResponse.json({ error: { code: 'SYNC_FAILED', message: 'Failed to write answers', details: rpcError } }, { status: 500 });
    }

    return NextResponse.json(rpcResult);

  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred during sync.' } },
      { status: 500 }
    );
  }
}

