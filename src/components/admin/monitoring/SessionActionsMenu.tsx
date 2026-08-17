'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, LogOut, Eye, AlertTriangle, RotateCcw } from 'lucide-react';

export interface SessionActionRow {
  session_id: string;
  student_name: string;
  roll_number: string;
  status: string;
  security_violations?: number;
}

interface Props {
  session: SessionActionRow;
  onForceSubmit: (sessionId: string, studentName: string) => void;
  onRestoreSession?: (sessionId: string, studentName: string, status: string, violations: number) => void;
  onViewDetails: (sessionId: string, studentName: string) => void;
  onSendWarning?: (sessionId: string) => void;
}

export function SessionActionsMenu({
  session,
  onForceSubmit,
  onRestoreSession,
  onViewDetails,
  onSendWarning
}: Props) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuHeight = 160;
    const top = spaceBelow < menuHeight
      ? Math.max(10, rect.top - menuHeight)
      : rect.bottom + 4;
    setMenuPos({ top, right: Math.max(10, window.innerWidth - rect.right) });
    setOpen(prev => !prev);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const act = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  const normStatus = (session.status || '').toLowerCase().replace(/\s+/g, '_');
  const isActive = normStatus === 'in_progress' || normStatus === 'active' || normStatus === 'disconnected';
  const isRestorable = normStatus === 'submitted' || normStatus === 'expired' || normStatus === 'terminated';

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleOpen}
        className="p-1.5 rounded-md hover:bg-surface-2 transition-colors text-text-secondary hover:text-text-primary"
        aria-label="Session actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && typeof window !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
          className="w-52 rounded-xl border border-border bg-surface shadow-xl py-1 text-sm text-text-primary animate-in fade-in zoom-in-95 duration-100"
        >
          <button
            onClick={() => act(() => onViewDetails(session.session_id, session.student_name))}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left font-medium hover:bg-surface-2 transition-colors"
          >
            <Eye className="h-4 w-4 text-text-muted" /> View Details
          </button>

          {isRestorable && onRestoreSession && (
            <>
              <div className="my-1 border-t border-border" />
              <button
                onClick={() => act(() => onRestoreSession(
                  session.session_id,
                  session.student_name,
                  session.status,
                  session.security_violations || 0
                ))}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left font-medium hover:bg-emerald-50 text-emerald-600 transition-colors"
              >
                <RotateCcw className="h-4 w-4 text-emerald-600" /> Restore Session
              </button>
            </>
          )}

          {isActive && (
            <>
              {onSendWarning && (
                <button
                  onClick={() => act(() => onSendWarning(session.session_id))}
                  className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left font-medium hover:bg-surface-2 transition-colors"
                >
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> Log Warning
                </button>
              )}
              <div className="my-1 border-t border-border" />
              <button
                onClick={() => act(() => onForceSubmit(session.session_id, session.student_name))}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left font-medium hover:bg-danger/10 text-danger transition-colors"
              >
                <LogOut className="h-4 w-4" /> Force Submit
              </button>
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
