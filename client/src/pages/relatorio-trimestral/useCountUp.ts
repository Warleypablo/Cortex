import { useEffect, useRef, useState } from "react";

/**
 * Anima um número de 0 até `target` (easeOutExpo) via requestAnimationFrame.
 * Respeita prefers-reduced-motion (pula direto pro valor final).
 */
export function useCountUp(target: number, durationMs = 800, delayMs = 0): number {
  const [value, setValue] = useState(0);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduced || durationMs <= 0) {
      setValue(target);
      return;
    }
    let start: number | null = null;
    const tick = (t: number) => {
      if (start === null) start = t;
      const elapsed = t - start - delayMs;
      if (elapsed < 0) {
        raf.current = requestAnimationFrame(tick);
        return;
      }
      const p = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(2, -10 * p); // easeOutExpo
      setValue(p >= 1 ? target : target * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, durationMs, delayMs]);

  return value;
}
