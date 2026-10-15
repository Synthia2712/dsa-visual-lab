import { useCallback, useEffect, useRef, useState } from 'react';

export const SPEEDS = [0.25, 0.5, 1, 2, 4, 8] as const;
const BASE_MS = 750;

export interface Player {
  index: number;
  total: number;
  playing: boolean;
  speed: number;
  setSpeed: (s: number) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  reset: () => void;
  seek: (i: number) => void;
  /** Duration of one step in ms at the current speed (renderers use it for transitions). */
  stepMs: number;
}

/** Playback over a recorded trace. The trace is the single source of truth, so prev/next are always consistent. */
export interface PlayerStart {
  /** Step to show when a new trace arrives. */
  start?: number;
  /** Start playing as soon as the new trace arrives. */
  autoplay?: boolean;
}

export function usePlayer(total: number, traceKey: unknown, startOpts: PlayerStart = {}): Player {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const totalRef = useRef(total);
  totalRef.current = total;

  const startRef = useRef(startOpts);
  startRef.current = startOpts;
  // New trace → jump to its start step; autoplay if requested.
  useEffect(() => {
    setIndex(Math.max(0, Math.min(startRef.current.start ?? 0, totalRef.current - 1)));
    setPlaying(!!startRef.current.autoplay);
  }, [traceKey]);

  const stepMs = Math.max(40, BASE_MS / speed);

  useEffect(() => {
    if (!playing) return;
    if (index >= total - 1) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => setIndex((i) => Math.min(i + 1, totalRef.current - 1)), stepMs);
    return () => window.clearTimeout(id);
  }, [playing, index, total, stepMs]);

  const clamp = (i: number) => Math.max(0, Math.min(i, Math.max(0, totalRef.current - 1)));
  const play = useCallback(() => {
    setIndex((i) => (i >= totalRef.current - 1 ? 0 : i));
    setPlaying(true);
  }, []);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => {
    setPlaying((p) => {
      if (!p) setIndex((i) => (i >= totalRef.current - 1 ? 0 : i));
      return !p;
    });
  }, []);
  const next = useCallback(() => {
    setPlaying(false);
    setIndex((i) => clamp(i + 1));
  }, []);
  const prev = useCallback(() => {
    setPlaying(false);
    setIndex((i) => clamp(i - 1));
  }, []);
  const reset = useCallback(() => {
    setPlaying(false);
    setIndex(0);
  }, []);
  const seek = useCallback((i: number) => setIndex(clamp(i)), []);

  return { index: clamp(index), total, playing, speed, setSpeed, play, pause, toggle, next, prev, reset, seek, stepMs };
}
