'use client';

import React, { useMemo } from 'react';

interface Props {
  email: string;
  studentName?: string;
  rollNumber?: string;
  examTitle?: string;
}

export const WatermarkOverlay = React.memo(function WatermarkOverlay({ email }: Props) {
  const userEmail = (email || 'student@aviora.com').toLowerCase().trim();

  // Fixed pattern: keep only the light emails in exact same positions, removing all darkened emails
  const lineConfigs = useMemo(() => {
    const list = [];
    const emailsPerLine = 18;
    const totalLines = 45;

    for (let r = 0; r < totalLines; r++) {
      const chunks = [];
      const lightIndex = (r * 3 + 2) % emailsPerLine;

      for (let c = 0; c < emailsPerLine; c++) {
        chunks.push({
          id: `${r}-${c}`,
          isLightEmail: c === lightIndex,
        });
      }

      list.push({
        id: r,
        chunks,
        marginLeft: (r % 2 === 0 ? 0 : -140) + ((r * 37) % 80),
      });
    }
    return list;
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none select-none overflow-hidden z-[99995]"
    >
      <div
        className="absolute flex flex-col justify-between pointer-events-none select-none"
        style={{
          width: '350vw',
          height: '350vh',
          top: '-125vh',
          left: '-125vw',
          transform: 'rotate(-25deg)',
          transformOrigin: 'center center',
        }}
      >
        {lineConfigs.map(({ id, chunks, marginLeft }) => (
          <div
            key={id}
            className="whitespace-nowrap font-mono text-[13px] tracking-widest flex items-center"
            style={{
              marginLeft: `${marginLeft}px`,
            }}
          >
            {chunks.map(({ id: chunkId, isLightEmail }) =>
              isLightEmail ? (
                <span
                  key={chunkId}
                  className="font-semibold text-slate-500/35 dark:text-slate-400/40 text-[13px]"
                >
                  {userEmail}
                </span>
              ) : (
                <span
                  key={chunkId}
                  className="opacity-0 pointer-events-none select-none text-[13px]"
                >
                  {userEmail}
                </span>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

export default WatermarkOverlay;
