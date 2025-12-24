import { useState, useEffect, useRef } from "react";

function easeOutQuad(t: number): number {
  return t * (2 - t);
}

export function useCountUp(
  end: number,
  duration: number = 800,
  options?: { 
    decimals?: number;
    prefix?: string;
    suffix?: string;
    enabled?: boolean;
  }
): string {
  const { decimals = 0, prefix = "", suffix = "", enabled = true } = options || {};
  const [current, setCurrent] = useState(0);
  const previousEnd = useRef(end);
  const frameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setCurrent(end);
      return;
    }

    if (previousEnd.current !== end) {
      startValueRef.current = current;
      previousEnd.current = end;
      startTimeRef.current = null;
    }

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuad(progress);
      const newValue = startValueRef.current + (end - startValueRef.current) * easedProgress;

      setCurrent(newValue);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setCurrent(end);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [end, duration, enabled]);

  const formatted = decimals > 0 
    ? current.toFixed(decimals).replace(".", ",")
    : Math.round(current).toString();

  return `${prefix}${formatted}${suffix}`;
}

export function useCountUpNumber(
  end: number,
  duration: number = 800,
  enabled: boolean = true
): number {
  const [current, setCurrent] = useState(0);
  const previousEnd = useRef(end);
  const frameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setCurrent(end);
      return;
    }

    if (previousEnd.current !== end) {
      startValueRef.current = current;
      previousEnd.current = end;
      startTimeRef.current = null;
    }

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuad(progress);
      const newValue = startValueRef.current + (end - startValueRef.current) * easedProgress;

      setCurrent(newValue);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setCurrent(end);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [end, duration, enabled]);

  return current;
}
