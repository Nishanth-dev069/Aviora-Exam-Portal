'use client';

import { useState, useEffect, useCallback } from 'react';

interface FullscreenEnforcementOptions {
  onViolation?: () => void; // called each time fullscreen is exited
}

export function useFullscreenEnforcement({ onViolation }: FullscreenEnforcementOptions = {}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  const requestFullscreen = useCallback(async () => {
    const element = document.documentElement;
    try {
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if ((element as any).webkitRequestFullscreen) {
        await (element as any).webkitRequestFullscreen();
      } else if ((element as any).mozRequestFullScreen) {
        await (element as any).mozRequestFullScreen();
      } else if ((element as any).msRequestFullscreen) {
        await (element as any).msRequestFullscreen();
      }
    } catch {
      // Safari iOS doesn't support fullscreen API — show guidance instead
      console.warn('[AVIORA] Fullscreen API not supported on this device');
    }
  }, []);

  const checkFullscreenState = useCallback(() => {
    const inFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );
    setIsFullscreen(inFullscreen);
    if (!inFullscreen) {
      setIsBlocked(true);
      if (onViolation) onViolation();
    } else {
      setIsBlocked(false);
    }
  }, [onViolation]);

  useEffect(() => {
    document.addEventListener('fullscreenchange', checkFullscreenState);
    document.addEventListener('webkitfullscreenchange', checkFullscreenState);
    document.addEventListener('mozfullscreenchange', checkFullscreenState);
    document.addEventListener('MSFullscreenChange', checkFullscreenState);

    // Initial check on mount
    const inFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );
    setIsFullscreen(inFullscreen);
    if (!inFullscreen) {
      setIsBlocked(true);
    }

    return () => {
      document.removeEventListener('fullscreenchange', checkFullscreenState);
      document.removeEventListener('webkitfullscreenchange', checkFullscreenState);
      document.removeEventListener('mozfullscreenchange', checkFullscreenState);
      document.removeEventListener('MSFullscreenChange', checkFullscreenState);
    };
  }, [checkFullscreenState]);

  return { isFullscreen, isBlocked, requestFullscreen };
}
