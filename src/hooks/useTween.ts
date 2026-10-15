import { useEffect, useRef, useState } from 'react';

export type Points = Record<string | number, { x: number; y: number }>;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Interpolates keyed positions between renders so nodes and the edges attached
 * to them move together smoothly (SVG attributes cannot be CSS-transitioned).
 */
export function useTweenedPoints(target: Points, duration: number): Points {
  const [current, setCurrent] = useState<Points>(target);
  const fromRef = useRef<Points>(target);
  const curRef = useRef<Points>(target);
  const key = JSON.stringify(target);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const from = curRef.current;
    fromRef.current = from;
    if (reduce || duration < 30) {
      curRef.current = target;
      setCurrent(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = ease(t);
      const out: Points = {};
      for (const k in target) {
        const a = from[k] ?? target[k];
        const b = target[k];
        out[k] = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
      }
      curRef.current = out;
      setCurrent(out);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, duration]);

  return current;
}
