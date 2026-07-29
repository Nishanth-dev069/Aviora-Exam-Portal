import React from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import StartExamClient from './StartExamClient';
import { AlertCircle } from 'lucide-react';

export default async function PreExamPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: exam, error } = await supabase
    .from('exams')
    .select('id, title, duration_minutes, total_questions, instructions, marks_per_question, negative_marks, status')
    .eq('id', sessionId)
    .single();

  if (error || !exam || exam.status !== 'active') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface shadow-md rounded-xl p-8 text-center flex flex-col items-center">
          <div className="h-12 w-12 rounded-full bg-danger/10 flex items-center justify-center mb-4">
            <AlertCircle className="h-6 w-6 text-danger" />
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Exam Unavailable</h2>
          <p className="text-text-secondary">This exam does not exist or is currently inactive.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="max-w-2xl w-full bg-surface shadow-xl rounded-xl border border-border overflow-hidden">
        {/* Header */}
        <div className="bg-primary text-white p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{exam.title}</h1>
        </div>

        <div className="p-6 md:p-8 space-y-8">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-text-muted mb-1 uppercase tracking-wider text-[11px] font-bold">Duration</div>
              <div className="font-semibold text-text-primary">{exam.duration_minutes} minutes</div>
            </div>
            <div>
              <div className="text-text-muted mb-1 uppercase tracking-wider text-[11px] font-bold">Questions</div>
              <div className="font-semibold text-text-primary">{exam.total_questions} MCQ</div>
            </div>
            <div>
              <div className="text-text-muted mb-1 uppercase tracking-wider text-[11px] font-bold">Marks</div>
              <div className="font-semibold text-text-primary">{exam.marks_per_question} per correct</div>
            </div>
            <div>
              <div className="text-text-muted mb-1 uppercase tracking-wider text-[11px] font-bold">Negative</div>
              <div className="font-semibold text-danger">
                {exam.negative_marks > 0 ? `-${exam.negative_marks} per incorrect` : 'No negative marking'}
              </div>
            </div>
          </div>

          <hr className="border-border" />

          {/* Instructions */}
          <div>
            <h2 className="text-lg font-bold text-text-primary mb-3">Instructions</h2>
            <div className="prose prose-sm text-text-secondary max-w-none">
              {exam.instructions ? (
                <p className="whitespace-pre-wrap">{exam.instructions}</p>
              ) : (
                <p>No specific instructions provided. Please read all questions carefully before answering.</p>
              )}
            </div>
          </div>

          <hr className="border-border" />

          {/* Warning */}
          <div className="bg-warning-bg border border-warning/30 rounded-lg p-5">
            <h3 className="flex items-center gap-2 font-bold text-warning-text mb-3">
              <span className="text-xl leading-none">⚠</span> Important Security Notice
            </h3>
            <ul className="list-disc list-outside text-sm text-warning-text/90 space-y-1.5 ml-5">
              <li>This exam will be strictly monitored for security violations.</li>
              <li>Do not switch tabs, minimize the window, or exit fullscreen.</li>
              <li>Ensure you have a stable internet connection before starting.</li>
              <li>Your answers will be saved automatically as you progress.</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <StartExamClient examId={exam.id} />
        </div>
      </div>
    </div>
  );
}
