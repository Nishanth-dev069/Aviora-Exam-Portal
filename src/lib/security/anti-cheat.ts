import { useEffect } from 'react';
import { db } from '@/lib/db';
import { ExamSettings, SecurityEventType } from '@/types';

export function useAntiCheat(
  sessionId: string,
  settings: ExamSettings,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _studentInfo?: { full_name: string; roll_number: string }
) {
  useEffect(() => {
    // Mount all event listeners
    const cleanup = [
      mountTabSwitchDetection(sessionId, settings),
      mountRightClickBlock(sessionId),
      mountCopyPasteBlock(sessionId),
      mountKeyboardShortcutBlock(sessionId),
    ];
    
    // Attempt fullscreen (best-effort — don't block if it fails)
    if (settings?.fullscreen_required && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {
        // Safari / iOS may reject this
      });
    }
    
    return () => cleanup.forEach(fn => fn());
  }, [sessionId, settings]);
}

async function logSecurityEvent(
  sessionId: string, 
  eventType: SecurityEventType, 
  data: Record<string, unknown>
) {
  try {
    await db.securityEvents.add({
      session_id: sessionId,
      event_type: eventType,
      occurred_at: new Date().toISOString(),
      duration_seconds: null,
      event_data: data,
      synced: false,
    });
  } catch (err) {
    console.error('Failed to log security event', err);
  }
}

async function incrementViolationCounter(sessionId: string, settings: ExamSettings) {
  try {
    // Update local IndexedDB session
    const session = await db.examSession.get(sessionId);
    if (!session) return;
    
    const newCount = (session.security_violations || 0) + 1;
    await db.examSession.update(sessionId, { security_violations: newCount });
    
    // Dispatch UI update for warning banner
    window.dispatchEvent(new CustomEvent('exam:violation', { detail: { count: newCount } }));
    
    // Check auto-submit threshold
    const s = (settings || {}) as Record<string, any>;
    const maxSwitches = Number(s?.max_tab_switches) || 5;
    const isAutoSubmit = Boolean(
      s?.auto_submit_on_max_violations ?? 
      s?.auto_submit_on_max_violations_exceeded ?? 
      s?.auto_submit ?? 
      true
    );

    if (isAutoSubmit && newCount >= maxSwitches) {
      console.warn(`[AntiCheat] Security violations (${newCount}) reached limit (${maxSwitches}). Triggering auto-submit lockout.`);
      window.dispatchEvent(new CustomEvent('exam:auto_submit_violation', {
        detail: { count: newCount, maxSwitches }
      }));
    }
  } catch (err) {
    console.error('Failed to increment violation counter', err);
  }
}

async function updateLastSecurityEvent(sessionId: string, duration: number) {
  try {
    const events = await db.securityEvents
      .where({ session_id: sessionId })
      .toArray();
      
    const lastFocusLost = events.reverse().find(e => 
      (e.event_type === 'tab_switch' || e.event_type === 'fullscreen_exit') && e.duration_seconds === null
    );
    if (lastFocusLost && lastFocusLost.id) {
      await db.securityEvents.update(lastFocusLost.id, { duration_seconds: duration, synced: false });
    }
  } catch (err) {
    console.error('Failed to update last security event', err);
  }
}

function mountTabSwitchDetection(sessionId: string, settings: ExamSettings) {
  let lastViolationTime = 0;
  let focusLostAt: number | null = null;
  const DEBOUNCE_MS = 2000; // 2-second debounce window to prevent dual triggers from blur + visibilitychange

  function triggerTabExit(eventType: 'tab_switch' | 'fullscreen_exit') {
    const now = Date.now();
    if (now - lastViolationTime < DEBOUNCE_MS) {
      return; // Suppress duplicate event
    }
    lastViolationTime = now;
    focusLostAt = now;

    logSecurityEvent(sessionId, eventType, {});
    incrementViolationCounter(sessionId, settings);
    window.dispatchEvent(new CustomEvent('exam:focus_lost'));
  }

  function triggerTabReturn() {
    if (focusLostAt) {
      const duration = Math.round((Date.now() - focusLostAt) / 1000);
      updateLastSecurityEvent(sessionId, duration);
      focusLostAt = null;
      window.dispatchEvent(new CustomEvent('exam:focus_returned'));
    }
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      triggerTabExit('fullscreen_exit');
    } else {
      triggerTabReturn();
    }
  }

  function onBlur() {
    triggerTabExit('tab_switch');
  }

  function onFocus() {
    triggerTabReturn();
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('focus', onFocus);
  };
}

function mountRightClickBlock(sessionId: string) {
  function prevent(e: Event) {
    e.preventDefault();
    if (e.type === 'contextmenu') logSecurityEvent(sessionId, 'right_click_attempt', {});
  }
  
  const events = ['contextmenu'];
  events.forEach(evt => document.addEventListener(evt, prevent, true));
  return () => events.forEach(evt => document.removeEventListener(evt, prevent, true));
}

function mountCopyPasteBlock(sessionId: string) {
  function prevent(e: Event) {
    e.preventDefault();
    if (e.type === 'copy' || e.type === 'cut') logSecurityEvent(sessionId, 'copy_attempt', { type: e.type });
    if (e.type === 'paste') logSecurityEvent(sessionId, 'paste_attempt', {});
  }
  
  const events = ['copy', 'cut', 'paste', 'selectstart'];
  events.forEach(evt => document.addEventListener(evt, prevent, true));
  return () => events.forEach(evt => document.removeEventListener(evt, prevent, true));
}

function mountKeyboardShortcutBlock(sessionId: string) {
  const BLOCKED = [
    { ctrl: true, key: 'a' }, { ctrl: true, key: 'c' }, { ctrl: true, key: 'v' },
    { ctrl: true, key: 'x' }, { ctrl: true, key: 'u' }, { ctrl: true, key: 'p' },
    { ctrl: true, key: 's' }, { ctrl: true, key: 'f' },
    { key: 'F12' }, { key: 'F5' },
    { ctrl: true, shift: true, key: 'i' }, { ctrl: true, shift: true, key: 'j' },
    { ctrl: true, shift: true, key: 'c' }, { ctrl: true, alt: true, key: 'i' },
  ];
  
  function onKeyDown(e: KeyboardEvent) {
    const isBlocked = BLOCKED.some(combo => {
      const ctrlOk = !combo.ctrl || (e.ctrlKey || e.metaKey);
      const shiftOk = !combo.shift || e.shiftKey;
      const altOk = !combo.alt || e.altKey;
      const keyOk = e.key === combo.key || e.key.toLowerCase() === combo.key;
      return ctrlOk && shiftOk && altOk && keyOk;
    });
    
    if (isBlocked) {
      e.preventDefault();
      e.stopPropagation();
      logSecurityEvent(sessionId, 'keyboard_shortcut_blocked', { key: e.key });
    }
  }
  
  document.addEventListener('keydown', onKeyDown, true);
  return () => document.removeEventListener('keydown', onKeyDown, true);
}
