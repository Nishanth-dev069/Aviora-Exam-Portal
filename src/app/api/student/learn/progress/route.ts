export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';


export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
    );
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated.', details: null } },
        { status: 401 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('role, status, deleted_at')
      .eq('id', session.user.id)
      .single();

    if (!user || user.role !== 'student' || user.status !== 'active' || user.deleted_at) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access denied.', details: null } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { bankId, questionsCompleted, totalQuestions } = body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!bankId || !uuidRegex.test(bankId)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid question bank ID.', details: null } },
        { status: 400 }
      );
    }

    // Verify bank exists, is active, and is learning-published
    const { data: bank } = await supabaseAdmin
      .from('question_banks')
      .select('id')
      .eq('id', bankId)
      .eq('status', 'active')
      .not('chapter', 'is', null)
      .is('deleted_at', null)
      .single();

    if (!bank) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Question bank not found.', details: null } },
        { status: 404 }
      );
    }

    // Upsert into student_chapter_progress
    const { error: upsertError } = await supabaseAdmin
      .from('student_chapter_progress')
      .upsert(
        {
          student_id: session.user.id,
          bank_id: bankId,
          completed_at: new Date().toISOString(),
          questions_completed: Number(questionsCompleted) || Number(totalQuestions) || 0,
          total_questions: Number(totalQuestions) || 0,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'student_id,bank_id' }
      );

    if (upsertError) {
      console.error('[POST /api/student/learn/progress] Upsert error:', upsertError);
      throw upsertError;
    }

    return NextResponse.json({ success: true, completed: true });
  } catch (err) {
    console.error('[POST /api/student/learn/progress]', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred.', details: null } },
      { status: 500 }
    );
  }
}
