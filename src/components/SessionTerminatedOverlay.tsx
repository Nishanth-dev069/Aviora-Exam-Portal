'use client';

import React from 'react';

export function SessionTerminatedOverlay() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '16px',
        padding: '32px',
      }}
    >
      <div style={{ fontSize: '48px', lineHeight: 1 }}>🔒</div>
      <h2
        style={{
          color: '#ffffff',
          fontSize: '20px',
          fontWeight: 700,
          textAlign: 'center',
          margin: 0,
        }}
      >
        Session Terminated
      </h2>
      <p
        style={{
          color: '#9ca3af',
          textAlign: 'center',
          maxWidth: '400px',
          fontSize: '15px',
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        Your session was ended because you logged in on another device or browser.
        Your answers up to your last sync have been saved. You will be redirected
        to the login page shortly.
      </p>
      <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>
        Redirecting to login...
      </p>
    </div>
  );
}

export default SessionTerminatedOverlay;
