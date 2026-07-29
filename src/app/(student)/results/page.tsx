/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { CheckCircle2, XCircle, ChevronRight, AlertCircle, Award } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function StudentResultsPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div className="p-8 text-center">Please log in to view results.</div>;
  }

  // Fetch all results
  const { data: results, error } = await supabase
    .from('exam_results')
    .select(`
      session_id, percentage, total_score, max_score, is_passed, computed_at,
      exams(title, subject, type)
    `)
    .eq('student_id', user.id)
    .order('computed_at', { ascending: false });

  if (error) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-6 text-danger flex items-center gap-3 font-bold">
          <AlertCircle className="h-6 w-6" />
          Failed to load results
        </div>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) + 
           ' at ' + 
           d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-10 animate-in fade-in duration-300">
      
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Exam Results</h1>
        <p className="text-text-secondary mt-2">View your performance history and detailed feedback for past exams.</p>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        {results?.length === 0 ? (
          <div className="p-12 text-center text-text-muted flex flex-col items-center">
            <Award className="w-12 h-12 mb-4 opacity-20" />
            <p className="font-medium">You haven&apos;t completed any exams yet.</p>
            <Link href="/exams">
              <Button className="mt-4" variant="secondary">Browse Exams</Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-2 border-b border-border text-xs uppercase tracking-wider text-text-secondary">
                  <th className="px-6 py-4 font-semibold">Exam Title</th>
                  <th className="px-6 py-4 font-semibold">Type</th>
                  <th className="px-6 py-4 font-semibold">Date Completed</th>
                  <th className="px-6 py-4 font-semibold">Score</th>
                  <th className="px-6 py-4 font-semibold">Result</th>
                  <th className="px-6 py-4 font-semibold w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {results?.map((result: any) => {
                  const exam = Array.isArray(result.exams) ? result.exams[0] : result.exams;
                  const isPractice = exam?.type === 'practice';
                  return (
                    <tr key={result.session_id} className="hover:bg-surface-2/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-bold text-text-primary group-hover:text-primary transition-colors line-clamp-1">{exam?.title || 'Unknown Exam'}</p>
                          <p className="text-xs text-text-secondary mt-0.5">{exam?.subject || 'Unknown'}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {isPractice ? (
                          <span className="inline-flex items-center text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                            Practice
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-surface-3 text-text-secondary border border-border">
                            Scheduled
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-text-secondary font-medium">
                        {formatDate(result.computed_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-text-primary">{result.percentage.toFixed(1)}%</span>
                          <span className="text-xs text-text-secondary">{result.total_score} / {result.max_score} Marks</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {result.is_passed === true ? (
                          <span className="inline-flex items-center gap-1.5 text-success font-bold text-sm bg-success/10 px-2.5 py-1 rounded-full">
                            <CheckCircle2 className="w-4 h-4" /> Passed
                          </span>
                        ) : result.is_passed === false ? (
                          <span className="inline-flex items-center gap-1.5 text-danger font-bold text-sm bg-danger/10 px-2.5 py-1 rounded-full">
                            <XCircle className="w-4 h-4" /> Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-text-secondary font-bold text-sm bg-surface-3 px-2.5 py-1 rounded-full">
                            Evaluated
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/exam/result/${result.session_id}`}>
                          <Button variant="ghost" size="sm" className="group-hover:bg-primary group-hover:text-white transition-all">
                            View <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
