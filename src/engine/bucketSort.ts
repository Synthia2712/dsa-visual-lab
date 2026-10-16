import { BUCKET_NOTES, lineOf } from './javaSource';
import type { Step, Trace } from './types';
import { rng } from './types';

export interface Item {
  id: number;
  v: number;
}

export type BucketPhase = 'setup' | 'distribute' | 'sort' | 'collect' | 'done';

/**
 * 'notes'  — exactly as in the course notes: 10 buckets, bucketIndex = floor(value × 10), 0 ≤ value < 1.
 * 'range'  — generalised for any numbers: k buckets spread between min and max.
 */
export type BucketMode = 'notes' | 'range';

export interface BucketState {
  phase: BucketPhase;
  input: Item[];
  placed: number[];
  buckets: Item[][];
  output: Item[];
  ranges: [number, number][];
  activeId: number | null;
  activeBucket: number | null;
  compare: [number, number] | null;
  swapped: boolean;
}

export interface BucketResult {
  sorted: number[];
  bucketSizes: number[];
  comparisons: number;
  shifts: number;
  k: number;
  /** Buckets after distribution (before sorting) — matches "Step 2" in the notes. */
  distributed: number[][];
  /** Buckets after sorting — matches "Step 3". */
  sortedBuckets: number[][];
}

export const BUCKET_CODE = BUCKET_NOTES;
const J = {
  setup: lineOf(BUCKET_NOTES, 'bucketIndex = floor'),
  add: lineOf(BUCKET_NOTES, 'bucket[floor(value × 10)].add(value)'),
  bucket: lineOf(BUCKET_NOTES, 'for each bucket b:'),
  cmp: lineOf(BUCKET_NOTES, 'while j > 0'),
  swap: lineOf(BUCKET_NOTES, 'swap(b[j − 1], b[j])'),
  concat: lineOf(BUCKET_NOTES, 'output.addAll(bucket[b])'),
};

const fmt = (x: number) => (Number.isInteger(x) ? String(x) : String(+x.toFixed(4)));

export function bucketIndexOf(v: number, mode: BucketMode, k: number, min: number, max: number): number {
  if (mode === 'notes') return Math.floor(v * 10);
  const span = max - min;
  return span === 0 ? 0 : Math.min(k - 1, Math.floor(((v - min) / span) * k));
}

export function runBucketSort(values: number[], k: number, mode: BucketMode = 'range'): Trace<BucketState, BucketResult> {
  if (mode === 'notes') k = 10;
  const input: Item[] = values.map((v, id) => ({ id, v }));
  const steps: Step<BucketState>[] = [];
  const buckets: Item[][] = Array.from({ length: k }, () => []);
  const output: Item[] = [];
  const placed: number[] = [];
  let phase: BucketPhase = 'setup';
  let comparisons = 0;
  let shifts = 0;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const width = span / k;
  const ranges: [number, number][] = Array.from({ length: k }, (_, i) =>
    mode === 'notes' ? [i / 10, (i + 1) / 10] : span === 0 ? [min, max] : [min + i * width, i === k - 1 ? max : min + (i + 1) * width],
  );

  const snap = (
    message: string,
    tag: Step<BucketState>['tag'],
    line: number | undefined,
    extra: Partial<Pick<BucketState, 'activeId' | 'activeBucket' | 'compare' | 'swapped'>> = {},
  ) =>
    steps.push({
      state: {
        phase,
        input,
        placed: placed.slice(),
        buckets: buckets.map((b) => b.slice()),
        output: output.slice(),
        ranges,
        activeId: null,
        activeBucket: null,
        compare: null,
        swapped: false,
        ...extra,
      },
      message,
      tag,
      line,
    });

  snap(
    mode === 'notes'
      ? `Step 1: create 10 empty buckets (0 … 9). n = ${values.length}. bucketIndex = floor(value × 10).`
      : span === 0
        ? `All ${values.length} values are equal (${fmt(min)}) — everything goes into bucket 0.`
        : `Step 1: min = ${fmt(min)}, max = ${fmt(max)}; ${k} buckets, each covering ${fmt(width)}.`,
    'info',
    J.setup,
  );

  phase = 'distribute';
  for (const it of input) {
    const i = bucketIndexOf(it.v, mode, k, min, max);
    buckets[i].push(it);
    placed.push(it.id);
    snap(
      mode === 'notes'
        ? `Step 2: ${fmt(it.v)} → floor(${fmt(it.v)} × 10) = floor(${fmt(+(it.v * 10).toFixed(6))}) = ${i} → bucket ${i}.`
        : `Step 2: ${fmt(it.v)} → bucket ${i}  (⌊(${fmt(it.v)} − ${fmt(min)}) / ${fmt(span || 1)} × ${k}⌋${i === k - 1 && span > 0 && ((it.v - min) / span) * k >= k ? ', clamped to k − 1' : ''}).`,
      'action',
      J.add,
      { activeId: it.id, activeBucket: i },
    );
  }
  const distributed = buckets.map((b) => b.map((x) => x.v));

  phase = 'sort';
  for (let b = 0; b < k; b++) {
    const B = buckets[b];
    if (B.length <= 1) {
      snap(`Step 3: bucket ${b} ${B.length ? 'has one value — already sorted' : 'is empty'}.`, 'compare', J.bucket, { activeBucket: b });
      continue;
    }
    snap(`Step 3: sort bucket ${b} [${B.map((x) => fmt(x.v)).join(', ')}] with insertion sort.`, 'info', J.bucket, { activeBucket: b });
    for (let i = 1; i < B.length; i++) {
      let j = i;
      while (j > 0) {
        comparisons++;
        const a = B[j - 1];
        const c = B[j];
        if (a.v > c.v) {
          snap(`${fmt(a.v)} > ${fmt(c.v)} → swap.`, 'compare', J.cmp, { activeBucket: b, compare: [a.id, c.id] });
          B[j - 1] = c;
          B[j] = a;
          shifts++;
          snap(`Swapped: ${fmt(c.v)} moves left of ${fmt(a.v)}.`, 'action', J.swap, { activeBucket: b, compare: [c.id, a.id], swapped: true });
          j--;
        } else {
          snap(`${fmt(a.v)} ≤ ${fmt(c.v)} → in place.`, 'compare', J.cmp, { activeBucket: b, compare: [a.id, c.id] });
          break;
        }
      }
    }
    snap(`Bucket ${b} sorted: [${B.map((x) => fmt(x.v)).join(', ')}].`, 'success', J.bucket, { activeBucket: b });
  }
  const sortedBuckets = buckets.map((b) => b.map((x) => x.v));

  phase = 'collect';
  for (let b = 0; b < k; b++) {
    if (!buckets[b].length) continue;
    const moved = buckets[b].splice(0);
    output.push(...moved);
    snap(`Step 4: concatenate bucket ${b} → output gets ${moved.map((x) => fmt(x.v)).join(', ')}.`, 'action', J.concat, { activeBucket: b });
  }

  phase = 'done';
  const sorted = output.map((x) => x.v);
  snap(`Sorted: [${sorted.map(fmt).join(', ')}].`, 'done', undefined);
  return {
    steps,
    result: { sorted, bucketSizes: distributed.map((b) => b.length), comparisons, shifts, k, distributed, sortedBuckets },
  };
}

export function randomBucketInput(mode: BucketMode = 'notes', seed?: number): number[] {
  const r = rng(seed);
  const n = 8 + Math.floor(r() * 7);
  if (mode === 'notes') return Array.from({ length: n }, () => Math.floor(r() * 100) / 100);
  const decimals = r() < 0.4;
  return Array.from({ length: n }, () => (decimals ? +(r() * 50 - 10).toFixed(1) : Math.floor(r() * 100)));
}

export const formatNum = fmt;
