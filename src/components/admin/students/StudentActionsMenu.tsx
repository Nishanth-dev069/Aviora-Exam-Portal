'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, Edit, Lock, Ban, Trash2, UserCheck } from 'lucide-react';

interface Props {
  student: {
    id: string;
    status: string;
    full_name: string;
  };
  onEdit: () => void;
  onResetPassword: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}

export function StudentActionsMenu({ student, onEdit, onResetPassword, onToggleStatus, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleOpen = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuHeight = 200; // approximate
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < menuHeight
      ? Math.max(10, rect.top - menuHeight)
      : rect.bottom + 4;
    setMenuPos({
      top,
      right: window.innerWidth - rect.right,
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleAction = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleOpen}
        className="p-1.5 rounded-md hover:bg-surface-2 transition-colors text-text-secondary hover:text-text-primary"
        aria-label="Student actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && typeof window !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          onMouseLeave={() => setOpen(false)}
          style={{
            position: 'fixed',
            top: menuPos.top,
            right: menuPos.right,
            zIndex: 9999,
          }}
          className="w-48 rounded-xl border border-border bg-surface shadow-xl py-1 text-sm text-text-primary animate-in fade-in zoom-in-95 duration-100"
        >
          <button
            onClick={() => handleAction(onEdit)}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left font-medium hover:bg-surface-2 transition-colors"
          >
            <Edit className="h-4 w-4 text-text-muted" /> Edit Profile
          </button>
          <button
            onClick={() => handleAction(onResetPassword)}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left font-medium hover:bg-surface-2 transition-colors"
          >
            <Lock className="h-4 w-4 text-warning" /> Reset Password
          </button>
          <button
            onClick={() => handleAction(onToggleStatus)}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left font-medium hover:bg-surface-2 transition-colors"
          >
            {student.status === 'active'
              ? <><Ban className="h-4 w-4 text-amber-500" /> Suspend Student</>
              : <><UserCheck className="h-4 w-4 text-emerald-500" /> Activate Student</>
            }
          </button>
          <div className="my-1 border-t border-border" />
          <button
            onClick={() => handleAction(onDelete)}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left font-medium hover:bg-danger/10 text-danger transition-colors"
          >
            <Trash2 className="h-4 w-4" /> Delete Student
          </button>
        </div>,
        document.body
      )}
    </>
  );
}
