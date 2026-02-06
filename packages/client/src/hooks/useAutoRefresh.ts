import { useCallback, useEffect, useRef } from 'react';

interface AutoRefreshOptions {
  enabled: boolean;
  refresh: () => void;
  intervalMs: number;
  idleTimeoutMs?: number;
}

const DEFAULT_IDLE_TIMEOUT_MS = 15000;

export function useAutoRefresh({
  enabled,
  refresh,
  intervalMs,
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
}: AutoRefreshOptions): void {
  const intervalRef = useRef<number | null>(null);
  const idleTimeoutRef = useRef<number | null>(null);

  const stopInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const clearIdleTimeout = useCallback(() => {
    if (idleTimeoutRef.current !== null) {
      window.clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
  }, []);

  const startInterval = useCallback(() => {
    if (intervalRef.current !== null) return;
    refresh();
    intervalRef.current = window.setInterval(refresh, intervalMs);
  }, [refresh, intervalMs]);

  const scheduleIdleTimeout = useCallback(() => {
    clearIdleTimeout();
    idleTimeoutRef.current = window.setTimeout(() => {
      stopInterval();
    }, idleTimeoutMs);
  }, [clearIdleTimeout, idleTimeoutMs, stopInterval]);

  const handleActivity = useCallback(() => {
    if (!enabled) return;
    if (document.visibilityState !== 'visible') return;
    startInterval();
    scheduleIdleTimeout();
  }, [enabled, scheduleIdleTimeout, startInterval]);

  const handleBlur = useCallback(() => {
    stopInterval();
    clearIdleTimeout();
  }, [clearIdleTimeout, stopInterval]);

  useEffect(() => {
    if (!enabled) {
      stopInterval();
      clearIdleTimeout();
      return;
    }

    handleActivity();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleActivity();
      } else {
        stopInterval();
        clearIdleTimeout();
      }
    };

    const scrollOptions: AddEventListenerOptions = { capture: true, passive: true };

    window.addEventListener('pointerdown', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity, { passive: true });
    window.addEventListener('focus', handleActivity);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('scroll', handleActivity, scrollOptions);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pointerdown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('focus', handleActivity);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('scroll', handleActivity, scrollOptions);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopInterval();
      clearIdleTimeout();
    };
  }, [enabled, handleActivity, clearIdleTimeout, handleBlur, stopInterval]);
}
