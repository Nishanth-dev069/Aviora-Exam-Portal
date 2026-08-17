export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { LearningSubject } from '@/types';


export async function GET(_request: NextRequest) {
  try {
    // Auth
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

    // Verify student role + active status
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

    // Fetch all active, learning-enabled banks
    const { data: banks, error: banksError } = await supabaseAdmin
      .from('question_banks')
      .select('id, subject, chapter')
      .eq('status', 'active')
      .not('chapter', 'is', null)
      .is('deleted_at', null);

    if (banksError) throw banksError;
    if (!banks || banks.length === 0) {
      return NextResponse.json([] as LearningSubject[]);
    }

    // Fetch question counts for all these banks in one query
    const bankIds = banks.map((b) => b.id);
    const [{ data: questionRows, error: qError }, { data: progressRows }] = await Promise.all([
      supabaseAdmin
        .from('questions')
        .select('bank_id')
        .in('bank_id', bankIds)
        .is('deleted_at', null),
      supabaseAdmin
        .from('student_chapter_progress')
        .select('bank_id')
        .eq('student_id', session.user.id)
        .in('bank_id', bankIds)
    ]);

    if (qError) throw qError;

    // Completed banks set
    const completedBankIds = new Set((progressRows || []).map((p) => p.bank_id));

    // Build count map: bank_id → question count
    const countMap: Record<string, number> = {};
    for (const q of questionRows ?? []) {
      countMap[q.bank_id] = (countMap[q.bank_id] ?? 0) + 1;
    }

    // Aggregate by subject — only include subjects with at least 1 question
    const subjectMap: Record<string, { chapter_count: number; completed_chapters_count: number; total_questions: number }> = {};
    for (const bank of banks) {
      const qCount = countMap[bank.id] ?? 0;
      if (qCount === 0) continue; // Skip banks with zero questions
      if (!subjectMap[bank.subject]) {
        subjectMap[bank.subject] = { chapter_count: 0, completed_chapters_count: 0, total_questions: 0 };
      }
      subjectMap[bank.subject].chapter_count += 1;
      if (completedBankIds.has(bank.id)) {
        subjectMap[bank.subject].completed_chapters_count += 1;
      }
      subjectMap[bank.subject].total_questions += qCount;
    }

    const result: LearningSubject[] = Object.entries(subjectMap)
      .map(([subject, data]) => ({ subject, ...data }))
      .sort((a, b) => a.subject.localeCompare(b.subject));

    return NextResponse.json(result);

  } catch (err) {
    console.error('[GET /api/student/learn/subjects]', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred.', details: null } },
      { status: 500 }
    );
  }
}
