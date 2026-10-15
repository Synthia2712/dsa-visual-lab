import { describe, expect, it } from 'vitest';
import { rbValidate, runRedBlackTree } from './redBlackTree';
import { parseNetwork, randomNetwork, runMaxFlow, SAMPLE_NETWORK, type FlowNetwork } from './maxFlow';
import { runNQueens } from './nQueens';
import { parseDsuOps, randomDsuOps, runDsu } from './dsu';
import { randomBucketInput, runBucketSort } from './bucketSort';
import { parseNumberList, rng } from './types';

describe('Red-Black Tree', () => {
  it('keeps every invariant after each completed insertion', () => {
    const r = rng(7);
    for (let trial = 0; trial < 60; trial++) {
      const keys = Array.from({ length: 1 + Math.floor(r() * 30) }, () => Math.floor(r() * 200) - 100);
      const { steps, result } = runRedBlackTree(keys);
      for (const s of steps) if (s.tag === 'success') expect(rbValidate(s.state)).toBeNull();
      expect(rbValidate(steps[steps.length - 1].state)).toBeNull();
      expect(result.inorder).toEqual([...new Set(keys)].sort((a, b) => a - b));
    }
  });
  it('handles sorted input (worst case for plain BST) with logarithmic height', () => {
    const keys = Array.from({ length: 31 }, (_, i) => i);
    const { result } = runRedBlackTree(keys);
    expect(result.height).toBeLessThanOrEqual(2 * Math.log2(32));
    expect(result.rotations).toBeGreaterThan(0);
  });
  it('ignores duplicates and handles empty input', () => {
    expect(runRedBlackTree([5, 5, 5]).result.duplicates).toEqual([5, 5]);
    expect(runRedBlackTree([]).result.size).toBe(0);
  });
});

function checkFlow(net: FlowNetwork, flows: number[], value: number) {
  flows.forEach((f, i) => {
    expect(f).toBeGreaterThanOrEqual(0);
    expect(f).toBeLessThanOrEqual(net.edges[i].cap);
  });
  const bal = new Array(net.names.length).fill(0);
  net.edges.forEach((e, i) => {
    bal[e.from] -= flows[i];
    bal[e.to] += flows[i];
  });
  bal.forEach((b, v) => {
    if (v === net.source) expect(b).toBe(-value);
    else if (v === net.sink) expect(b).toBe(value);
    else expect(b).toBe(0);
  });
}

describe('Max flow', () => {
  it('computes the known value on the sample network (19) with both methods', () => {
    const p = parseNetwork(SAMPLE_NETWORK, 'S', 'T');
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    for (const m of ['dfs', 'bfs'] as const) {
      const { result } = runMaxFlow(p.value, m);
      expect(result.maxFlow).toBe(19);
      expect(result.cutCapacity).toBe(19);
      checkFlow(p.value, result.flows, 19);
    }
  });
  it('agrees between DFS and BFS and satisfies max-flow = min-cut on random networks', () => {
    for (let seed = 1; seed < 80; seed++) {
      const net = randomNetwork(seed);
      const a = runMaxFlow(net, 'dfs').result;
      const b = runMaxFlow(net, 'bfs').result;
      expect(a.maxFlow).toBe(b.maxFlow);
      expect(a.cutCapacity).toBe(a.maxFlow);
      expect(b.cutCapacity).toBe(b.maxFlow);
      checkFlow(net, a.flows, a.maxFlow);
      checkFlow(net, b.flows, b.maxFlow);
    }
  });
  it('uses backward residual edges when needed', () => {
    // Classic case: DFS first takes S-A-B-T, then must cancel A→B via the backward edge.
    const p = parseNetwork('S A 1\nS B 1\nA B 1\nA T 1\nB T 1', 'S', 'T');
    if (!p.ok) throw new Error(p.error);
    const { result } = runMaxFlow(p.value, 'dfs');
    expect(result.maxFlow).toBe(2);
  });
  it('Edmonds–Karp augments along shortest paths (non-decreasing length)', () => {
    for (let seed = 1; seed < 30; seed++) {
      const { result } = runMaxFlow(randomNetwork(seed), 'bfs');
      const lens = result.augmentations.map((a) => a.path.length);
      for (let i = 1; i < lens.length; i++) expect(lens[i]).toBeGreaterThanOrEqual(lens[i - 1]);
    }
  });
  it('returns 0 when the sink is unreachable', () => {
    const p = parseNetwork('S A 5\nT B 3', 'S', 'T');
    if (!p.ok) throw new Error(p.error);
    expect(runMaxFlow(p.value, 'bfs').result.maxFlow).toBe(0);
  });
  it('validates input', () => {
    expect(parseNetwork('S S 4', 'S', 'T').ok).toBe(false);
    expect(parseNetwork('S A 0', 'S', 'A').ok).toBe(false);
    expect(parseNetwork('S A x', 'S', 'A').ok).toBe(false);
    expect(parseNetwork('S A 3', 'S', 'Z').ok).toBe(false);
    expect(parseNetwork('', 'S', 'T').ok).toBe(false);
  });
});

describe('N-Queens', () => {
  const known = [1, 0, 0, 2, 10, 4, 40, 92];
  it('counts all solutions correctly for n = 1..8', () => {
    known.forEach((count, i) => expect(runNQueens(i + 1, true).result.solutions.length).toBe(count));
  });
  it('finds a valid first solution up to n = 12', () => {
    for (let n = 4; n <= 12; n++) {
      const sol = runNQueens(n, false).result.solutions[0];
      for (let a = 0; a < n; a++)
        for (let b = a + 1; b < n; b++) {
          expect(sol[a]).not.toBe(sol[b]);
          expect(Math.abs(sol[a] - sol[b])).not.toBe(b - a);
        }
    }
  });
});

describe('Disjoint Set Union', () => {
  it('matches a naive connectivity model for every strategy', () => {
    for (let seed = 1; seed < 40; seed++) {
      const n = 4 + (seed % 12);
      const parsed = parseDsuOps(randomDsuOps(n, seed), n);
      if (!parsed.ok) throw new Error(parsed.error);
      const label = Array.from({ length: n }, (_, i) => i);
      for (const op of parsed.value)
        if (op.kind === 'union') {
          const from = label[op.b];
          const to = label[op.a];
          for (let i = 0; i < n; i++) if (label[i] === from) label[i] = to;
        }
      const expected = new Set(label).size;
      for (const strat of ['rank', 'size'] as const)
        for (const comp of [true, false]) {
          const { result } = runDsu(n, parsed.value, strat, comp);
          expect(result.components).toBe(expected);
          expect(result.sets.flat().sort((a, b) => a - b)).toEqual(label.map((_, i) => i));
        }
    }
  });
  it('rejects out-of-range elements and bad commands', () => {
    expect(parseDsuOps('union 1 9', 5).ok).toBe(false);
    expect(parseDsuOps('merge 1 2', 5).ok).toBe(false);
    expect(parseDsuOps('find 1.5', 5).ok).toBe(false);
  });
});

describe('Bucket Sort', () => {
  it('sorts random, negative, decimal and duplicate-heavy inputs', () => {
    const cases = [
      randomBucketInput(1),
      randomBucketInput(2),
      [-5, 3.2, -1.1, 0, 0, 9, -5],
      [4, 4, 4, 4],
      [42],
      [1e6, -1e6, 0],
    ];
    for (const c of cases)
      for (const k of [1, 3, 5, 10]) {
        const { result } = runBucketSort(c, k);
        expect(result.sorted).toEqual([...c].sort((a, b) => a - b));
        expect(result.bucketSizes.reduce((a, b) => a + b, 0)).toBe(c.length);
      }
  });
  it('validates number lists', () => {
    expect(parseNumberList('1, 2, x').ok).toBe(false);
    expect(parseNumberList('').ok).toBe(false);
    expect(parseNumberList('1 2 3').ok).toBe(true);
  });
});
