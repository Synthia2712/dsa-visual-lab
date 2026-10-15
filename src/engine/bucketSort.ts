import type { Step, Trace } from './types';
import { rng } from './types';

export interface Item {
  id: number;
  v: number;
}

export type BucketPhase = 'setup' | 'distribute' | 'sort' | 'collect' | 'done';

export interface BucketState {
  phase: BucketPhase;
  input: Item[];
  /** ids already moved out of the input row. */
  placed: number[];
  buckets: Item[][];
  output: Item[];
  ranges: [number, number][];
  activeId: number | null;
  activeBucket: number | null;
  /** ids being compared inside a bucket. */
  compare: [number, number] | null;
  swapped: boolean;
}

export interface BucketResult {
  sorted: number[];
  bucketSizes: number[];
  comparisons: number;
  shifts: number;
  k: number;
}

export const BUCKET_PSEUDOCODE = [
  'find min and max; width = (max − min) / k',
  'for each x: bucket i = ⌊(x − min) / (max − min) · k⌋ (clamped to k − 1)',
  'insertion-sort each bucket:',
  '  compare neighbours; shift larger value right',
  'concatenate buckets 0 … k − 1 into the output',
];

const fmt = (x: number) => (Number.isInteger(x) ? String(x) : String(+x.toFixed(3)));

export function runBucketSort(values: number[], k: number): Trace<BucketState, BucketResult> {
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
    span === 0 ? [min, max] : [min + i * width, i === k - 1 ? max : min + (i + 1) * width],
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
    span === 0
      ? `All ${values.length} values are equal (${fmt(min)}) — everything goes into bucket 0.`
      : `min = ${fmt(min)}, max = ${fmt(max)}. ${k} buckets, each covering a range of ${fmt(width)}.`,
    'info',
    0,
  );

  phase = 'distribute';
  for (const it of input) {
    const i = span === 0 ? 0 : Math.min(k - 1, Math.floor(((it.v - min) / span) * k));
    buckets[i].push(it);
    placed.push(it.id);
    snap(
      span === 0
        ? `${fmt(it.v)} → bucket 0.`
        : `${fmt(it.v)} → bucket ${i}  (⌊(${fmt(it.v)} − ${fmt(min)}) / ${fmt(span)} × ${k}⌋ = ${i}${i === k - 1 && ((it.v - min) / span) * k >= k ? ', clamped' : ''}).`,
      'action',
      1,
      { activeId: it.id, activeBucket: i },
    );
  }

  phase = 'sort';
  for (let b = 0; b < k; b++) {
    const B = buckets[b];
    if (B.length === 0) {
      snap(`Bucket ${b} is empty — skip.`, 'compare', 2, { activeBucket: b });
      continue;
    }
    if (B.length === 1) {
      snap(`Bucket ${b} has one value — already sorted.`, 'compare', 2, { activeBucket: b });
      continue;
    }
    snap(`Insertion-sort bucket ${b} (${B.length} values).`, 'info', 2, { activeBucket: b });
    for (let i = 1; i < B.length; i++) {
      let j = i;
      while (j > 0) {
        comparisons++;
        const a = B[j - 1];
        const c = B[j];
        if (a.v > c.v) {
          snap(`${fmt(a.v)} > ${fmt(c.v)} → swap.`, 'compare', 3, { activeBucket: b, compare: [a.id, c.id] });
          B[j - 1] = c;
          B[j] = a;
          shifts++;
          snap(`Shifted ${fmt(a.v)} right.`, 'action', 3, { activeBucket: b, compare: [c.id, a.id], swapped: true });
          j--;
        } else {
          snap(`${fmt(a.v)} ≤ ${fmt(c.v)} → in place.`, 'compare', 3, { activeBucket: b, compare: [a.id, c.id] });
          break;
        }
      }
    }
    snap(`Bucket ${b} sorted: [${B.map((x) => fmt(x.v)).join(', ')}].`, 'success', 2, { activeBucket: b });
  }

  phase = 'collect';
  for (let b = 0; b < k; b++) {
    if (!buckets[b].length) continue;
    const moved = buckets[b].splice(0);
    output.push(...moved);
    snap(`Append bucket ${b} → output: ${moved.map((x) => fmt(x.v)).join(', ')}.`, 'action', 4, { activeBucket: b });
  }

  phase = 'done';
  const sorted = output.map((x) => x.v);
  snap(`Sorted: [${sorted.map(fmt).join(', ')}].`, 'done', undefined);
  // reconstruct bucket sizes from the distribute phase
  const bucketSizes = new Array<number>(k).fill(0);
  for (const v of values) bucketSizes[span === 0 ? 0 : Math.min(k - 1, Math.floor(((v - min) / span) * k))]++;
  return { steps, result: { sorted, bucketSizes, comparisons, shifts, k } };
}

export function randomBucketInput(seed?: number): number[] {
  const r = rng(seed);
  const n = 8 + Math.floor(r() * 7);
  const decimals = r() < 0.4;
  return Array.from({ length: n }, () => (decimals ? +(r() * 1).toFixed(2) : Math.floor(r() * 100)));
}

export const formatNum = fmt;
