export interface ClockCalibration {
  offset: number;        // server_time - client_time at calibration moment
  calibrated_at: number; // client timestamp when calibrated
}

let calibration: ClockCalibration | null = null;

/**
 * Call this immediately when session data is received from the server.
 * server_time is the ISO string from the API response.
 */
export function calibrateClockOffset(serverTimeIso: string): void {
  const serverMs = new Date(serverTimeIso).getTime();
  const clientMs = Date.now();
  calibration = {
    offset: serverMs - clientMs,
    calibrated_at: clientMs,
  };
  // Persist to storage so it survives refresh
  storeCalibration(calibration);
}

/**
 * Recalibrate using sync response — call this after every successful autosave.
 * Keeps the clock offset fresh throughout a long exam.
 */
export function recalibrateFromSync(serverTimeIso: string): void {
  calibrateClockOffset(serverTimeIso); // Same logic — overwrites with fresh reading
}

/**
 * Get the current server time in ms, adjusted for device clock skew.
 */
export function getServerNow(): number {
  if (!calibration) {
    restoreCalibration();
  }
  if (!calibration) {
    // Fallback: no calibration yet, use device time with a warning
    console.warn('[AVIORA Timer] No clock calibration — using device time as fallback');
    return Date.now();
  }
  return Date.now() + calibration.offset;
}

/**
 * Calculate time remaining in ms.
 * expiresAtIso is the session.expires_at value from the server.
 */
export function getTimeRemainingMs(expiresAtIso: string): number {
  const expiresAtMs = new Date(expiresAtIso).getTime();
  const serverNowMs = getServerNow();
  return Math.max(0, expiresAtMs - serverNowMs);
}

/**
 * Format ms into HH:MM:SS string for display.
 */
export function formatTimeRemaining(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Internal: persist calibration to sessionStorage
async function storeCalibration(c: ClockCalibration): Promise<void> {
  try {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('clock_calibration', JSON.stringify(c));
    }
  } catch {
    // Non-critical — will recalibrate from sync
  }
}

// Call this on app boot to restore calibration from storage
export function restoreCalibration(): void {
  try {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('clock_calibration');
      if (stored) {
        calibration = JSON.parse(stored) as ClockCalibration;
      }
    }
  } catch {
    // Will recalibrate on next sync
  }
}
