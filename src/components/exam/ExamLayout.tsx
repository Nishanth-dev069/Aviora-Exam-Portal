'use client';

import React from 'react';
import ExamTimer from './ExamTimer';
import SyncIndicator from './SyncIndicator';
import { Plane } from 'lucide-react';
import WatermarkOverlay from './WatermarkOverlay';

import { ExamStudentIdentity } from './ExamStudentIdentity';

interface Props {
  examTitle: string;
  currentQuestionIndex: number;
  totalQuestions: number;
  expiresAt: string;
  clockOffset: number;
  securityWarnings: number;
  maxWarnings: number;
  showWarningBanner: boolean;
  onDismissWarning: () => void;
  studentFullName?: string;
  studentRollNumber?: string;
  studentEmail?: string;
  studentIdentity?: {
    full_name: string;
    roll_number: string;
    batch_name: string;
    email: string;
    photo_url: string | null;
  };
  children: React.ReactNode;
  sidebar: React.ReactNode;
}

export const ExamLayout = React.memo(function ExamLayout({
  examTitle,
  currentQuestionIndex,
  totalQuestions,
  expiresAt,
  clockOffset,
  securityWarnings,
  maxWarnings,
  showWarningBanner,
  onDismissWarning,
  studentEmail,
  studentIdentity,
  children,
  sidebar
}: Props) {
  return (
    <div className="exam-container bg-background">
      <WatermarkOverlay email={studentEmail || studentIdentity?.email || 'student@aviora.com'} />

      {/* Header */}
      <header className="col-span-2 flex items-center justify-between px-6 py-2 min-h-[64px] bg-surface border-b border-border shadow-xs z-10 gap-4">
        <div className="flex items-center gap-2.5 shrink-0">
          <img src="/aviora-logo.png" alt="AVIORA Logo" className="h-7 w-auto object-contain" />
          <span className="text-base font-black tracking-tight text-text-primary">
            AVIORA <span className="text-text-muted font-normal text-xs ml-0.5">Portal</span>
          </span>
        </div>
        
        <div className="flex-1 flex justify-center items-center text-sm font-medium text-text-primary truncate">
          {examTitle} <span className="mx-2 text-text-muted">·</span> Q {currentQuestionIndex + 1}/{totalQuestions}
        </div>
        
        <div className="flex items-center justify-end gap-5 shrink-0">
          <ExamTimer expiresAt={expiresAt} clockOffset={clockOffset} />

          {studentIdentity && (
            <div className="border-l border-border pl-5">
              <ExamStudentIdentity
                fullName={studentIdentity.full_name}
                rollNumber={studentIdentity.roll_number}
                batchName={studentIdentity.batch_name}
                email={studentIdentity.email}
                photoUrl={studentIdentity.photo_url}
              />
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative flex flex-col overflow-hidden bg-background">
        
        {/* Security Warning Banner */}
        {showWarningBanner && (
          <div className="absolute top-0 left-0 right-0 z-20 p-4 animate-in slide-in-from-top-2">
            <div className="bg-danger/10 border border-danger/20 rounded-lg p-4 shadow-sm flex items-start justify-between backdrop-blur-md">
              <div className="flex items-start gap-3 text-danger text-sm">
                <span className="text-lg leading-none mt-0.5">⚠</span>
                <div>
                  <p className="font-bold">Warning — Tab Switch Detected</p>
                  <p className="mt-0.5 opacity-90">You have left the exam window. This has been recorded.</p>
                  <p className="mt-2 font-medium">Violations: {securityWarnings} of {maxWarnings} maximum allowed.</p>
                </div>
              </div>
              <button 
                onClick={onDismissWarning}
                className="text-danger hover:bg-danger/10 p-1.5 rounded-md transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Question Content */}
        <div className="flex-1 overflow-hidden relative z-10">
          {children}
        </div>
      </main>

      {/* Sidebar */}
      <aside className="border-l border-border bg-surface-2 z-10">
        {sidebar}
      </aside>

      {/* Footer */}
      <footer className="col-span-2 flex items-center justify-between px-6 bg-surface border-t border-border z-10">
        <SyncIndicator />
        <div className="text-xs text-text-muted font-medium">
          Powered by ZYXEN
        </div>
      </footer>

    </div>
  );
});

export default ExamLayout;
