'use client';

import React from 'react';

interface ViolationLockoutProps {
  maxViolations: number;
  isSubmitting: boolean;
  submitError: string | null;
  onRetry: () => void;
}

export const ViolationLockout = React.memo(function ViolationLockout({
  maxViolations,
  isSubmitting,
  submitError,
  onRetry,
}: ViolationLockoutProps) {
  return (
    // Full-screen, non-dismissable overlay. No close button. No escape key handling.
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,  // Above everything including watermark
        backgroundColor: 'rgba(0, 0, 0, 0.92)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '24px',
        padding: '32px',
      }}
      // Prevent any keyboard events from reaching underlying exam
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
    >
      {/* Icon */}
      <div style={{ color: '#ef4444', fontSize: '64px', lineHeight: 1 }}>⚠</div>

      {/* Title */}
      <h1 style={{
        color: '#ffffff',
        fontSize: '24px',
        fontWeight: 700,
        textAlign: 'center',
        margin: 0,
      }}>
        Examination Terminated
      </h1>

      {/* Explanation */}
      <p style={{
        color: '#d1d5db',
        fontSize: '16px',
        textAlign: 'center',
        maxWidth: '480px',
        lineHeight: 1.6,
        margin: 0,
      }}>
        You have exceeded the maximum allowed security violations ({maxViolations}).
        Your examination is being submitted automatically. All answers saved up to 
        this point will be evaluated.
      </p>

      {/* Status */}
      {isSubmitting && !submitError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#9ca3af' }}>
          {/* Spinner */}
          <svg
            style={{ width: '24px', height: '24px', animation: 'spin 1s linear infinite' }}
            viewBox="0 0 24 24" fill="none"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 60" />
          </svg>
          <span style={{ fontSize: '14px' }}>Submitting your exam...</span>
        </div>
      )}

      {submitError && (
        <div style={{
          backgroundColor: '#7f1d1d',
          borderRadius: '8px',
          padding: '16px 24px',
          color: '#fca5a5',
          textAlign: 'center',
          maxWidth: '480px',
        }}>
          <p style={{ margin: '0 0 12px 0', fontSize: '14px' }}>
            Submission failed due to a network error. Your answers are saved locally.
            Retrying automatically...
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRetry();
            }}
            style={{
              backgroundColor: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            Retry Now
          </button>
        </div>
      )}

      {/* Legal notice */}
      <p style={{
        color: '#6b7280',
        fontSize: '12px',
        textAlign: 'center',
        maxWidth: '480px',
        margin: 0,
      }}>
        This incident has been recorded and will be reviewed by the examination 
        authority. Contact your administrator if you believe this was an error.
      </p>
    </div>
  );
});

export default ViolationLockout;
