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
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('student_get_leaderboard');

    if (!rpcError && rpcData) {
      if (rpcData.notInBatch) {
        return NextResponse.json({
          leaderboard: [],
          currentStudentId: user.id,
          batchName: null,
          notInBatch: true,
        });
      }

      const { batchName, students = [], results = [] } = rpcData;
      const studentScores = (students || []).map((student: any) => {
        const studentResults = (results || []).filter((r: any) => r.student_id === student.user_id);
        const practiceResults = studentResults.filter((r: any) => r.exam_type === 'practice');
        const examResults = studentResults.filter((r: any) => r.exam_type === 'scheduled');

        const practiceAvg = practiceResults.length > 0
          ? practiceResults.reduce((s: number, r: any) => s + Number(r.percentage), 0) / practiceResults.length
          : 0;
        const examAvg = examResults.length > 0
          ? examResults.reduce((s: number, r: any) => s + Number(r.percentage), 0) / examResults.length
          : 0;

        const totalScore = practiceResults.length + examResults.length === 0
          ? 0
          : examResults.length > 0
            ? (practiceAvg * 0.3) + (examAvg * 0.7)
            : practiceAvg * 0.3;

        return {
          userId: student.user_id,
          fullName: student.full_name,
          email: student.email || '',
          rollNumber: student.roll_number,
          practiceAvg: Math.round(practiceAvg * 10) / 10,
          examAvg: Math.round(examAvg * 10) / 10,
          totalScore: Math.round(totalScore * 10) / 10,
          examsTaken: examResults.length,
          practicesTaken: practiceResults.length,
          totalAttempts: studentResults.length,
          isCurrentStudent: student.user_id === user.id,
        };
      });

      const ranked = studentScores
        .sort((a: any, b: any) => b.totalScore - a.totalScore)
        .map((s: any, i: number) => ({ ...s, rank: i + 1 }));

      return NextResponse.json({
        leaderboard: ranked,
        currentStudentId: user.id,
        batchName: batchName || 'Your Batch',
        notInBatch: false,
      });
    }

    // Fallback if RPC not yet deployed in DB
    const { data: profile } = await supabaseAdmin.from('student_profiles').select('batch_id, full_name, roll_number, batches(id, name)').eq('user_id', user.id).maybeSingle();
    const batchesData: any = profile?.batches;
    const batchName = (Array.isArray(batchesData) ? batchesData[0]?.name : batchesData?.name) || null;

    if (!profile?.batch_id) {
      return NextResponse.json({ leaderboard: [], currentStudentId: user.id, batchName: null, notInBatch: true });
    }

    const { data: batchStudents } = await supabaseAdmin.from('student_profiles').select('user_id, full_name, roll_number').eq('batch_id', profile.batch_id).is('deleted_at', null);
    if (!batchStudents || batchStudents.length === 0) {
      return NextResponse.json({ leaderboard: [], currentStudentId: user.id, batchName, notInBatch: false });
    }

    const studentIds = batchStudents.map(s => s.user_id);
    const { data: usersData } = studentIds.length > 0 ? await supabaseAdmin.from('users').select('id, email').in('id', studentIds) : { data: [] };
    const emailMap = new Map((usersData || []).map(u => [u.id, u.email]));
    const { data: allResults } = await supabaseAdmin.from('exam_results').select('student_id, exam_id, percentage, exams(type)').in('student_id', studentIds);

    const studentScores = batchStudents.map(student => {
      const studentResults = (allResults || []).filter((r: any) => r.student_id === student.user_id);
      const practiceResults = studentResults.filter((r: any) => (Array.isArray(r.exams) ? r.exams[0] : r.exams)?.type === 'practice');
      const examResults = studentResults.filter((r: any) => (Array.isArray(r.exams) ? r.exams[0] : r.exams)?.type === 'scheduled');
      const practiceAvg = practiceResults.length > 0 ? practiceResults.reduce((s, r) => s + Number(r.percentage), 0) / practiceResults.length : 0;
      const examAvg = examResults.length > 0 ? examResults.reduce((s, r) => s + Number(r.percentage), 0) / examResults.length : 0;
      const totalScore = practiceResults.length + examResults.length === 0 ? 0 : examResults.length > 0 ? (practiceAvg * 0.3) + (examAvg * 0.7) : practiceAvg * 0.3;

      return {
        userId: student.user_id,
        fullName: student.full_name,
        email: emailMap.get(student.user_id) || '',
        rollNumber: student.roll_number,
        practiceAvg: Math.round(practiceAvg * 10) / 10,
        examAvg: Math.round(examAvg * 10) / 10,
        totalScore: Math.round(totalScore * 10) / 10,
        examsTaken: examResults.length,
        practicesTaken: practiceResults.length,
        totalAttempts: studentResults.length,
        isCurrentStudent: student.user_id === user.id,
      };
    });

    const ranked = studentScores.sort((a, b) => b.totalScore - a.totalScore).map((s, i) => ({ ...s, rank: i + 1 }));

    return NextResponse.json({
      leaderboard: ranked,
      currentStudentId: user.id,
      batchName: batchName || 'Your Batch',
      notInBatch: false,
    });
  } catch (err: any) {
    console.error('[GET /api/student/leaderboard] Error:', err);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: err.message } }, { status: 500 });
  }
}

