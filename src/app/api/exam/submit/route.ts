import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

const submitSchema = z.object({
  session_id: z.string().uuid(),
  submission_token: z.string().uuid(),
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
    const parseResult = submitSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Invalid payload' } }, { status: 400 });
    }
    const { session_id, submission_token } = parseResult.data;

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

    const ip_address = request.headers.get('x-forwarded-for') || '127.0.0.1';

    // Optimization 2: Single RPC call to evaluate and submit session
    const { data: resultData, error: rpcError } = await supabaseAdmin.rpc('submit_exam_session', {
      p_session_id: session_id,
      p_student_id: user.id,
      p_submission_token: submission_token,
      p_ip_address: ip_address,
      p_student_role: 'student'
    });

    if (rpcError) {
      if (rpcError.message.includes('Session not found') || rpcError.message.includes('NOT_FOUND')) {
        return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Session not found or forbidden' } }, { status: 404 });
      }
      if (rpcError.message.includes('Invalid submission token') || rpcError.message.includes('INVALID_TOKEN')) {
        return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Invalid submission token' } }, { status: 403 });
      }
      return NextResponse.json({ error: { code: 'SUBMISSION_FAILED', message: 'Failed to submit exam', details: rpcError } }, { status: 500 });
    }

    return NextResponse.json(resultData);

  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred during submission.' } },
      { status: 500 }
    );
  }
}

