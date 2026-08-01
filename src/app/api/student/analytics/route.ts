/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
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

    // Optimization 1: getSession() instead of getUser()
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (authError || !user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });

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

    // Optimization 2: Call consolidated RPC
    let allResults: any[] = [];
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('student_get_analytics');

    if (rpcError || !rpcData) {
      const { data, error } = await supabaseAdmin
        .from('exam_results')
        .select('id, session_id, exam_id, percentage, total_score, max_score, correct_count, incorrect_count, unanswered_count, time_taken_seconds, is_passed, computed_at, exams(id, title, subject, type, total_questions, duration_minutes)')
        .eq('student_id', user.id)
        .order('computed_at', { ascending: true });

      if (error) {
        return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
      }
      allResults = data || [];
    } else {
      allResults = rpcData || [];
    }

    const results = allResults;

    // === COMPUTED STATS ===
    const totalExamsTaken = results.length;
    const practiceResults = results.filter(r => (Array.isArray(r.exams) ? r.exams[0] : r.exams)?.type === 'practice');
    const scheduledResults = results.filter(r => (Array.isArray(r.exams) ? r.exams[0] : r.exams)?.type === 'scheduled');
    const avgPercentage = results.length > 0
      ? results.reduce((sum, r) => sum + Number(r.percentage), 0) / results.length
      : 0;
    const highestScore = results.length > 0
      ? Math.max(...results.map(r => Number(r.percentage)))
      : 0;
    const passRate = scheduledResults.length > 0
      ? (scheduledResults.filter(r => r.is_passed === true).length / scheduledResults.length) * 100
      : null;

    // Score trend over time
    const trendData = results.slice(-20).map((r, idx) => {
      const ex = Array.isArray(r.exams) ? r.exams[0] : r.exams;
      return {
        label: `${ex?.subject?.substring(0, 8) || 'Exam'} ${idx + 1}`,
        subject: ex?.subject || 'Unknown',
        type: ex?.type || 'practice',
        percentage: Math.round(Number(r.percentage)),
        date: r.computed_at,
        examTitle: ex?.title || 'Exam',
        correct: r.correct_count,
        incorrect: r.incorrect_count,
        unanswered: r.unanswered_count,
      };
    });

    // Subject-wise performance
    const subjectMap: Record<string, { total: number; count: number; best: number }> = {};
    results.forEach(r => {
      const ex = Array.isArray(r.exams) ? r.exams[0] : r.exams;
      const subject = ex?.subject || 'Unknown';
      if (!subjectMap[subject]) {
        subjectMap[subject] = { total: 0, count: 0, best: 0 };
      }
      subjectMap[subject].total += Number(r.percentage);
      subjectMap[subject].count += 1;
      subjectMap[subject].best = Math.max(subjectMap[subject].best, Number(r.percentage));
    });

    const subjectData = Object.entries(subjectMap).map(([subject, stats]) => ({
      subject,
      average: Math.round(stats.total / stats.count),
      best: Math.round(stats.best),
      attempts: stats.count,
    })).sort((a, b) => b.average - a.average);

    // Recent detailed results
    const recentResults = [...results].reverse().slice(0, 10).map(r => {
      const ex = Array.isArray(r.exams) ? r.exams[0] : r.exams;
      return {
        sessionId: r.session_id,
        examTitle: ex?.title || 'Exam',
        subject: ex?.subject || '',
        type: ex?.type || 'practice',
        percentage: Math.round(Number(r.percentage)),
        correct: r.correct_count,
        incorrect: r.incorrect_count,
        unanswered: r.unanswered_count,
        timeTaken: r.time_taken_seconds || 0,
        isPassed: r.is_passed,
        date: r.computed_at,
      };
    });

    // Accuracy trend
    const accuracyTrend = trendData.map(d => ({
      ...d,
      accuracy: d.correct + d.incorrect > 0
        ? Math.round((d.correct / (d.correct + d.incorrect)) * 100)
        : 0,
    }));

    return NextResponse.json({
      summary: {
        totalExamsTaken,
        practicesTaken: practiceResults.length,
        scheduledTaken: scheduledResults.length,
        avgPercentage: Math.round(avgPercentage),
        highestScore: Math.round(highestScore),
        passRate: passRate !== null ? Math.round(passRate) : null,
      },
      trendData,
      accuracyTrend,
      subjectData,
      recentResults,
    });
  } catch (err: any) {
    console.error('[GET /api/student/analytics] Error:', err);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err.message } }, { status: 500 });
  }
}

