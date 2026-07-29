'use client';

import React, { useState } from 'react';
import ResultSummary from './ResultSummary';
import AnswerReview from './AnswerReview';
import Leaderboard, { LeaderboardEntry } from './Leaderboard';
import { cn } from '@/lib/utils';
import { LayoutDashboard, FileText, Trophy, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Props {
  examTitle: string;
  summary: React.ComponentProps<typeof ResultSummary>;
  review: {
    questions: React.ComponentProps<typeof AnswerReview>['questions'];
  };
  leaderboard: {
    entries: LeaderboardEntry[];
    currentStudentId: string;
    maxScore: number;
  } | null; // null if leaderboard shouldn't be shown
}

type Tab = 'summary' | 'review' | 'leaderboard';

export default function ResultTabs({ examTitle, summary, review, leaderboard }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('summary');

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden">
      
      {/* Top Navbar */}
      <header className="bg-surface border-b border-border shadow-sm z-20 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-bold text-text-primary hidden sm:block">
              {examTitle}
            </h1>
            
            <nav className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('summary')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  activeTab === 'summary' 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                )}
              >
                <LayoutDashboard className="w-4 h-4" /> Summary
              </button>
              
              <button
                onClick={() => setActiveTab('review')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  activeTab === 'review' 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                )}
              >
                <FileText className="w-4 h-4" /> Review Answers
              </button>
              
              {leaderboard && (
                <button
                  onClick={() => setActiveTab('leaderboard')}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    activeTab === 'leaderboard' 
                      ? 'bg-warning/10 text-warning-dark' 
                      : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                  )}
                >
                  <Trophy className="w-4 h-4" /> Leaderboard
                </button>
              )}
            </nav>
          </div>

          <Link 
            href="/dashboard"
            className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-primary transition-colors px-3 py-2 rounded-lg hover:bg-surface-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'summary' && (
          <div className="h-full overflow-y-auto custom-scrollbar p-6">
            <ResultSummary {...summary} />
            <div className="max-w-3xl mx-auto mt-6 flex gap-4 justify-center">
              <button 
                onClick={() => setActiveTab('review')}
                className="px-6 py-2.5 bg-surface border border-border rounded-lg text-text-primary font-medium hover:bg-surface-2 transition-colors shadow-sm"
              >
                Review Answers
              </button>
              {leaderboard && (
                <button 
                  onClick={() => setActiveTab('leaderboard')}
                  className="px-6 py-2.5 bg-surface border border-border rounded-lg text-text-primary font-medium hover:bg-surface-2 transition-colors shadow-sm"
                >
                  View Leaderboard
                </button>
              )}
            </div>
          </div>
        )}
        
        {activeTab === 'review' && (
          <AnswerReview 
            questions={review.questions} 
            examTitle={examTitle} 
            onBack={() => setActiveTab('summary')} 
          />
        )}
        
        {activeTab === 'leaderboard' && leaderboard && (
          <Leaderboard 
            examTitle={examTitle} 
            entries={leaderboard.entries} 
            currentStudentId={leaderboard.currentStudentId} 
            maxScore={leaderboard.maxScore} 
          />
        )}
      </main>

    </div>
  );
}
