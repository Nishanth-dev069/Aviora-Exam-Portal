import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
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

    const { data: adminUser } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!adminUser || !['admin', 'super_admin'].includes(adminUser.role)) {
      return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
    }

    // Fetch session metadata
    const { data: session } = await supabaseAdmin
      .from('exam_sessions')
      .select('id, student_id, exam_id, security_violations, status, started_at, last_synced_at')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Session not found' } }, { status: 404 });
    }

    // Fetch student profile
    const { data: profile } = await supabaseAdmin
      .from('student_profiles')
      .select('full_name, roll_number')
      .eq('user_id', session.student_id)
      .maybeSingle();

    // Fetch all security events for this session
    const { data: events, error: eventsErr } = await supabaseAdmin
      .from('security_events')
      .select('*')
      .eq('session_id', sessionId)
      .order('occurred_at', { ascending: false });

    if (eventsErr) throw eventsErr;

    return NextResponse.json({
      success: true,
      session: {
        ...session,
        full_name: profile?.full_name || 'Student',
        roll_number: profile?.roll_number || '—'
      },
      events: events || []
    });
  } catch (err: unknown) {
    console.error('[Admin Security Events GET Error]', err);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Internal error' } }, { status: 500 });
  }
}
