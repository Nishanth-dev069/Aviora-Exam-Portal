export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getSignedUrl } from '@/lib/storage/signed-urls';
import type { LearningQuestion, LearningBankDetail } from '@/types';


export async function GET(
  _request: NextRequest,
  { params }: { params: { subject: string; bankId: string } }
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
    const { bankId } = params;

    // Validate UUID format to prevent injection
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(bankId)) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Question bank not found.', details: null } },
        { status: 404 }
      );
    }

    // Verify bank: must be active, match subject, have chapter set (learning-enabled)
    const { data: bank, error: bankError } = await supabaseAdmin
      .from('question_banks')
      .select('id, chapter, subject')
      .eq('id', bankId)
      .eq('subject', subject)
      .eq('status', 'active')
      .not('chapter', 'is', null)
      .is('deleted_at', null)
      .single();

    if (bankError || !bank) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Question bank not found.', details: null } },
        { status: 404 }
      );
    }

    // Fetch questions — stable order, no randomization
    const { data: questions, error: qError } = await supabaseAdmin
      .from('questions')
      .select('id, content, explanation, content_image_url, explanation_image_url')
      .eq('bank_id', bankId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (qError) throw qError;

    if (!questions || questions.length === 0) {
      return NextResponse.json({
        bank: bank as LearningBankDetail,
        questions: [] as LearningQuestion[],
      });
    }

    const questionIds = questions.map((q) => q.id);

    // Fetch options INCLUDING is_correct — intentional in learning section
    const { data: options, error: optError } = await supabaseAdmin
      .from('question_options')
      .select('id, question_id, content, is_correct, display_order')
      .in('question_id', questionIds)
      .order('display_order', { ascending: true });

    if (optError) throw optError;

    // Group options by question_id
    const optionsByQuestion: Record<string, LearningQuestion['options']> = {};
    for (const opt of options ?? []) {
      if (!optionsByQuestion[opt.question_id]) {
        optionsByQuestion[opt.question_id] = [];
      }
      optionsByQuestion[opt.question_id].push({
        id: opt.id,
        content: opt.content,
        is_correct: opt.is_correct,
        display_order: opt.display_order,
      });
    }

    // Resolve signed URLs for questions with images in parallel
    const result: LearningQuestion[] = await Promise.all(
      questions.map(async (q) => {
        const [contentImageUrl, explanationImageUrl] = await Promise.all([
          q.content_image_url ? getSignedUrl(q.content_image_url, 7200).catch(() => null) : null,
          q.explanation_image_url ? getSignedUrl(q.explanation_image_url, 7200).catch(() => null) : null,
        ]);

        return {
          id: q.id,
          content: q.content,
          explanation: q.explanation,
          content_image_url: contentImageUrl,
          explanation_image_url: explanationImageUrl,
          options: optionsByQuestion[q.id] ?? [],
        };
      })
    );

    return NextResponse.json({
      bank: bank as LearningBankDetail,
      questions: result,
    });
  } catch (err) {
    console.error('[GET /api/student/learn/[subject]/[bankId]/questions]', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred.', details: null } },
      { status: 500 }
    );
  }
}

