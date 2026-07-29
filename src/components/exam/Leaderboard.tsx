'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Trophy } from 'lucide-react';

export interface LeaderboardEntry {
  student_id: string;
  full_name: string;
  total_score: number;
  percentage: number;
  rank: number;
}

interface Props {
  examTitle: string;
  entries: LeaderboardEntry[];
  currentStudentId: string;
  maxScore: number;
}

export default function Leaderboard({ examTitle, entries, currentStudentId, maxScore }: Props) {
  
  const getMedal = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '──';
  };

  return (
    <div className="flex flex-col h-full w-full bg-background animate-in fade-in duration-300">
      
      <div className="bg-surface border-b border-border p-8">
        <div className="max-w-4xl mx-auto w-full flex items-center gap-4">
          <div className="p-3 bg-warning/10 rounded-xl">
            <Trophy className="w-6 h-6 text-warning" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">Leaderboard</h2>
            <p className="text-sm text-text-secondary mt-1">{examTitle} — {entries.length} students submitted</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto bg-surface border border-border shadow-sm rounded-xl overflow-hidden">
          
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-2 border-b border-border text-xs uppercase tracking-wider text-text-secondary">
                <th className="px-6 py-4 font-semibold w-24">Rank</th>
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold text-right">Score</th>
                <th className="px-6 py-4 font-semibold text-right">Percentage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((entry) => {
                const isMe = entry.student_id === currentStudentId;
                return (
                  <tr 
                    key={entry.student_id}
                    className={cn(
                      'transition-all',
                      isMe 
                        ? 'bg-primary/10 border-l-4 border-l-primary shadow-sm hover:bg-primary/15' 
                        : 'bg-surface hover:bg-surface-2 border-l-4 border-l-transparent'
                    )}
                  >
                    <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-lg w-6 text-center">{getMedal(entry.rank)}</span>
                        <span className={cn('text-text-primary', entry.rank <= 3 ? 'font-black' : '')}>#{entry.rank}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-primary font-bold">
                      <div className="flex items-center gap-2">
                        <span>{entry.full_name}</span>
                        {isMe && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-primary text-background shadow-xs">
                            YOU
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary text-right font-medium">
                      {entry.total_score} <span className="text-text-muted text-xs font-normal">/ {maxScore}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-bold">
                      <span className={entry.percentage >= 80 ? 'text-success' : entry.percentage >= 50 ? 'text-warning' : 'text-danger'}>
                        {entry.percentage.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-text-muted text-sm">
                    No submissions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

        </div>
      </div>

    </div>
  );
}
