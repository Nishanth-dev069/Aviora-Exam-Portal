'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  isSubmitting: boolean;
  stats: {
    answered: number;
    unanswered: number;
    marked: number;
    total: number;
  };
  onClose: () => void;
  onConfirm: () => void;
}

export const SubmitModal = React.memo(function SubmitModal({ isOpen, isSubmitting, stats, onClose, onConfirm }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-border bg-surface">
          <h2 className="text-xl font-bold text-text-primary">Submit Examination</h2>
          <p className="text-text-secondary mt-1 text-sm">Review your answers before submitting.</p>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <StatRow label="Answered" value={stats.answered} total={stats.total} color="bg-success" />
            <StatRow label="Unanswered" value={stats.unanswered} total={stats.total} color="bg-slate-400" />
            <StatRow label="Marked for Review" value={stats.marked} total={stats.total} color="bg-warning" />
          </div>

          <div className="bg-danger/10 border border-danger/20 rounded-lg p-4 text-sm text-danger flex items-start gap-3">
            <span className="text-lg leading-none">⚠</span>
            <p>Once submitted, you cannot return to this exam. Final answers will be permanently recorded.</p>
          </div>
        </div>

        <div className="p-6 bg-surface-2 border-t border-border flex items-center gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-2.5 rounded-lg border border-border text-text-primary text-sm font-medium hover:bg-surface disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex-1 py-2.5 rounded-lg bg-danger hover:bg-danger-hover text-white text-sm font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Confirm Submit'
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

export default SubmitModal;

function StatRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm font-medium text-text-primary">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 w-full bg-border rounded-full overflow-hidden">
        <div 
          className={cn('h-full transition-all duration-500 ease-out rounded-full', color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
