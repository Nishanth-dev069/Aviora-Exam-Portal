export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { LearningChapter } from '@/types';


export async function GET(
  _request: NextRequest,
  { params }: { params: { subject: string } }
) {
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

    const subject = decodeURIComponent(params.subject);

    const { data: banks, error: banksError } = await supabaseAdmin
      .from('question_banks')
      .select('id, name, chapter, chapter_order')
      .eq('subject', subject)
      .eq('status', 'active')
      .not('chapter', 'is', null)
      .is('deleted_at', null)
      .order('chapter_order', { ascending: true });

    if (banksError) throw banksError;
    if (!banks || banks.length === 0) {
      return NextResponse.json([] as LearningChapter[]);
    }

    const bankIds = banks.map((b) => b.id);
    const [{ data: questionRows, error: qError }, { data: progressRows }] = await Promise.all([
      supabaseAdmin
        .from('questions')
        .select('bank_id')
        .in('bank_id', bankIds)
        .is('deleted_at', null),
      supabaseAdmin
        .from('student_chapter_progress')
        .select('bank_id, completed_at')
        .eq('student_id', session.user.id)
        .in('bank_id', bankIds)
    ]);

    if (qError) throw qError;

    const progressMap: Record<string, { completed_at: string }> = {};
    for (const p of progressRows ?? []) {
      progressMap[p.bank_id] = { completed_at: p.completed_at };
    }

    const countMap: Record<string, number> = {};
    for (const q of questionRows ?? []) {
      countMap[q.bank_id] = (countMap[q.bank_id] ?? 0) + 1;
    }

    const result: LearningChapter[] = banks
      .filter((b) => (countMap[b.id] ?? 0) > 0)
      .map((b) => {
        const prog = progressMap[b.id];
        return {
          id: b.id,
          name: b.name,
          chapter: b.chapter as string,
          chapter_order: b.chapter_order,
          question_count: countMap[b.id] ?? 0,
          is_completed: !!prog,
          completed_at: prog ? prog.completed_at : null,
        };
      });

    return NextResponse.json(result);

  } catch (err) {
    console.error('[GET /api/student/learn/[subject]]', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred.', details: null } },
      { status: 500 }
    );
  }
}
