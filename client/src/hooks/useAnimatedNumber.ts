import { useEffect, useRef, useState } from "react";

export function useAnimatedNumber(target: number, durationMs = 700): number {
  const [value, setValue] = useState<number>(() => (Number.isFinite(target) ? target : 0));
  const fromRef = useRef<number>(Number.isFinite(target) ? target : 0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(target)) {
      return;
    }
    const from = fromRef.current;
    const delta = target - from;
    if (delta === 0) {
      return;
    }
    const startTime = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from + delta * eased;
      fromRef.current = next;
      setValue(next);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [target, durationMs]);

  return value;
}
