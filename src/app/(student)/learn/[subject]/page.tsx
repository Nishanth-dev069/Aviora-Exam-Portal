'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import ChapterList from '@/components/student/learn/ChapterList';
import { Skeleton } from '@/components/ui/Skeleton';
import type { LearningChapter } from '@/types';

export default function SubjectChaptersPage() {
  const params = useParams();
  const rawSubject = (params.subject as string) || '';
  const decodedSubject = decodeURIComponent(rawSubject);

  const [chapters, setChapters] = useState<LearningChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChapters = async () => {
    if (!rawSubject) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/student/learn/${encodeURIComponent(decodedSubject)}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error('Failed to load chapters');
      }
      const data: LearningChapter[] = await res.json();
      setChapters(data);
    } catch (err: unknown) {
      console.error(err);
      setError('Failed to load chapters. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChapters();
  }, [rawSubject]);

  return (
    <div className="space-y-8 animate-in fade-in pb-12">
      {/* Back Button & Header */}
      <div className="border-b border-border pb-6 space-y-3">
        <Link
          href="/learn"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-text-secondary hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Subjects</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-text-primary">
              {decodedSubject} — Chapters
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Select a chapter to begin practicing questions.
            </p>
          </div>
          {error && (
            <button
              onClick={fetchChapters}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-2 hover:bg-border text-xs font-bold text-text-primary transition-colors border border-border shrink-0 self-start sm:self-center"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try Again</span>
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-danger/10 border border-danger/20 text-danger rounded-xl flex items-center gap-3 text-sm font-medium">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-surface border border-border rounded-xl p-5 flex items-center justify-between shadow-xs"
            >
              <div className="flex items-center gap-3.5">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48 rounded" />
                  <Skeleton className="h-3.5 w-24 rounded" />
                </div>
              </div>
              <Skeleton className="h-9 w-20 rounded-lg" />
            </div>
          ))}
        </div>
      ) : (
        <ChapterList chapters={chapters} subject={decodedSubject} />
      )}
    </div>
  );
}
