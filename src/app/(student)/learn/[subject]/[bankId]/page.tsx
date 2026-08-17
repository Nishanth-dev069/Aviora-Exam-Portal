'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import LearningQuestionView from '@/components/student/learn/LearningQuestionView';
import type { LearningQuestion, LearningBankDetail } from '@/types';

interface QuestionsApiResponse {
  bank: LearningBankDetail;
  questions: LearningQuestion[];
}

export default function ChapterQuestionsStudyPage() {
  const params = useParams();
  const rawSubject = (params.subject as string) || '';
  const decodedSubject = decodeURIComponent(rawSubject);
  const bankId = (params.bankId as string) || '';

  const [data, setData] = useState<QuestionsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rawSubject || !bankId) return;

    const fetchQuestions = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/student/learn/${encodeURIComponent(decodedSubject)}/${bankId}/questions`,
          { cache: 'no-store' }
        );
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('Chapter not found or not available for study.');
          }
          throw new Error('Failed to load questions.');
        }
        const result: QuestionsApiResponse = await res.json();
        setData(result);
      } catch (err: unknown) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [rawSubject, bankId, decodedSubject]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm font-medium text-text-secondary">Loading questions...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto my-12 bg-surface border border-border rounded-2xl p-8 text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 rounded-xl bg-danger/10 text-danger flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-text-primary">Unable to Load Chapter</h3>
        <p className="text-sm text-text-secondary">{error || 'Chapter could not be loaded.'}</p>
        <div className="pt-2">
          <Link
            href={`/learn/${encodeURIComponent(decodedSubject)}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary-hover transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Chapters</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-2 sm:py-6">
      <LearningQuestionView
        questions={data.questions}
        bank={data.bank}
        subject={decodedSubject}
      />
    </div>
  );
}
