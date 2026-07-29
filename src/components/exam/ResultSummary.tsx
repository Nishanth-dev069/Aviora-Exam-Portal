import React from 'react';
import { Trophy, CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  totalScore: number;
  maxScore: number;
  percentage: number;
  isPassed: boolean | null;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  timeTakenSeconds: number;
  highestScore: number | null;
  rank: number | null;
  totalSubmissions: number | null;
}

export default function ResultSummary({
  totalScore,
  maxScore,
  percentage,
  isPassed,
  correctCount,
  incorrectCount,
  unansweredCount,
  timeTakenSeconds,
  highestScore,
  rank,
  totalSubmissions
}: Props) {
  
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div className="flex flex-col items-center justify-center py-10 w-full max-w-3xl mx-auto animate-in fade-in zoom-in-95 duration-500">
      
      {isPassed === true && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden flex justify-center z-0">
          {/* Lightweight CSS confetti effect could go here */}
          <div className="confetti-container absolute inset-0 opacity-50" />
        </div>
      )}

      <div className="relative z-10 w-full bg-surface border border-border shadow-sm rounded-2xl p-8 md:p-12 flex flex-col items-center">
        
        <h2 className="text-sm font-bold tracking-widest text-text-secondary uppercase mb-8">
          Examination Complete
        </h2>

        <div className="text-center mb-8">
          <div className="text-5xl md:text-6xl font-black text-primary mb-2">
            {totalScore} <span className="text-3xl text-text-muted font-bold">/ {maxScore}</span>
          </div>
          <div className="text-2xl font-semibold text-text-secondary">
            {percentage}%
          </div>
        </div>

        {isPassed !== null && (
          <div className={cn(
            'inline-flex items-center gap-2 px-6 py-2 rounded-full text-sm font-bold tracking-wider mb-10',
            isPassed ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
          )}>
            {isPassed ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            {isPassed ? 'PASSED' : 'FAILED'}
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-4 w-full mb-10">
          <MetricCard icon={<CheckCircle className="w-4 h-4 text-success" />} label="Correct" value={correctCount} color="border-l-success" />
          <MetricCard icon={<XCircle className="w-4 h-4 text-danger" />} label="Incorrect" value={incorrectCount} color="border-l-danger" />
          <MetricCard icon={<HelpCircle className="w-4 h-4 text-text-muted" />} label="Unanswered" value={unansweredCount} color="border-l-text-muted" />
        </div>

        {/* Details List */}
        <div className="w-full space-y-4 bg-surface-2 p-6 rounded-xl border border-border text-sm font-medium text-text-primary">
          <div className="flex justify-between items-center">
            <span className="text-text-secondary">Time Taken:</span>
            <span>{formatTime(timeTakenSeconds)}</span>
          </div>
          
          {highestScore !== null && (
            <div className="flex justify-between items-center border-t border-border pt-4">
              <span className="text-text-secondary">Highest Score in this exam:</span>
              <span>{highestScore}%</span>
            </div>
          )}
          
          {rank !== null && totalSubmissions !== null && (
            <div className="flex justify-between items-center border-t border-border pt-4">
              <span className="text-text-secondary flex items-center gap-2">
                <Trophy className="w-4 h-4 text-warning" /> Your Rank:
              </span>
              <span>{rank} out of {totalSubmissions} submitted</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: number, color: string }) {
  return (
    <div className={cn('bg-surface-2 border border-border rounded-xl p-4 flex flex-col items-center justify-center border-l-4', color)}>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary uppercase mb-2">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold text-text-primary">
        {value}
      </div>
    </div>
  );
}
