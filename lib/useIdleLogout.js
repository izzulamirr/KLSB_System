"use client";

import { useEffect, useRef } from "react";

export default function useIdleLogout({ enabled, timeoutMs, onTimeout }) {
  const timerRef = useRef(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const resetTimer = () => {
      if (firedRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(async () => {
        if (firedRef.current) return;
        firedRef.current = true;
        await onTimeout?.();
      }, timeoutMs);
    };

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click", "focus"];
    events.forEach((eventName) => {
      window.addEventListener(eventName, resetTimer, { passive: true });
    });

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") resetTimer();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    resetTimer();

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimer);
      });
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timerRef.current) clearTimeout(timerRef.current);
      firedRef.current = false;
    };
  }, [enabled, timeoutMs, onTimeout]);
}
