/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useExamSession } from '@/hooks/useExamSession';
import { useSessionHeartbeat } from '@/hooks/useSessionHeartbeat';
import { useAntiCheat } from '@/lib/security/anti-cheat';
import { db, IDBAnswer } from '@/lib/db';
import { SyncEngine } from '@/lib/exam/sync-engine';
import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { createBrowserClient } from '@supabase/ssr';

import ExamLayout from '@/components/exam/ExamLayout';
import QuestionPanel from '@/components/exam/QuestionPanel';
import NavigationGrid from '@/components/exam/NavigationGrid';
import SubmitModal from '@/components/exam/SubmitModal';
import WatermarkOverlay from '@/components/exam/WatermarkOverlay';
import ViolationLockout from '@/components/exam/ViolationLockout';
import { useFullscreenEnforcement } from '@/hooks/useFullscreenEnforcement';
import FullscreenBlocker from '@/components/exam/FullscreenBlocker';

export default function ExamPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const { state } = useExamSession(sessionId);
  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<IDBAnswer[]>([]);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [securityWarnings, setSecurityWarnings] = useState(0);
  const [showWarningBanner, setShowWarningBanner] = useState(false);
  const [isTerminated, setIsTerminated] = useState(false);

  useSessionHeartbeat({
    sessionId,
    intervalMs: 10_000,
    onTerminated: () => {
      setIsTerminated(true);
    },
  });

  const handleFullscreenViolation = useCallback(() => {
    window.dispatchEvent(new CustomEvent('exam:violation', { detail: { count: securityWarnings + 1, type: 'fullscreen_exit' } }));
  }, [securityWarnings]);

  const { isBlocked: isFullscreenBlocked, requestFullscreen } = useFullscreenEnforcement({
    onViolation: handleFullscreenViolation,
  });

  // Violation Auto-Submit Lockout State
  const [isViolationLockout, setIsViolationLockout] = useState(false);
  const [lockoutSubmitting, setLockoutSubmitting] = useState(false);
  const [lockoutSubmitError, setLockoutSubmitError] = useState<string | null>(null);
  const violationAutoSubmitTriggered = useRef(false);

  // Student details for Watermark
  const [studentInfo, setStudentInfo] = useState({
    studentName: 'Student',
    email: 'student@example.com',
    rollNumber: 'STU-123',
  });

  const syncEngineRef = useRef<SyncEngine | null>(null);

  // Fetch real student info for watermark
  useEffect(() => {
    async function fetchStudentProfile() {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('student_profiles')
            .select('full_name, roll_number')
            .eq('user_id', user.id)
            .maybeSingle();

          setStudentInfo({
            studentName: profile?.full_name || user.user_metadata?.full_name || user.email || 'Student',
            email: user.email || 'student@example.com',
            rollNumber: profile?.roll_number || 'STU-123',
          });
        }
      } catch (err) {
        console.error('Failed to fetch student details for watermark', err);
      }
    }

    fetchStudentProfile();
  }, []);

  // Load IndexedDB Data dynamically
  useEffect(() => {
    if (state === 'active') {
      const loadData = async () => {
        const s = await db.examSession.get(sessionId);
        const q = await db.questions.where({ session_id: sessionId }).toArray();
        if (s && q.length > 0) {
          const orderedQuestions = s.question_ids.map(id => q.find(x => x.question_id === id)).filter(Boolean);
          const a = await db.answers.where({ session_id: sessionId }).toArray();
          setSession(s);
          setQuestions(orderedQuestions);
          setAnswers(a);
          setSecurityWarnings(s.security_violations || 0);

          if (!syncEngineRef.current) {
            const engine = new SyncEngine(sessionId);
            engine.start();
            syncEngineRef.current = engine;
          }
        }
      };
      loadData();
    }
  }, [state, sessionId]);

  // Hook into anti-cheating systems
  useAntiCheat(
    sessionId, 
    session?.settings, 
    { full_name: studentInfo.studentName, roll_number: studentInfo.rollNumber }
  );

  // Violation Auto-Submit Pipeline with retry logic
  const triggerViolationAutoSubmit = useCallback(async (triggeredBy = 'violation_limit') => {
    if (violationAutoSubmitTriggered.current) return;
    violationAutoSubmitTriggered.current = true;

    // 1. Immediately lock screen
    setIsViolationLockout(true);
    setLockoutSubmitting(true);
    setLockoutSubmitError(null);

    try {
      // 2. Perform final sync of answers
      if (syncEngineRef.current) {
        syncEngineRef.current.stop();
        await Promise.race([
          syncEngineRef.current.triggerImmediateSync(),
          new Promise(resolve => setTimeout(resolve, 3000))
        ]);
      }

      // 3. Submit exam to backend
      const res = await fetch('/api/exam/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          submission_token: session?.submission_token,
          triggered_by: triggeredBy
        })
      });

      if (!res.ok) {
        throw new Error('Submit failed');
      }

      // 4. Clean up local IndexedDB
      try {
        await db.examSession.delete(sessionId);
        await db.questions.where({ session_id: sessionId }).delete();
        await db.answers.where({ session_id: sessionId }).delete();
        await db.securityEvents.where({ session_id: sessionId }).delete();
      } catch (cleanupError) {
        console.error('Failed to cleanup IndexedDB after auto submit', cleanupError);
      }

      // 5. Navigate to result screen
      router.replace(`/exam/result/${sessionId}`);
    } catch (err) {
      console.error('[Violation Auto Submit Error]', err);
      setLockoutSubmitting(false);
      setLockoutSubmitError('Submission failed due to a network error. Your answers are saved locally. Retrying automatically...');

      // Auto retry after 5 seconds
      setTimeout(() => {
        violationAutoSubmitTriggered.current = false;
        triggerViolationAutoSubmit(triggeredBy);
      }, 5000);
    }
  }, [session, sessionId, router]);

  // Block ALL keyboard & pointer events under lockout
  useEffect(() => {
    if (!isViolationLockout) return;

    const blockEvent = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener('keydown', blockEvent, true);
    document.addEventListener('keyup', blockEvent, true);
    document.addEventListener('keypress', blockEvent, true);
    document.addEventListener('click', blockEvent, true);
    document.addEventListener('touchstart', blockEvent, true);
    document.addEventListener('touchend', blockEvent, true);

    return () => {
      document.removeEventListener('keydown', blockEvent, true);
      document.removeEventListener('keyup', blockEvent, true);
      document.removeEventListener('keypress', blockEvent, true);
      document.removeEventListener('click', blockEvent, true);
      document.removeEventListener('touchstart', blockEvent, true);
      document.removeEventListener('touchend', blockEvent, true);
    };
  }, [isViolationLockout]);

  useEffect(() => {
    const handleViolation = (e: any) => {
      const newCount = e.detail.count;
      setSecurityWarnings(newCount);
      
      const maxSwitches = Number(session?.settings?.max_tab_switches) || 5;
      const isAutoSubmit = Boolean(
        session?.settings?.auto_submit_on_max_violations ?? 
        session?.settings?.auto_submit_on_max_violations_exceeded ?? 
        session?.settings?.auto_submit ?? 
        true
      );

      if (sessionId) {
        db.examSession.update(sessionId, { security_violations: newCount }).catch(() => {});
      }

      // If auto-submit on max violations is enabled and count reaches limit, terminate exam
      if (isAutoSubmit && newCount >= maxSwitches) {
        triggerViolationAutoSubmit('violation_limit');
      } else {
        setShowWarningBanner(true);
      }

      syncEngineRef.current?.triggerImmediateSync();
    };
    
    const handleAutoSubmitViolation = () => {
      triggerViolationAutoSubmit('violation_limit');
    };

    const handleSessionTerminated = () => {
      setIsTerminated(true);
      setTimeout(() => {
        router.push('/login');
      }, 5000);
    };
    
    const handleTimerExpired = () => handleFinalSubmit();

    window.addEventListener('exam:violation' as any, handleViolation);
    window.addEventListener('exam:auto_submit_violation' as any, handleAutoSubmitViolation);
    window.addEventListener('exam:timer_expired' as any, handleTimerExpired);
    window.addEventListener('exam:session_terminated' as any, handleSessionTerminated);

    return () => {
      window.removeEventListener('exam:violation' as any, handleViolation);
      window.removeEventListener('exam:auto_submit_violation' as any, handleAutoSubmitViolation);
      window.removeEventListener('exam:timer_expired' as any, handleTimerExpired);
      window.removeEventListener('exam:session_terminated' as any, handleSessionTerminated);
    };
  }, [router, session, triggerViolationAutoSubmit]);

  const handleNavigate = useCallback((idx: number) => {
    setCurrentIndex(idx);
  }, []);

  const handleSubmitClick = useCallback(() => {
    setIsSubmitModalOpen(true);
  }, []);

  const handleCloseSubmitModal = useCallback(() => {
    setIsSubmitModalOpen(false);
  }, []);

  const handleDismissWarning = useCallback(() => {
    setShowWarningBanner(false);
  }, []);

  const handlePrev = useCallback(() => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1));
  }, [questions.length]);

  const handleSelectOption = useCallback(async (optionId: string) => {
    if (!session || !questions.length || isViolationLockout) return;
    const qid = questions[currentIndex].question_id;
    const currentAns = answers.find(a => a.question_id === qid);
    const newSelectedOptionId = currentAns?.selected_option_id === optionId ? null : optionId;
    
    setAnswers(prev => prev.map(a => 
      a.question_id === qid 
        ? { ...a, selected_option_id: newSelectedOptionId, is_visited: true, updated_at: new Date().toISOString(), sync_status: 'local' } 
        : a
    ));

    const existing = await db.answers.get({ session_id: sessionId, question_id: qid });
    if (existing) {
      await db.answers.update([sessionId, qid], {
        selected_option_id: newSelectedOptionId,
        is_visited: true,
        updated_at: new Date().toISOString(),
        sync_status: 'local'
      });
    }
  }, [session, questions, currentIndex, answers, isViolationLockout, sessionId]);

  const handleToggleReview = useCallback(async () => {
    if (!session || !questions.length || isViolationLockout) return;
    const qid = questions[currentIndex].question_id;
    const currentAns = answers.find(a => a.question_id === qid);
    const newMarked = !currentAns?.is_marked_for_review;
    
    setAnswers(prev => prev.map(a => 
      a.question_id === qid ? { ...a, is_marked_for_review: newMarked, sync_status: 'local' } : a
    ));

    await db.answers.update([sessionId, qid], {
      is_marked_for_review: newMarked,
      sync_status: 'local'
    });
  }, [session, questions, currentIndex, answers, isViolationLockout, sessionId]);

  const handleFinalSubmit = useCallback(async () => {
    setIsSubmitting(true);
    
    try {
      if (syncEngineRef.current) {
        syncEngineRef.current.stop();
        await Promise.race([
          syncEngineRef.current.triggerImmediateSync(),
          new Promise(resolve => setTimeout(resolve, 5000))
        ]);
      }

      const res = await fetch('/api/exam/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          submission_token: session?.submission_token
        })
      });

      if (!res.ok) {
        throw new Error('Submit failed');
      }

      await res.json();
      
      try {
        await db.examSession.delete(sessionId);
        await db.questions.where({ session_id: sessionId }).delete();
        await db.answers.where({ session_id: sessionId }).delete();
        await db.securityEvents.where({ session_id: sessionId }).delete();
      } catch (cleanupError) {
        console.error('Failed to cleanup IndexedDB', cleanupError);
      }
      
      router.replace(`/exam/result/${sessionId}`);
      
    } catch (err) {
      console.error('Submission error:', err);
      setIsSubmitting(false);
      alert('Failed to submit exam. Please try again.');
    }
  }, [sessionId, session, router]);

  if (state === 'loading' || !session || questions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col animate-pulse">
        {/* Top Header Skeleton */}
        <header className="h-16 border-b border-border bg-surface px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Skeleton className="h-6 w-40 rounded" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-32 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </header>

        {/* Main Content Area Skeleton */}
        <div className="flex-1 flex overflow-hidden p-6 gap-6 max-w-[1600px] w-full mx-auto">
          {/* Question Panel */}
          <div className="flex-1 bg-surface border border-border rounded-xl p-8 flex flex-col space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <Skeleton className="h-6 w-32 rounded" />
              <Skeleton className="h-5 w-20 rounded-md" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-5 w-full rounded" />
              <Skeleton className="h-5 w-3/4 rounded" />
            </div>
            <div className="space-y-4 pt-4 flex-1">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="p-4 border border-border rounded-xl flex items-center gap-4">
                  <Skeleton className="h-5 w-5 rounded-full shrink-0" />
                  <Skeleton className="h-4 flex-1 rounded" />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-border pt-4">
              <Skeleton className="h-10 w-28 rounded-lg" />
              <Skeleton className="h-10 w-28 rounded-lg" />
            </div>
          </div>

          {/* Palette Sidebar Skeleton */}
          <div className="w-80 bg-surface border border-border rounded-xl p-6 hidden lg:flex flex-col space-y-6">
            <Skeleton className="h-5 w-36 rounded" />
            <div className="grid grid-cols-5 gap-2.5">
              {[...Array(20)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-10 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'expired' || state === 'error') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-danger font-medium">
        {state === 'expired' ? 'This exam session has expired.' : 'Failed to load exam session.'}
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const currentA = answers.find(a => a.question_id === currentQ.question_id);

  const stats = {
    total: questions.length,
    answered: answers.filter(a => a.selected_option_id !== null).length,
    unanswered: questions.length - answers.filter(a => a.selected_option_id !== null).length,
    marked: answers.filter(a => a.is_marked_for_review).length,
  };

  if (isTerminated) {
    return (
      <div className="fixed inset-0 z-[99999] bg-background flex flex-col items-center justify-center p-4">
        <div className="bg-surface border border-border shadow-2xl rounded-xl p-8 max-w-lg w-full text-center animate-in zoom-in-95">
          <div className="text-danger text-5xl mb-4">⚠</div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">Session Terminated</h2>
          <p className="text-text-secondary mb-4">
            Your session was terminated because you logged in on another device.
          </p>
          <p className="text-text-secondary mb-6 text-sm">
            Your answers up to your last sync have been saved. Contact your administrator if this was unexpected.
          </p>
          <p className="text-text-muted text-xs font-medium animate-pulse">
            Returning to login in 5 seconds...
          </p>
        </div>
      </div>
    );
  }

  if (isTerminated) {
    return (
      <div className="fixed inset-0 z-[99999] bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4 p-8 bg-surface border border-border shadow-2xl rounded-2xl animate-in zoom-in-95">
          <div className="text-danger text-5xl">⚠️</div>
          <h2 className="text-xl font-bold text-text-primary">Session Terminated</h2>
          <p className="text-text-secondary text-sm leading-relaxed">
            Your session has been terminated because the same account was logged in on another device.
            Your answers up to your last sync have been saved securely.
            If this was not you, contact your administrator immediately.
          </p>
          <p className="text-xs text-text-muted">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Fullscreen Blocker Overlay — rendered when student exits fullscreen */}
      {isFullscreenBlocked && (
        <FullscreenBlocker
          onReturnToFullscreen={requestFullscreen}
          violationCount={securityWarnings}
          maxViolations={session?.settings?.max_tab_switches || 5}
        />
      )}

      {/* Violation Lockout — rendered on top of everything */}
      {isViolationLockout && (
        <ViolationLockout
          maxViolations={session?.settings?.max_tab_switches || 5}
          isSubmitting={lockoutSubmitting}
          submitError={lockoutSubmitError}
          onRetry={() => {
            violationAutoSubmitTriggered.current = false;
            triggerViolationAutoSubmit('violation_limit_retry');
          }}
        />
      )}

      {/* Watermark Overlay — rendered continuously across screen */}
      <WatermarkOverlay
        studentName={studentInfo.studentName}
        email={studentInfo.email}
        rollNumber={studentInfo.rollNumber}
        examTitle={session?.exam_title}
      />

      <ExamLayout
        examTitle={session.exam_title}
        currentQuestionIndex={currentIndex}
        totalQuestions={questions.length}
        expiresAt={session.expires_at}
        clockOffset={session.clock_offset}
        securityWarnings={securityWarnings}
        maxWarnings={session.settings?.max_tab_switches || 5}
        showWarningBanner={showWarningBanner}
        onDismissWarning={handleDismissWarning}
        studentEmail={studentInfo.email}
        sidebar={
          <NavigationGrid
            questionIds={session.question_ids}
            currentIndex={currentIndex}
            answers={answers}
            onNavigate={handleNavigate}
            onSubmitClick={handleSubmitClick}
          />
        }
      >
        <QuestionPanel
          questionNumber={currentIndex + 1}
          question={currentQ}
          answer={currentA}
          onSelectOption={handleSelectOption}
          onToggleReview={handleToggleReview}
          onPrev={handlePrev}
          onNext={handleNext}
          isFirst={currentIndex === 0}
          isLast={currentIndex === questions.length - 1}
        />
      </ExamLayout>

      <SubmitModal
        isOpen={isSubmitModalOpen}
        isSubmitting={isSubmitting}
        stats={stats}
        onClose={handleCloseSubmitModal}
        onConfirm={handleFinalSubmit}
      />
    </>
  );
}
