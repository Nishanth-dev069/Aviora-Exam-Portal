'use client';

import React, { useEffect, useState } from 'react';
import { BookOpen, RefreshCw, AlertCircle } from 'lucide-react';
import SubjectGrid from '@/components/student/learn/SubjectGrid';
import type { LearningSubject } from '@/types';

export default function LearningSubjectsPage() {
  const [subjects, setSubjects] = useState<LearningSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/student/learn/subjects', {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error('Failed to load study subjects');
      }
      const data: LearningSubject[] = await res.json();
      setSubjects(data);
    } catch (err: unknown) {
      console.error(err);
      setError('Failed to load subjects. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in pb-12">
      {/* Page Header */}
      <div className="border-b border-border pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-text-primary flex items-center gap-2.5">
              <span>📚 Study — Question Banks</span>
            </h1>
            <p className="text-sm text-text-secondary mt-1 max-w-2xl">
              Browse aviation examination question banks organized by subject and chapter. Practice questions at your own pace with instant answer verification and explanations.
            </p>
          </div>
          {error && (
            <button
              onClick={fetchSubjects}
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

      {/* Content */}
      <SubjectGrid subjects={subjects} loading={loading} />
    </div>
  );
}
