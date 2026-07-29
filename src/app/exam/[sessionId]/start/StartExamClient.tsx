/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db, clearExamDataFromIndexedDB } from '@/lib/db';
import { Button } from '@/components/ui/Button';
import { ChevronRight } from 'lucide-react';
import { parseISO } from 'date-fns';
import { calibrateClockOffset } from '@/lib/exam/timer';

export default function StartExamClient({ examId }: { examId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const { db } = await import('@/lib/db');

      // Check Safari Private Browsing
      try {
        const testKey = '_aviosa_idb_test';
        await db.table('examSession').add({ session_id: testKey }).catch(() => {});
        await db.table('examSession').delete(testKey);
      } catch {
        setError('Private browsing is not supported for examinations. Please disable private browsing in your browser settings and try again.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/exam/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exam_id: examId }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error?.message || 'Failed to start exam.');
        setLoading(false);
        return;
      }
      
      // Calculate clock offset
      const clientTime = Date.now();
      const serverTime = parseISO(data.server_time).getTime();
      const clockOffset = serverTime - clientTime;
      if (data.server_time) {
        calibrateClockOffset(data.server_time);
      }

      // Clear any old IndexedDB data for this exam before writing new session
      await clearExamDataFromIndexedDB(examId);

      // 1. Write session
      await db.examSession.put({
        session_id: data.session.id,
        exam_id: data.session.exam_id,
        student_id: 'current_student', // Placeholder as not strictly required for local lookup by session_id
        status: data.session.status,
        started_at: data.session.started_at,
        expires_at: data.session.expires_at,
        submission_token: data.session.submission_token,
        clock_offset: clockOffset,
        security_violations: 0,
        settings: data.exam.settings,
        exam_title: data.exam.title,
        exam_subject: data.exam.subject || '',
        duration_minutes: data.exam.duration_minutes,
        question_ids: data.questions.map((q: any) => q.id),
      });

      // 2. Write questions
      const localQuestions = data.questions.map((q: any) => ({
        question_id: q.id,
        session_id: data.session.id,
        content: q.content,
        options: q.options,
      }));
      await db.questions.bulkPut(localQuestions);

      // 3. Write default answers
      const localAnswers = data.questions.map((q: any) => ({
        question_id: q.id,
        session_id: data.session.id,
        selected_option_id: null,
        is_marked_for_review: false,
        is_visited: false,
        time_spent_seconds: 0,
        updated_at: new Date().toISOString(),
        sync_status: 'synced' // Initial state is naturally synced
      }));
      await db.answers.bulkPut(localAnswers);
      
      // Request Fullscreen
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen().catch(() => {
          console.warn('Fullscreen request denied or not supported');
        });
      }

      // Redirect to the exam session
      router.push(`/exam/${data.session.id}`);
    } catch {
      setError('A network error occurred. Please check your connection.');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-danger-bg text-danger text-sm font-medium rounded-md border border-danger/30">{error}</div>}
      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={() => router.back()} disabled={loading}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleStart} isLoading={loading} disabled={loading}>
          Start Exam <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
