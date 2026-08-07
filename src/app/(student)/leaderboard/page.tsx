/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useEffect, useState } from 'react';
import { Trophy, Medal, Users } from 'lucide-react';
import { Skeleton, TableSkeleton } from '@/components/ui/Skeleton';

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 border border-amber-300 shrink-0">
      <Trophy className="h-4 w-4 text-amber-500" />
    </div>
  );
  if (rank === 2) return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 border border-slate-300 shrink-0">
      <Medal className="h-4 w-4 text-slate-500" />
    </div>
  );
  if (rank === 3) return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 border border-amber-200 shrink-0">
      <Medal className="h-4 w-4 text-amber-700" />
    </div>
  );
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 border border-border shrink-0">
      <span className="text-xs font-bold text-text-secondary">#{rank}</span>
    </div>
  );
}

export default function LeaderboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/student/leaderboard')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (!loading && data?.notInBatch) {
    return (
      <div className="max-w-3xl mx-auto p-8 my-12 text-center bg-surface border border-border rounded-2xl shadow-sm">
        <Users className="mx-auto h-12 w-12 text-text-muted" />
        <h2 className="mt-4 text-lg font-bold text-text-primary">Not in a batch yet</h2>
        <p className="mt-2 text-sm text-text-secondary">
          You haven&apos;t been assigned to a batch. Contact your admin to be added to one.
        </p>
      </div>
    );
  }

  const leaderboard = data?.leaderboard || [];
  const batchName = data?.batchName;
  const myEntry = leaderboard.find((s: any) => s.isCurrentStudent);
  const myRank = myEntry?.rank;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      {/* Header */}
      <div className="border-b border-border pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-text-primary">Batch Leaderboard</h1>
          {loading && !data ? (
            <Skeleton className="h-4 w-48 rounded-md mt-1.5" />
          ) : (
            <p className="mt-1 text-sm font-medium text-text-secondary">
              Batch: <span className="text-primary font-bold">{batchName || 'Default'}</span> · {leaderboard.length} student{leaderboard.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Your position card — show at top if not in top 3 */}
      {myEntry && myRank > 3 && (
        <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wider text-primary mb-2">
            Your Position
          </p>
          <div className="flex items-center gap-4">
            <RankBadge rank={myRank} />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-text-primary truncate">{myEntry.fullName} (You)</p>
              {myEntry.email && <p className="text-xs text-text-muted">{myEntry.email}</p>}
              <p className="text-xs text-text-secondary">Roll: {myEntry.rollNumber}</p>
            </div>
            <div className="grid grid-cols-3 gap-6 text-center shrink-0">
              <div>
                <p className="text-xs text-text-muted font-medium">Practice (30%)</p>
                <p className="text-sm font-bold text-text-primary">{myEntry.practicesTaken > 0 ? `${myEntry.practiceAvg}%` : '—'}</p>
                <p className="text-[10px] text-text-muted">{myEntry.practicesTaken} taken</p>
              </div>
              <div>
                <p className="text-xs text-text-muted font-medium">Exam (70%)</p>
                <p className="text-sm font-bold text-text-primary">{myEntry.examsTaken > 0 ? `${myEntry.examAvg}%` : '—'}</p>
                <p className="text-[10px] text-text-muted">{myEntry.examsTaken} taken</p>
              </div>
              <div>
                <p className="text-xs text-text-muted font-medium">Weighted Total</p>
                <p className="text-lg font-black text-primary">{myEntry.totalScore > 0 ? `${myEntry.totalScore}%` : '—'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Structured Leaderboard Table */}
      <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="px-4 py-3.5 text-xs font-bold text-text-secondary uppercase w-16">Rank</th>
                <th className="px-4 py-3.5 text-xs font-bold text-text-secondary uppercase">Student Name</th>
                <th className="px-4 py-3.5 text-xs font-bold text-text-secondary uppercase">Roll Number</th>
                <th className="px-4 py-3.5 text-xs font-bold text-text-secondary uppercase">Practice Avg (30%)</th>
                <th className="px-4 py-3.5 text-xs font-bold text-text-secondary uppercase">Exam Avg (70%)</th>
                <th className="px-4 py-3.5 text-xs font-bold text-text-secondary uppercase">Weighted Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && !data ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3.5"><Skeleton className="h-7 w-7 rounded-full" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="h-4 w-32 rounded" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="h-4 w-20 rounded" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="h-4 w-16 rounded" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="h-4 w-16 rounded" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="h-5 w-16 rounded" /></td>
                  </tr>
                ))
              ) : leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-text-muted">
                    No leaderboard scores available for this batch yet.
                  </td>
                </tr>
              ) : (
                leaderboard.map((student: any) => {
                  const isMe = student.isCurrentStudent;
                  const isTopThree = student.rank <= 3;

                  return (
                    <tr
                      key={student.userId}
                      className={`transition-all ${
                        isMe
                          ? 'bg-primary/10 border-l-4 border-l-primary shadow-sm hover:bg-primary/15 font-medium'
                          : isTopThree
                          ? 'bg-amber-50/40 hover:bg-amber-50/70 border-l-4 border-l-amber-400'
                          : 'hover:bg-surface-2/60 border-l-4 border-l-transparent'
                      }`}
                    >
                      <td className="px-4 py-3.5 align-middle">
                        <RankBadge rank={student.rank} />
                      </td>

                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${isMe ? 'text-primary' : 'text-text-primary'}`}>
                            {student.fullName}
                          </span>
                          {isMe && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-primary text-background shadow-xs">
                              YOU
                            </span>
                          )}
                        </div>
                        {student.email && (
                          <p className="text-xs text-text-muted font-normal mt-0.5">{student.email}</p>
                        )}
                      </td>

                      <td className="px-4 py-3.5 align-middle font-medium text-text-secondary">
                        {student.rollNumber || '—'}
                      </td>

                      <td className="px-4 py-3.5 align-middle">
                        <div className="font-bold text-text-primary">
                          {student.practicesTaken > 0 ? `${student.practiceAvg}%` : '—'}
                        </div>
                        <div className="text-xs text-text-muted">
                          {student.practicesTaken} taken
                        </div>
                      </td>

                      <td className="px-4 py-3.5 align-middle">
                        <div className="font-bold text-text-primary">
                          {student.examsTaken > 0 ? `${student.examAvg}%` : '—'}
                        </div>
                        <div className="text-xs text-text-muted">
                          {student.examsTaken} taken
                        </div>
                      </td>

                      <td className="px-4 py-3.5 align-middle">
                        <span className={`text-base font-black ${
                          student.totalScore >= 70 ? 'text-emerald-600' :
                          student.totalScore >= 50 ? 'text-amber-600' :
                          student.totalScore > 0 ? 'text-red-500' : 'text-text-muted'
                        }`}>
                          {student.totalScore > 0 ? `${student.totalScore}%` : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scoring formula legend */}
      <div className="rounded-xl border border-border bg-surface-2 px-4 py-3.5 text-xs text-text-secondary space-y-1">
        <p className="font-bold text-text-primary">How batch leaderboard scores are calculated:</p>
        <p className="text-text-muted">
          Weighted Total = (Practice Average × 30%) + (Scheduled Exam Average × 70%). Students with no attempts display —.
        </p>
      </div>
    </div>
  );
}
