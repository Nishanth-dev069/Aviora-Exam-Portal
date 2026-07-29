import React from 'react';

export default function DeviceBlocked() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md w-full bg-surface border border-border shadow-xl rounded-2xl p-8 text-center space-y-6">
        <div className="text-6xl leading-none">📵</div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            Mobile Phones Not Supported
          </h1>
          <p className="text-text-secondary text-sm leading-relaxed">
            AVIORA examinations must be taken on a tablet or computer to ensure security and fair proctoring conditions.
          </p>
        </div>
        <div className="rounded-xl bg-surface-2 border border-border p-4 text-left space-y-2">
          <p className="text-xs font-bold text-primary uppercase tracking-wider">Supported Devices</p>
          <div className="space-y-1 text-xs font-medium text-text-primary">
            <p>✓ Android tablet (768px+ width)</p>
            <p>✓ iPad / iPadOS</p>
            <p>✓ Windows or Mac laptop / desktop</p>
          </div>
        </div>
        <p className="text-xs text-text-muted">
          If you are using a tablet and seeing this message, ensure your browser is not in portrait phone mode, or contact your administrator.
        </p>
      </div>
    </div>
  );
}
