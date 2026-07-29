'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, LogOut, Eye, AlertTriangle } from 'lucide-react';

interface SessionRow {
  session_id: string;
  student_name: string;
  roll_number: string;
  status: string;
}

interface Props {
  session: SessionRow;
  onForceSubmit: (sessionId: string, studentName: string) => void;
  onViewDetails: (sessionId: string) => void;
  onSendWarning: (sessionId: string) => void;
}

export function SessionActionsMenu({ session, onForceSubmit, onViewDetails, onSendWarning }: Props) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleOpen = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuHeight = 150;
    const top = spaceBelow < menuHeight
      ? Math.max(10, rect.top - menuHeight)
      : rect.bottom + 4;
    setMenuPos({ top, right: window.innerWidth - rect.right });
    setOpen(true);
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

  const act = (fn: () => void) => { setOpen(false); fn(); };

  // Only show warning & force submit actions for sessions that are in progress / active / disconnected
  const isActive = session.status === 'In Progress' || session.status === 'in_progress' || session.status === 'active' || session.status === 'Disconnected';

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
          onMouseLeave={() => setOpen(false)}
          style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
          className="w-52 rounded-xl border border-border bg-surface shadow-xl py-1 text-sm text-text-primary animate-in fade-in zoom-in-95 duration-100"
        >
          <button
            onClick={() => act(() => onViewDetails(session.session_id))}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left font-medium hover:bg-surface-2 transition-colors"
          >
            <Eye className="h-4 w-4 text-text-muted" /> View Details
          </button>
          {isActive && (
            <>
              <button
                onClick={() => act(() => onSendWarning(session.session_id))}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left font-medium hover:bg-surface-2 transition-colors"
              >
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Log Warning
              </button>
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
