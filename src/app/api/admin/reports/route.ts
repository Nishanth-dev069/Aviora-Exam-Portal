export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function verifyAdmin() {
  const cookieStore = await cookies();
  const supabaseAnon = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );

  const { data: { session }, error: authError } = await supabaseAnon.auth.getSession();
  const user = session?.user ?? null;
  if (authError || !user) return { error: 'Unauthorized', status: 401 };

  const supabaseAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } }
  );

  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!userData || !['admin', 'super_admin'].includes(userData.role)) {
    return { error: 'Forbidden', status: 403 };
  }

  return { user, supabaseAdmin };
}

export async function GET(request: Request) {
  const auth = await verifyAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { supabaseAdmin } = auth;
  const { searchParams } = new URL(request.url);
  const examId = searchParams.get('examId');
  const exportType = searchParams.get('export');

  if (!examId) {
    return NextResponse.json({ error: 'Missing examId parameter' }, { status: 400 });
  }

  try {
    // 1. Fetch Exam Meta
    const { data: examData, error: examErr } = await supabaseAdmin
      .from('exams')
      .select('title, subject, type, duration_minutes, scheduled_at, ends_at, total_questions')
      .eq('id', examId)
      .single();
    if (examErr) throw examErr;

    // 2. Fetch Total Enrolled
    const { count: enrolledCount, error: enrollErr } = await supabaseAdmin
      .from('exam_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('exam_id', examId);
    if (enrollErr) throw enrollErr;

    // 3. Fetch all Exam Results using supabaseAdmin
    const { data: resultsData, error: resultsErr } = await supabaseAdmin
      .from('exam_results')
      .select('id, session_id, student_id, total_score, max_score, percentage, is_passed, correct_count, incorrect_count, unanswered_count, time_taken_seconds, result_data, computed_at')
      .eq('exam_id', examId)
      .order('percentage', { ascending: false });

    if (resultsErr) throw resultsErr;

    const rawResults = resultsData || [];
    const studentIds = rawResults.map(r => r.student_id);
    const sessionIds = rawResults.map(r => r.session_id).filter(Boolean);

    const [{ data: profiles }, { data: sessionData }] = await Promise.all([
      studentIds.length > 0
        ? supabaseAdmin.from('student_profiles').select('user_id, full_name, roll_number').in('user_id', studentIds)
        : Promise.resolve({ data: [] }),
      sessionIds.length > 0
        ? supabaseAdmin.from('exam_sessions').select('id, started_at, submitted_at').in('id', sessionIds)
        : Promise.resolve({ data: [] })
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionMap = new Map((sessionData || []).map((s: any) => [s.id, s]));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = rawResults.map((r: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = (profiles || []).find((prof: any) => prof.user_id === r.student_id);
      
      let timeTakenSec = r.time_taken_seconds || r.result_data?.time_taken_seconds || 0;
      if (!timeTakenSec && r.session_id) {
        const sess = sessionMap.get(r.session_id);
        if (sess?.started_at && sess?.submitted_at) {
          const startMs = new Date(sess.started_at).getTime();
          const endMs = new Date(sess.submitted_at).getTime();
          if (endMs > startMs) {
            timeTakenSec = Math.round((endMs - startMs) / 1000);
          }
        }
      }

      return {
        ...r,
        time_taken_seconds: timeTakenSec,
        student_profiles: {
          full_name: p?.full_name || 'Unknown Student',
          roll_number: p?.roll_number || '—'
        }
      };
    });

    // CSV Export Flow
    if (exportType === 'csv') {
      const headers = ['Rank', 'Name', 'Roll No', 'Score', 'Percentage', 'Status', 'Submitted At'];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = results.map((r: any, i: number) => [
        i + 1,
        `"${r.student_profiles.full_name}"`,
        `"${r.student_profiles.roll_number}"`,
        r.total_score,
        r.percentage,
        r.is_passed === true ? 'Pass' : r.is_passed === false ? 'Fail' : 'N/A',
        new Date(r.computed_at).toISOString()
      ]);
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="exam_${examId}_results.csv"`,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
        }
      });
    }

    // JSON Flow
    const submittedCount = results.length;
    const notAttempted = Math.max(0, (enrolledCount || 0) - submittedCount);
    
    let sumScore = 0;
    const highestScore = results.length > 0 ? results[0].percentage : 0;
    const highestStudent = results.length > 0 ? `${results[0].student_profiles.full_name} (${results[0].student_profiles.roll_number})` : '';
    const lowestScore = results.length > 0 ? results[results.length - 1].percentage : 0;
    const lowestStudent = results.length > 0 ? `${results[results.length - 1].student_profiles.full_name} (${results[results.length - 1].student_profiles.roll_number})` : '';
    let passCount = 0;

    // For Question Analysis
    const questionStats: Record<string, { content: string, correct: number, incorrect: number, unanswered: number, total: number }> = {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    results.forEach((r: any) => {
      sumScore += r.percentage;
      if (r.is_passed) passCount++;

      const qData = (r.result_data?.questions || []) as { question_id: string; question_content?: string; is_correct?: boolean; is_unanswered?: boolean }[];
      qData.forEach((q) => {
        if (!questionStats[q.question_id]) {
          questionStats[q.question_id] = {
            content: q.question_content || 'Question',
            correct: 0,
            incorrect: 0,
            unanswered: 0,
            total: 0
          };
        }
        questionStats[q.question_id].total++;
        if (q.is_unanswered) {
          questionStats[q.question_id].unanswered++;
        } else if (q.is_correct) {
          questionStats[q.question_id].correct++;
        } else {
          questionStats[q.question_id].incorrect++;
        }
      });
    });

    const averageScore = submittedCount > 0 ? (sumScore / submittedCount) : 0;
    const passRate = submittedCount > 0 ? (passCount / submittedCount) * 100 : 0;

    const questionAnalysisArray = Object.entries(questionStats).map(([qId, qs]) => {
      const total = qs.total || (qs.correct + qs.incorrect + qs.unanswered);
      return {
        question_id: qId,
        content: qs.content,
        correct: qs.correct,
        incorrect: qs.incorrect,
        unanswered: qs.unanswered,
        total,
        correct_pct: total > 0 ? Math.round((qs.correct / total) * 10000) / 100 : 0,
      };
    });
    
    questionAnalysisArray.sort((a, b) => a.correct_pct - b.correct_pct);

    const reportData = {
      exam: examData,
      summary: {
        enrolled: enrolledCount || 0,
        submitted: submittedCount,
        not_attempted: notAttempted,
        pass_rate: Math.round(passRate * 100) / 100,
        pass_count: passCount,
        average_score: Math.round(averageScore * 100) / 100,
        highest_score: highestScore,
        highest_student: highestStudent,
        lowest_score: lowestScore,
        lowest_student: lowestStudent
      },
      // Fixed server-assigned ranks
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      students: results.map((r: any, i: number) => ({
        rank: i + 1,
        full_name: r.student_profiles.full_name,
        roll_number: r.student_profiles.roll_number,
        total_score: r.total_score,
        max_score: r.max_score,
        percentage: r.percentage,
        correct_count: r.correct_count,
        incorrect_count: r.incorrect_count,
        unanswered_count: r.unanswered_count,
        is_passed: r.is_passed,
        time_taken: r.time_taken_seconds || 0
      })),
      question_analysis: questionAnalysisArray
    };

    return NextResponse.json({ success: true, report: reportData }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      }
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal Error' }, { status: 500 });
  }
}
