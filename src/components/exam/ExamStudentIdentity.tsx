'use client';

import React from 'react';

interface ExamStudentIdentityProps {
  fullName: string;
  rollNumber: string;
  batchName: string;
  email: string;
  photoUrl: string | null;
}

export function ExamStudentIdentity({
  fullName,
  rollNumber,
  batchName,
  email,
  photoUrl,
}: ExamStudentIdentityProps) {
  const initial = (fullName || 'S').charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-3.5 select-none">
      {/* Prominent Photo Avatar */}
      <div className="w-14 h-14 rounded-full overflow-hidden bg-surface-2 border-2 border-primary/30 shrink-0 flex items-center justify-center shadow-xs">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={fullName}
            className="w-full h-full object-cover"
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-black text-xl">
            {initial}
          </div>
        )}
      </div>

      {/* Student details: Roll -> Name -> Batch */}
      <div className="flex flex-col text-left leading-tight min-w-0">
        <span className="text-xs font-black tracking-wider text-text-muted uppercase truncate">
          {rollNumber ? `ROLL: ${rollNumber}` : 'STUDENT ID'}
        </span>
        <span className="text-base font-black text-text-primary truncate mt-0.5">
          {fullName || 'Student'}
        </span>
        <span className="text-xs text-text-secondary font-bold truncate mt-0.5">
          {batchName ? `Batch: ${batchName}` : email}
        </span>
      </div>
    </div>
  );
}
