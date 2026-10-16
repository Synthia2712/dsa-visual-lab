import { describe, expect, it } from 'vitest';
import { rbValidate, runRedBlackTree } from './redBlackTree';
import { edgeFlow, parseNetwork, randomNetwork, runMaxFlow, SAMPLE_NETWORK, type FlowNetwork } from './maxFlow';
import { runNQueens } from './nQueens';
import { parseEdges, randomGraph, runKruskal, SAMPLE_EDGES } from './kruskal';
import { randomBucketInput, runBucketSort } from './bucketSort';
import { parseNumberList, rng } from './types';

describe('Red-Black Tree (notes version)', () => {
  it('keeps every invariant after each completed insertion', () => {
    const r = rng(7);
    for (let trial = 0; trial < 60; trial++) {
      const keys = Array.from({ length: 1 + Math.floor(r() * 30) }, () => Math.floor(r() * 200) - 100);
      const { steps, result } = runRedBlackTree(keys);
      for (const s of steps) if (s.tag === 'success') expect(rbValidate(s.state)).toBeNull();
      expect(result.inorder).toEqual([...new Set(keys)].sort((a, b) => a - b));
    }
  });
  it('matches the Java demo (keys 10 5 15 12 3 7 18 1 6)', () => {
    const { result } = runRedBlackTree([10, 5, 15, 12, 3, 7, 18, 1, 6]);
    expect(result.inorder).toEqual([1, 3, 5, 6, 7, 10, 12, 15, 18]);
    expect(result.height).toBe(3); // heightEdges()
  });
  it('ignores duplicates; empty tree has height −1', () => {
    expect(runRedBlackTree([5, 5, 5]).result.duplicates).toEqual([5, 5]);
    expect(runRedBlackTree([]).result.height).toBe(-1);
  });
});

function checkFlow(net: FlowNetwork, residual: number[][], value: number) {
  const V = net.names.length;
  const bal = new Array(V).fill(0);
  for (let u = 0; u < V; u++)
    for (let v = 0; v < V; v++) {
      const f = edgeFlow(net, residual, u, v);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(net.cap[u][v]);
      bal[u] -= f;
      bal[v] += f;
    }
  bal.forEach((b, v) => expect(b).toBe(v === net.source ? -value : v === net.sink ? value : 0));
}

describe('Max flow (residual matrix, like the Java)', () => {
  it('gives 23 on the CLRS graph from main()', () => {
    const p = parseNetwork(SAMPLE_NETWORK, '0', '5');
    if (!p.ok) throw new Error(p.error);
    for (const m of ['dfs', 'bfs'] as const) {
      const { result } = runMaxFlow(p.value, m);
      expect(result.maxFlow).toBe(23);
      expect(result.cutCapacity).toBe(23);
      checkFlow(p.value, result.residual, 23);
    }
  });
  it('accepts the int[][] matrix form too', () => {
    const m = `{ 0, 16, 13, 0, 0, 0 }, { 0, 0, 10, 12, 0, 0 }, { 0, 4, 0, 0, 14, 0 },
{ 0, 0, 9, 0, 0, 20 }, { 0, 0, 0, 7, 0, 4 }, { 0, 0, 0, 0, 0, 0 }`;
    const rows = m.split('},').join('}\n');
    const p = parseNetwork(rows, '0', '5');
    expect(p.ok).toBe(true);
    if (p.ok) expect(runMaxFlow(p.value, 'bfs').result.maxFlow).toBe(23);
  });
  it('DFS and BFS agree and max-flow = min-cut on random networks', () => {
    for (let seed = 1; seed < 80; seed++) {
      const net = randomNetwork(seed);
      const a = runMaxFlow(net, 'dfs').result;
      const b = runMaxFlow(net, 'bfs').result;
      expect(a.maxFlow).toBe(b.maxFlow);
      expect(a.cutCapacity).toBe(a.maxFlow);
      checkFlow(net, a.residual, a.maxFlow);
      checkFlow(net, b.residual, b.maxFlow);
    }
  });
  it('Edmonds–Karp path lengths never decrease', () => {
    for (let seed = 1; seed < 30; seed++) {
      const lens = runMaxFlow(randomNetwork(seed), 'bfs').result.augmentations.map((a) => a.path.length);
      for (let i = 1; i < lens.length; i++) expect(lens[i]).toBeGreaterThanOrEqual(lens[i - 1]);
    }
  });
  it('returns 0 when the sink is unreachable, and validates input', () => {
    const p = parseNetwork('0 1 5\n3 2 3', '0', '3');
    if (!p.ok) throw new Error(p.error);
    expect(runMaxFlow(p.value, 'bfs').result.maxFlow).toBe(0);
    expect(parseNetwork('0 0 4', '0', '1').ok).toBe(false);
    expect(parseNetwork('0 1 4\n0 1 5', '0', '1').ok).toBe(false);
    expect(parseNetwork('0 1 x', '0', '1').ok).toBe(false);
    expect(parseNetwork('0 1 3', '0', '9').ok).toBe(false);
  });
});

describe('N-Queens', () => {
  it('counts all solutions correctly for n = 1..8', () => {
    [1, 0, 0, 2, 10, 4, 40, 92].forEach((c, i) => expect(runNQueens(i + 1, true).result.solutions.length).toBe(c));
  });
});

describe('Kruskal MST with DSU', () => {
  it('matches the Java demo: weight 16', () => {
    const p = parseEdges(SAMPLE_EDGES, 5);
    if (!p.ok) throw new Error(p.error);
    const { result } = runKruskal(5, p.value);
    expect(result.totalWeight).toBe(16);
    expect(result.mst.map((e) => [e.src, e.dest, e.weight])).toEqual([
      [0, 1, 2],
      [1, 2, 3],
      [1, 4, 5],
      [0, 3, 6],
    ]);
  });
  it('agrees with a brute-force MST weight on random graphs', () => {
    for (let seed = 1; seed < 40; seed++) {
      const g = randomGraph(seed);
      const p = parseEdges(g.text, g.vertices);
      if (!p.ok) throw new Error(p.error);
      const { result } = runKruskal(g.vertices, p.value);
      // Prim's algorithm as an independent check
      const V = g.vertices;
      const inT = new Array(V).fill(false);
      const best = new Array(V).fill(Infinity);
      best[0] = 0;
      let total = 0;
      for (let k = 0; k < V; k++) {
        let u = -1;
        for (let v = 0; v < V; v++) if (!inT[v] && (u < 0 || best[v] < best[u])) u = v;
        inT[u] = true;
        total += best[u];
        for (const e of p.value) {
          const w = e.src === u ? e.dest : e.dest === u ? e.src : -1;
          if (w >= 0 && !inT[w]) best[w] = Math.min(best[w], e.weight);
        }
      }
      expect(result.totalWeight).toBe(total);
      expect(result.mst.length).toBe(V - 1);
    }
  });
  it('handles disconnected graphs and rejects bad edges', () => {
    const p = parseEdges('0 1 4\n2 3 1', 4);
    if (!p.ok) throw new Error(p.error);
    expect(runKruskal(4, p.value).result.components).toBe(2);
    expect(parseEdges('0 0 1', 3).ok).toBe(false);
    expect(parseEdges('0 5 1', 3).ok).toBe(false);
    expect(parseEdges('0 1 2\n1 0 3', 3).ok).toBe(false);
  });
});

describe('Bucket Sort', () => {
  it('reproduces the notes example step by step', () => {
    const { result } = runBucketSort([0.42, 0.37, 0.33, 0.32, 0.14, 0.12, 0.56, 0.24, 0.29, 0.91], 10, 'notes');
    expect(result.distributed).toEqual([[], [0.14, 0.12], [0.24, 0.29], [0.37, 0.33, 0.32], [0.42], [0.56], [], [], [], [0.91]]);
    expect(result.sortedBuckets[3]).toEqual([0.32, 0.33, 0.37]);
    expect(result.sorted).toEqual([0.12, 0.14, 0.24, 0.29, 0.32, 0.33, 0.37, 0.42, 0.56, 0.91]);
  });
  it('sorts random inputs in both modes', () => {
    for (let s = 1; s < 20; s++) {
      const a = randomBucketInput('notes', s);
      expect(runBucketSort(a, 10, 'notes').result.sorted).toEqual([...a].sort((x, y) => x - y));
      const b = randomBucketInput('range', s);
      for (const k of [1, 3, 7]) expect(runBucketSort(b, k, 'range').result.sorted).toEqual([...b].sort((x, y) => x - y));
    }
  });
  it('validates number lists', () => {
    expect(parseNumberList('1, 2, x').ok).toBe(false);
    expect(parseNumberList('').ok).toBe(false);
  });
});
