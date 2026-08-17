'use client';

import React from 'react';

interface Props {
  email: string;
  studentName?: string;
  rollNumber?: string;
  examTitle?: string;
}

// 11 fixed positions evenly distributed across sidebar, question area, and header/footer
const WATERMARK_POSITIONS = [
  // Top tier
  { top: '12%', left: '16%' },
  { top: '14%', left: '52%' },
  { top: '12%', left: '88%' },

  // Upper-middle tier (staggered)
  { top: '38%', left: '8%' },
  { top: '36%', left: '42%' },
  { top: '38%', left: '82%' },

  // Lower-middle tier (staggered)
  { top: '64%', left: '22%' },
  { top: '62%', left: '58%' },
  { top: '65%', left: '90%' },

  // Bottom tier
  { top: '88%', left: '12%' },
  { top: '86%', left: '50%' },
];

export const WatermarkOverlay = React.memo(function WatermarkOverlay({ email }: Props) {
  const userEmail = (email || 'student@aviora.com').toLowerCase().trim();

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none select-none overflow-hidden z-[99995]"
    >
      {WATERMARK_POSITIONS.map((pos, idx) => (
        <div
          key={idx}
          className="absolute whitespace-nowrap font-mono text-[13px] tracking-widest font-semibold text-slate-500/35 dark:text-slate-400/40 select-none pointer-events-none"
          style={{
            top: pos.top,
            left: pos.left,
            transform: 'translate(-50%, -50%) rotate(-25deg)',
          }}
        >
          {userEmail}
        </div>
      ))}
    </div>
  );
});

export default WatermarkOverlay;
