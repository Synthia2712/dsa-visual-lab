/** Shared types for all algorithm engines. Engines are pure: input in, recorded trace out. */

export type StepTag = 'info' | 'compare' | 'action' | 'success' | 'warn' | 'done';

export interface Step<S> {
  /** Full snapshot of the algorithm state after this operation. */
  state: S;
  /** One-line explanation of what happened. */
  message: string;
  tag: StepTag;
  /** Index into the algorithm's pseudocode lines, if applicable. */
  line?: number;
}

export interface Trace<S, R> {
  steps: Step<S>[];
  result: R;
  /** True when step recording was compressed to keep playback responsive. */
  truncated?: boolean;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Mulberry32 — small seeded PRNG so random inputs can be reproduced in tests. */
export function rng(seed = Date.now()): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(r: () => number, lo: number, hi: number): number {
  return lo + Math.floor(r() * (hi - lo + 1));
}

/** Parses a list of numbers separated by commas, spaces or newlines. */
export function parseNumberList(
  text: string,
  opts: { integer?: boolean; min?: number; max?: number; maxCount?: number; minCount?: number } = {},
): ParseResult<number[]> {
  const tokens = text.split(/[\s,;]+/).filter(Boolean);
  const { integer = false, min = -1e6, max = 1e6, maxCount = 40, minCount = 1 } = opts;
  if (tokens.length < minCount) return { ok: false, error: `Enter at least ${minCount} number${minCount > 1 ? 's' : ''}.` };
  if (tokens.length > maxCount) return { ok: false, error: `Too many values (${tokens.length}). Maximum is ${maxCount}.` };
  const out: number[] = [];
  for (const t of tokens) {
    const v = Number(t);
    if (!Number.isFinite(v)) return { ok: false, error: `"${t}" is not a valid number.` };
    if (integer && !Number.isInteger(v)) return { ok: false, error: `"${t}" must be a whole number.` };
    if (v < min || v > max) return { ok: false, error: `"${t}" is out of range (${min} to ${max}).` };
    out.push(v);
  }
  return { ok: true, value: out };
}
