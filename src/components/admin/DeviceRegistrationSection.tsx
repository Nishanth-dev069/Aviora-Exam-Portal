'use client';

import { useState } from 'react';
import { MonitorSmartphone, ShieldCheck, ShieldOff, Loader2 } from 'lucide-react';

interface DeviceInfo {
  user_agent?:    string;
  ip_address?:    string;
  screen_width?:  number;
  screen_height?: number;
  registered_at?: string;
  last_login_at?: string;
}

interface DeviceRegistrationSectionProps {
  studentId:            string;
  registeredDeviceId:   string | null;
  registeredDeviceInfo: DeviceInfo | null;
  onDeviceCleared:      () => void;
}

function parseDevice(ua: string = '') {
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android.*Tablet|Tablet.*Android/.test(ua)) return 'Android Tablet';
  if (/Android/.test(ua)) return 'Android Device';
  if (/Windows NT/.test(ua)) return 'Windows PC';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Linux/.test(ua)) return 'Linux PC';
  return 'Unknown Device';
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export function DeviceRegistrationSection({
  studentId,
  registeredDeviceId,
  registeredDeviceInfo,
  onDeviceCleared,
}: DeviceRegistrationSectionProps) {
  const [clearing, setClearing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  const handleClearDevice = async () => {
    setClearing(true);
    setClearError(null);
    try {
      const res = await fetch(`/api/admin/students/${studentId}/device`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? 'Failed to clear device');
      setShowConfirm(false);
      onDeviceCleared();
    } catch (err: any) {
      setClearError(err.message);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MonitorSmartphone className="w-4 h-4 text-text-muted" />
          <h3 className="font-semibold text-text-primary text-sm">Registered Device</h3>
        </div>
        {registeredDeviceId ? (
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-success/10 text-success font-semibold">
            <ShieldCheck className="w-3 h-3" />
            Device Locked
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-surface-2 text-text-muted font-semibold">
            <ShieldOff className="w-3 h-3" />
            No Device
          </span>
        )}
      </div>

      {registeredDeviceId ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm bg-background rounded-lg p-3 border border-border/60">
            <div>
              <p className="text-text-muted text-xs uppercase tracking-wide mb-1">Device Type</p>
              <p className="font-medium text-text-primary">{parseDevice(registeredDeviceInfo?.user_agent)}</p>
            </div>
            <div>
              <p className="text-text-muted text-xs uppercase tracking-wide mb-1">IP Address</p>
              <p className="font-medium text-text-primary font-mono text-xs">{registeredDeviceInfo?.ip_address ?? '—'}</p>
            </div>
            {registeredDeviceInfo?.screen_width && (
              <div>
                <p className="text-text-muted text-xs uppercase tracking-wide mb-1">Screen Resolution</p>
                <p className="font-medium text-text-primary">{registeredDeviceInfo.screen_width} × {registeredDeviceInfo.screen_height}</p>
              </div>
            )}
            <div>
              <p className="text-text-muted text-xs uppercase tracking-wide mb-1">Registered On</p>
              <p className="font-medium text-text-primary">{formatDate(registeredDeviceInfo?.registered_at)}</p>
            </div>
            <div>
              <p className="text-text-muted text-xs uppercase tracking-wide mb-1">Last Login</p>
              <p className="font-medium text-text-primary">{formatDate(registeredDeviceInfo?.last_login_at)}</p>
            </div>
          </div>

          {!showConfirm ? (
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="w-full py-2 rounded-lg border border-danger text-danger text-sm font-semibold hover:bg-danger/5 transition-colors"
            >
              Clear Device Registration
            </button>
          ) : (
            <div className="rounded-lg bg-danger/5 border border-danger/20 p-4 space-y-3">
              <p className="text-sm font-semibold text-danger">Confirm Device Removal</p>
              <p className="text-sm text-text-secondary">
                After clearing, this student can log in from any device.
                Their next login will register a new device automatically.
              </p>
              {clearError && <p className="text-sm text-danger font-medium">{clearError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClearDevice}
                  disabled={clearing}
                  className="flex-1 py-2 rounded-lg bg-danger text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-danger/90 transition-colors"
                >
                  {clearing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {clearing ? 'Clearing...' : 'Yes, Clear Device'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowConfirm(false); setClearError(null); }}
                  disabled={clearing}
                  className="flex-1 py-2 rounded-lg border border-border text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-text-muted">
          No device is currently registered for this student.
          A device will be registered automatically on their next login.
        </p>
      )}
    </div>
  );
}
