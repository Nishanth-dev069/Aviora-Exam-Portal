const DEVICE_ID_KEY = 'aviora_device_id';

/**
 * Get the persistent device ID from localStorage.
 * If none exists, generate and store a new one.
 * This ID is stable across page refreshes and browser restarts.
 * It changes only if the user clears browser storage.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return ''; // SSR guard

  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    try {
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    } catch {
      // localStorage might be blocked (private mode on some browsers)
      console.warn('[DeviceID] localStorage unavailable, device registration may fail.');
    }
  }
  return deviceId;
}

/**
 * Get supplementary device fingerprint info for admin display.
 * This is informational only — the device_id UUID is the primary identifier.
 */
export function getDeviceInfo(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  return {
    screen_width:  window.screen.width,
    screen_height: window.screen.height,
    user_agent:    navigator.userAgent,
    language:      navigator.language,
    timezone:      Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}
