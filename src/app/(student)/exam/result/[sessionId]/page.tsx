import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import ResultTabs from '@/components/exam/ResultTabs';
import { LeaderboardEntry } from '@/components/exam/Leaderboard';
import { getSignedUrl } from '@/lib/storage/signed-urls';

export default async function ResultPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const cookieStore = await cookies();
  
  // 1. Authenticate Request
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // 2. We use admin client to fetch results safely (or RLS if configured)
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

  // 3. Fetch Exam Result
  const { data: result } = await supabaseAdmin
    .from('exam_results')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (!result) {
    notFound();
  }

  // Verify Ownership
  if (result.student_id !== user.id) {
    redirect('/dashboard'); // Forbidden
  }

  // 4. Fetch Exam Details, Leaderboard Top Results, and Submission Count in Parallel
  const [examRes, topResultsRes, countRes] = await Promise.all([
    supabaseAdmin
      .from('exams')
      .select('title, type, settings')
      .eq('id', result.exam_id)
      .single(),
    supabaseAdmin
      .from('exam_results')
      .select('student_id, total_score, percentage')
      .eq('exam_id', result.exam_id)
      .order('percentage', { ascending: false })
      .limit(50),
    supabaseAdmin
      .from('exam_results')
      .select('*', { count: 'exact', head: true })
      .eq('exam_id', result.exam_id),
  ]);

  const exam = examRes.data;
  if (!exam) {
    notFound();
  }

  const topResults = topResultsRes.data;
  const totalSubmissions = countRes.count;

  // 5. Build Leaderboard Data for submitted exams
  const showLeaderboard = exam.settings?.show_leaderboard_after !== false && exam.settings?.show_result !== false;
  
  let leaderboardData = null;
  let userRank = null;

  if (showLeaderboard && topResults && topResults.length > 0) {
    const studentIds = topResults.map((r: { student_id: string }) => r.student_id);
    
    const { data: profiles } = await supabaseAdmin
      .from('student_profiles')
      .select('user_id, full_name')
      .in('user_id', studentIds);
      
    const profileMap = new Map(profiles?.map((p: { user_id: string; full_name: string }) => [p.user_id, p.full_name]) || []);

    const entries: LeaderboardEntry[] = [];
    let currentRank = 1;
    let lastPercentage = -1;
    let tieCount = 0;

    for (let i = 0; i < topResults.length; i++) {
      const r = topResults[i];
      
      if (r.percentage === lastPercentage) {
        tieCount++;
      } else {
        currentRank = currentRank + tieCount;
        if (i === 0) currentRank = 1;
        tieCount = 1;
        lastPercentage = r.percentage;
      }

      entries.push({
        student_id: r.student_id,
        full_name: profileMap.get(r.student_id) || 'Unknown Student',
        total_score: r.total_score,
        percentage: r.percentage,
        rank: currentRank
      });
    }

    leaderboardData = {
      entries,
      currentStudentId: user.id,
      maxScore: result.max_score
    };

    const me = entries.find(e => e.student_id === user.id);
    if (me) {
      userRank = me.rank;
    }
  }

  // 6. Parse highest score
  let highestScore = null;
  if (showLeaderboard && leaderboardData?.entries.length) {
    highestScore = leaderboardData.entries[0].percentage;
  }

  // 7. Prepare props
  const summaryProps = {
    totalScore: result.total_score,
    maxScore: result.max_score,
    percentage: result.percentage,
    isPassed: result.is_passed,
    correctCount: result.correct_count,
    incorrectCount: result.incorrect_count,
    unansweredCount: result.unanswered_count,
    timeTakenSeconds: result.time_taken_seconds,
    highestScore,
    rank: userRank,
    totalSubmissions
  };

  const rawResultQuestions = result.result_data?.questions || [];
  const resultQuestionIds = rawResultQuestions.map((q: any) => q.question_id).filter(Boolean);

  const questionImgMap = new Map<string, { content_image_url: string | null; explanation_image_url: string | null }>();
  if (resultQuestionIds.length > 0) {
    const { data: dbQuestions } = await supabaseAdmin
      .from('questions')
      .select('id, content_image_url, explanation_image_url')
      .in('id', resultQuestionIds);

    (dbQuestions || []).forEach((q: any) => {
      questionImgMap.set(q.id, {
        content_image_url: q.content_image_url,
        explanation_image_url: q.explanation_image_url,
      });
    });
  }

  const reviewQuestionsWithSignedUrls = await Promise.all(
    rawResultQuestions.map(async (q: any) => {
      const dbImg = questionImgMap.get(q.question_id);
      const rawContentPath = q.content_image_url || dbImg?.content_image_url || null;
      const rawExpPath = q.explanation_image_url || dbImg?.explanation_image_url || null;

      return {
        ...q,
        content_image_url: rawContentPath ? await getSignedUrl(rawContentPath, 7200) : null,
        explanation_image_url: rawExpPath ? await getSignedUrl(rawExpPath, 7200) : null,
      };
    })
  );

  const reviewProps = {
    questions: reviewQuestionsWithSignedUrls
  };

  return (
    <ResultTabs 
      examTitle={exam.title}
      summary={summaryProps}
      review={reviewProps}
      leaderboard={leaderboardData}
    />
  );
}
