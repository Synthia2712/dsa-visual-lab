import type { ParseResult, Step, Trace } from './types';
import { randInt, rng } from './types';

export type DsuOp =
  | { kind: 'union'; a: number; b: number }
  | { kind: 'find'; a: number }
  | { kind: 'connected'; a: number; b: number };

export type UnionStrategy = 'rank' | 'size';

export interface DsuState {
  parent: number[];
  rank: number[];
  size: number[];
  components: number;
  /** Nodes on the find path currently being walked. */
  path: number[];
  current: number | null;
  /** Roots involved in the current union. */
  roots: number[];
  /** Nodes whose parent pointer just changed. */
  changed: number[];
  opIndex: number;
}

export interface DsuResult {
  parent: number[];
  components: number;
  sets: number[][];
  answers: string[];
  pointerHops: number;
}

export const DSU_PSEUDOCODE = [
  'find(x): while parent[x] ≠ x: x = parent[x]',
  '  path compression: point every node on the path at the root',
  'union(a, b): ra = find(a), rb = find(b)',
  '  if ra == rb → already in the same set',
  '  attach the smaller tree (rank/size) under the larger',
  '  if ranks were equal → rank[new root] += 1',
  '  components −= 1',
];

export function opText(op: DsuOp): string {
  return op.kind === 'find' ? `find(${op.a})` : `${op.kind}(${op.a}, ${op.b})`;
}

export function runDsu(n: number, ops: DsuOp[], strategy: UnionStrategy, compression: boolean): Trace<DsuState, DsuResult> {
  const parent = Array.from({ length: n }, (_, i) => i);
  const rank = new Array<number>(n).fill(0);
  const size = new Array<number>(n).fill(1);
  let components = n;
  let opIndex = -1;
  let hops = 0;
  const steps: Step<DsuState>[] = [];
  const answers: string[] = [];

  const snap = (
    message: string,
    tag: Step<DsuState>['tag'],
    line: number | undefined,
    extra: Partial<Pick<DsuState, 'path' | 'current' | 'roots' | 'changed'>> = {},
  ) =>
    steps.push({
      state: {
        parent: parent.slice(),
        rank: rank.slice(),
        size: size.slice(),
        components,
        path: [],
        current: null,
        roots: [],
        changed: [],
        opIndex,
        ...extra,
      },
      message,
      tag,
      line,
    });

  const find = (x: number): number => {
    const path = [x];
    snap(`find(${x}): start at ${x}.`, 'info', 0, { path: [x], current: x });
    let r = x;
    while (parent[r] !== r) {
      hops++;
      snap(`parent[${r}] = ${parent[r]} → move up to ${parent[r]}.`, 'compare', 0, { path: path.slice(), current: parent[r] });
      r = parent[r];
      path.push(r);
    }
    snap(`${r} is its own parent → root of ${x}'s set is ${r}.`, 'success', 0, { path: path.slice(), current: r });
    if (compression) {
      const toFix = path.slice(0, -1).filter((v) => parent[v] !== r);
      if (toFix.length) {
        for (const v of toFix) parent[v] = r;
        snap(`Path compression: point ${toFix.join(', ')} directly at root ${r}.`, 'action', 1, {
          path: path.slice(),
          current: r,
          changed: toFix,
        });
      }
    }
    return r;
  };

  snap(`Start with ${n} singleton sets {0} … {${n - 1}}. Every node is its own parent.`, 'info', undefined);
  ops.forEach((op, i) => {
    opIndex = i;
    snap(`Operation ${i + 1}: ${opText(op)}.`, 'info', op.kind === 'union' ? 2 : 0);
    if (op.kind === 'find') {
      const r = find(op.a);
      answers.push(`find(${op.a}) = ${r}`);
      return;
    }
    const ra = find(op.a);
    const rb = find(op.b);
    if (op.kind === 'connected') {
      const same = ra === rb;
      answers.push(`connected(${op.a}, ${op.b}) = ${same}`);
      snap(`${op.a} and ${op.b} are ${same ? '' : 'not '}in the same set (roots ${ra}, ${rb}).`, same ? 'success' : 'warn', 3, {
        roots: [ra, rb],
      });
      return;
    }
    if (ra === rb) {
      answers.push(`union(${op.a}, ${op.b}) — already joined`);
      snap(`Both have root ${ra} — already in the same set, nothing to do.`, 'warn', 3, { roots: [ra] });
      return;
    }
    let big = ra;
    let small = rb;
    let why: string;
    if (strategy === 'rank') {
      if (rank[ra] < rank[rb]) [big, small] = [rb, ra];
      why = `rank[${ra}] = ${rank[ra]}, rank[${rb}] = ${rank[rb]}`;
    } else {
      if (size[ra] < size[rb]) [big, small] = [rb, ra];
      why = `size[${ra}] = ${size[ra]}, size[${rb}] = ${size[rb]}`;
    }
    snap(`Compare roots: ${why} → attach ${small} under ${big}.`, 'compare', 4, { roots: [big, small] });
    parent[small] = big;
    size[big] += size[small];
    const bump = rank[big] === rank[small];
    if (bump) rank[big]++;
    components--;
    answers.push(`union(${op.a}, ${op.b}) → root ${big}`);
    snap(
      `parent[${small}] = ${big}.${bump ? ` Ranks were equal, so rank[${big}] becomes ${rank[big]}.` : ''} Components: ${components}.`,
      'action',
      bump ? 5 : 6,
      { roots: [big], changed: [small] },
    );
  });
  opIndex = ops.length;
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    let r = i;
    while (parent[r] !== r) r = parent[r];
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(i);
  }
  const sets = [...groups.values()];
  snap(`All operations done. ${components} component${components === 1 ? '' : 's'}.`, 'done', undefined);
  return { steps, result: { parent: parent.slice(), components, sets, answers, pointerHops: hops } };
}

export function parseDsuOps(text: string, n: number): ParseResult<DsuOp[]> {
  const lines = text
    .split(/\n|;/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  if (!lines.length) return { ok: false, error: 'Add at least one operation, e.g. "union 1 2".' };
  if (lines.length > 40) return { ok: false, error: `Too many operations (${lines.length}). Maximum is 40.` };
  const ops: DsuOp[] = [];
  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].toLowerCase().split(/[\s,()]+/).filter(Boolean);
    const cmd = parts[0];
    const nums = parts.slice(1).map(Number);
    const bad = nums.find((v) => !Number.isInteger(v) || v < 0 || v >= n);
    if (bad !== undefined || nums.some((v) => Number.isNaN(v)))
      return { ok: false, error: `Line ${i + 1}: elements must be whole numbers from 0 to ${n - 1}.` };
    if (['union', 'u'].includes(cmd) && nums.length === 2) ops.push({ kind: 'union', a: nums[0], b: nums[1] });
    else if (['find', 'f'].includes(cmd) && nums.length === 1) ops.push({ kind: 'find', a: nums[0] });
    else if (['connected', 'c', 'same'].includes(cmd) && nums.length === 2) ops.push({ kind: 'connected', a: nums[0], b: nums[1] });
    else return { ok: false, error: `Line ${i + 1}: use "union a b", "find a" or "connected a b".` };
  }
  return { ok: true, value: ops };
}

export function randomDsuOps(n: number, seed?: number): string {
  const r = rng(seed);
  const count = Math.min(40, Math.max(4, Math.round(n * 1.2)));
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    const a = randInt(r, 0, n - 1);
    let b = randInt(r, 0, n - 1);
    if (b === a) b = (a + 1) % n;
    const p = r();
    if (p < 0.7) lines.push(`union ${a} ${b}`);
    else if (p < 0.85) lines.push(`find ${a}`);
    else lines.push(`connected ${a} ${b}`);
  }
  return lines.join('\n');
}

export const SAMPLE_DSU = `union 0 1
union 2 3
union 1 3
union 4 5
union 6 7
union 5 7
find 3
union 3 7
find 6
connected 0 6
connected 0 8`;
