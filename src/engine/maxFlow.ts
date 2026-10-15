import type { ParseResult, Step, Trace } from './types';
import { randInt, rng } from './types';

/**
 * Max-flow engines (Ford–Fulkerson with DFS, Edmonds–Karp with BFS).
 *
 * Residual network: original edge i has two residual edges.
 *   rid = 2i     forward  from→to, residual = cap − flow
 *   rid = 2i + 1 backward to→from, residual = flow
 * Only `flows` changes over time; every residual capacity is derived from it.
 */

export interface FlowEdge {
  from: number;
  to: number;
  cap: number;
}

export interface FlowNetwork {
  names: string[];
  edges: FlowEdge[];
  source: number;
  sink: number;
}

export interface FlowState {
  flows: number[];
  visited: number[];
  current: number | null;
  /** Residual edge under inspection. */
  active: number | null;
  activeOk: boolean;
  /** Residual edges forming the current DFS path / discovered BFS tree / augmenting path. */
  tree: number[];
  /** Residual edges of the augmenting path being applied (empty while searching). */
  path: number[];
  /** DFS stack or BFS queue (node ids). */
  frontier: number[];
  maxFlow: number;
  iteration: number;
  bottleneck: number | null;
  minCut: number[] | null;
}

export interface FlowResult {
  maxFlow: number;
  augmentations: { path: number[]; bottleneck: number }[];
  minCut: number[];
  cutCapacity: number;
  flows: number[];
}

export type FlowMethod = 'dfs' | 'bfs';

export const FF_PSEUDOCODE = [
  'flow = 0 on every edge',
  'while DFS finds a path s → t in the residual graph:',
  '  explore residual edge (u,v) only if residual > 0 and v unvisited',
  '  dead end → backtrack',
  '  bottleneck = min residual along the path',
  '  push bottleneck: forward edges +b, backward edges −b',
  'no path left → flow is maximum (visited set = min cut)',
];

export const EK_PSEUDOCODE = [
  'flow = 0 on every edge',
  'while BFS finds a shortest path s → t in the residual graph:',
  '  dequeue u; for each residual edge (u,v) with residual > 0',
  '    if v unvisited: mark, record parent, enqueue v',
  '  bottleneck = min residual along the parent chain',
  '  push bottleneck: forward edges +b, backward edges −b',
  'no path left → flow is maximum (visited set = min cut)',
];

export const residualOf = (net: FlowNetwork, flows: number[], rid: number): number =>
  rid & 1 ? flows[rid >> 1] : net.edges[rid >> 1].cap - flows[rid >> 1];
export const residualFrom = (net: FlowNetwork, rid: number): number =>
  rid & 1 ? net.edges[rid >> 1].to : net.edges[rid >> 1].from;
export const residualTo = (net: FlowNetwork, rid: number): number =>
  rid & 1 ? net.edges[rid >> 1].from : net.edges[rid >> 1].to;

const DETAIL_LIMIT = 3500;
const HARD_LIMIT = 8000;

export function runMaxFlow(net: FlowNetwork, method: FlowMethod): Trace<FlowState, FlowResult> {
  const n = net.names.length;
  const { source: s, sink: t } = net;
  const adj: number[][] = Array.from({ length: n }, () => []);
  net.edges.forEach((e, i) => {
    adj[e.from].push(2 * i);
    adj[e.to].push(2 * i + 1);
  });
  const flows = net.edges.map(() => 0);
  const steps: Step<FlowState>[] = [];
  let truncated = false;
  let maxFlow = 0;
  let iteration = 0;
  const name = (v: number) => net.names[v];
  const res = (rid: number) => residualOf(net, flows, rid);
  const edgeTxt = (rid: number) => `${name(residualFrom(net, rid))}→${name(residualTo(net, rid))}${rid & 1 ? ' (backward)' : ''}`;

  let visited = new Set<number>();
  let current: number | null = null;
  let tree: number[] = [];
  let frontier: number[] = [];

  const snap = (
    message: string,
    tag: Step<FlowState>['tag'],
    line: number,
    extra: Partial<FlowState> = {},
    force: boolean | 'final' = false,
  ) => {
    if ((!force && steps.length >= DETAIL_LIMIT) || (force === true && steps.length >= HARD_LIMIT)) {
      truncated = true;
      return;
    }
    steps.push({
      state: {
        flows: flows.slice(),
        visited: [...visited],
        current,
        active: null,
        activeOk: false,
        tree: tree.slice(),
        path: [],
        frontier: frontier.slice(),
        maxFlow,
        iteration,
        bottleneck: null,
        minCut: null,
        ...extra,
      },
      message,
      tag,
      line,
    });
  };

  const dfs = (): number[] | null => {
    visited = new Set([s]);
    tree = [];
    frontier = [s];
    current = s;
    snap(`Iteration ${iteration}: start DFS from ${name(s)}.`, 'info', 1);
    const visit = (u: number): boolean => {
      current = u;
      if (u === t) return true;
      for (const rid of adj[u]) {
        const v = residualTo(net, rid);
        const r = res(rid);
        if (r <= 0) {
          snap(`Edge ${edgeTxt(rid)} has residual 0 — skip.`, 'compare', 2, { active: rid, activeOk: false });
          continue;
        }
        if (visited.has(v)) {
          snap(`${name(v)} already visited — skip ${edgeTxt(rid)}.`, 'compare', 2, { active: rid, activeOk: false });
          continue;
        }
        visited.add(v);
        tree.push(rid);
        frontier.push(v);
        current = v;
        snap(
          `Go ${edgeTxt(rid)} (residual ${r})${rid & 1 ? ' — this would cancel existing flow' : ''}.`,
          'action',
          2,
          { active: rid, activeOk: true },
        );
        if (visit(v)) return true;
        tree.pop();
        frontier.pop();
        current = u;
        snap(`Dead end at ${name(v)} — backtrack to ${name(u)}.`, 'warn', 3);
      }
      return false;
    };
    return visit(s) ? tree.slice() : null;
  };

  const bfs = (): number[] | null => {
    visited = new Set([s]);
    tree = [];
    frontier = [s];
    current = null;
    const parentEdge = new Array<number>(n).fill(-1);
    snap(`Iteration ${iteration}: start BFS — queue = [${name(s)}].`, 'info', 1);
    while (frontier.length) {
      const u = frontier.shift()!;
      current = u;
      snap(`Dequeue ${name(u)} (distance ${distanceOf(u)}).`, 'info', 2);
      for (const rid of adj[u]) {
        const v = residualTo(net, rid);
        const r = res(rid);
        if (r <= 0) {
          snap(`Edge ${edgeTxt(rid)} has residual 0 — skip.`, 'compare', 2, { active: rid, activeOk: false });
          continue;
        }
        if (visited.has(v)) {
          snap(`${name(v)} already visited — skip ${edgeTxt(rid)}.`, 'compare', 2, { active: rid, activeOk: false });
          continue;
        }
        visited.add(v);
        parentEdge[v] = rid;
        tree.push(rid);
        frontier.push(v);
        snap(`Discover ${name(v)} via ${edgeTxt(rid)} (residual ${r}); enqueue.`, 'action', 3, { active: rid, activeOk: true });
        if (v === t) {
          const path: number[] = [];
          let x = t;
          while (x !== s) {
            path.unshift(parentEdge[x]);
            x = residualFrom(net, parentEdge[x]);
          }
          return path;
        }
      }
    }
    return null;

    function distanceOf(u: number): number {
      let d = 0;
      let x = u;
      while (x !== s && parentEdge[x] >= 0) {
        x = residualFrom(net, parentEdge[x]);
        d++;
      }
      return d;
    }
  };

  snap(
    `Source ${name(s)}, sink ${name(t)}. All flows start at 0, so the residual graph equals the capacity graph.`,
    'info',
    0,
    {},
    true,
  );
  const augmentations: FlowResult['augmentations'] = [];
  // Integer capacities guarantee termination; the guard protects against pathological inputs.
  while (iteration < 100000) {
    iteration++;
    const path = method === 'dfs' ? dfs() : bfs();
    if (!path) break;
    const b = Math.min(...path.map(res));
    const nodesTxt = [s, ...path.map((rid) => residualTo(net, rid))].map(name).join(' → ');
    current = t;
    snap(`Augmenting path ${nodesTxt}, bottleneck = ${b}.`, 'success', 4, { path, bottleneck: b }, true);
    for (const rid of path) flows[rid >> 1] += rid & 1 ? -b : b;
    maxFlow += b;
    augmentations.push({ path, bottleneck: b });
    snap(`Push ${b} unit${b === 1 ? '' : 's'} along the path. Total flow = ${maxFlow}.`, 'action', 5, { path, bottleneck: b }, true);
  }
  const minCut = [...visited].sort((a, b) => a - b);
  const cutSet = new Set(minCut);
  const cutCapacity = net.edges.reduce((acc, e) => acc + (cutSet.has(e.from) && !cutSet.has(e.to) ? e.cap : 0), 0);
  current = null;
  tree = [];
  frontier = [];
  snap(
    `No augmenting path from ${name(s)} to ${name(t)}. Maximum flow = ${maxFlow}. Min cut {${minCut.map(name).join(', ')}} has capacity ${cutCapacity}.`,
    'done',
    6,
    { minCut },
    'final',
  );
  return { steps, truncated, result: { maxFlow, augmentations, minCut, cutCapacity, flows: flows.slice() } };
}

// ---------- input helpers ----------

export function parseNetwork(text: string, sourceName: string, sinkName: string): ParseResult<FlowNetwork> {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  if (!lines.length) return { ok: false, error: 'Add at least one edge, e.g. "S A 10".' };
  if (lines.length > 30) return { ok: false, error: `Too many edges (${lines.length}). Maximum is 30.` };
  const names: string[] = [];
  const idx = (nm: string) => {
    const key = nm.toUpperCase();
    let i = names.indexOf(key);
    if (i < 0) {
      names.push(key);
      i = names.length - 1;
    }
    return i;
  };
  const edges: FlowEdge[] = [];
  for (let li = 0; li < lines.length; li++) {
    const parts = lines[li].split(/[\s,]+|->|→/).filter(Boolean);
    if (parts.length !== 3) return { ok: false, error: `Line ${li + 1}: expected "FROM TO CAPACITY", got "${lines[li]}".` };
    const [a, b, c] = parts;
    if (!/^[A-Za-z0-9_]{1,4}$/.test(a) || !/^[A-Za-z0-9_]{1,4}$/.test(b))
      return { ok: false, error: `Line ${li + 1}: node names must be 1–4 letters/digits.` };
    const cap = Number(c);
    if (!Number.isInteger(cap) || cap < 1 || cap > 999)
      return { ok: false, error: `Line ${li + 1}: capacity "${c}" must be a whole number from 1 to 999.` };
    if (a.toUpperCase() === b.toUpperCase()) return { ok: false, error: `Line ${li + 1}: self-loops (${a}→${a}) are not allowed.` };
    edges.push({ from: idx(a), to: idx(b), cap });
  }
  if (names.length > 12) return { ok: false, error: `Too many nodes (${names.length}). Maximum is 12.` };
  const s = names.indexOf(sourceName.trim().toUpperCase());
  const t = names.indexOf(sinkName.trim().toUpperCase());
  if (s < 0) return { ok: false, error: `Source "${sourceName}" does not appear in any edge.` };
  if (t < 0) return { ok: false, error: `Sink "${sinkName}" does not appear in any edge.` };
  if (s === t) return { ok: false, error: 'Source and sink must be different nodes.' };
  return { ok: true, value: { names, edges, source: s, sink: t } };
}

export function networkToText(net: FlowNetwork): string {
  return net.edges.map((e) => `${net.names[e.from]} ${net.names[e.to]} ${e.cap}`).join('\n');
}

export const SAMPLE_NETWORK = `S A 10
S C 10
A B 4
A C 2
A D 8
C D 9
D B 6
B T 10
D T 10`;

/** Random layered DAG-ish network that always has at least one s→t path. */
export function randomNetwork(seed?: number): FlowNetwork {
  const r = rng(seed);
  const layers = randInt(r, 2, 3);
  const names = ['S'];
  const layerNodes: number[][] = [[0]];
  const letters = 'ABCDEFGHIJ';
  let li = 0;
  for (let l = 0; l < layers; l++) {
    const count = randInt(r, 2, 3);
    const ids: number[] = [];
    for (let k = 0; k < count; k++) {
      names.push(letters[li++]);
      ids.push(names.length - 1);
    }
    layerNodes.push(ids);
  }
  names.push('T');
  layerNodes.push([names.length - 1]);
  const edges: FlowEdge[] = [];
  const has = (a: number, b: number) => edges.some((e) => e.from === a && e.to === b);
  const cap = () => randInt(r, 2, 20);
  for (let l = 0; l + 1 < layerNodes.length; l++) {
    for (const u of layerNodes[l]) {
      // every node gets at least one edge forward
      const next = layerNodes[l + 1];
      const v = next[randInt(r, 0, next.length - 1)];
      if (!has(u, v)) edges.push({ from: u, to: v, cap: cap() });
      for (const w of next) if (r() < 0.45 && !has(u, w)) edges.push({ from: u, to: w, cap: cap() });
    }
    for (const v of layerNodes[l + 1]) {
      if (!edges.some((e) => e.to === v)) {
        const prev = layerNodes[l];
        edges.push({ from: prev[randInt(r, 0, prev.length - 1)], to: v, cap: cap() });
      }
    }
    // occasional edge within a layer to make residual/backward edges interesting
    const mid = layerNodes[l + 1];
    if (mid.length > 1 && l + 1 < layerNodes.length - 1 && r() < 0.6) {
      const a = mid[0];
      const b = mid[1];
      if (!has(a, b) && !has(b, a)) edges.push({ from: a, to: b, cap: cap() });
    }
  }
  return { names, edges: edges.slice(0, 30), source: 0, sink: names.length - 1 };
}

/** Column layout by BFS distance from the source (ignoring direction for unreachable nodes). */
export function layoutNetwork(net: FlowNetwork, width: number, height: number): { x: number; y: number }[] {
  const n = net.names.length;
  const level = new Array<number>(n).fill(-1);
  level[net.source] = 0;
  const q = [net.source];
  while (q.length) {
    const u = q.shift()!;
    for (const e of net.edges)
      if (e.from === u && level[e.to] < 0 && e.to !== net.sink) {
        level[e.to] = level[u] + 1;
        q.push(e.to);
      }
  }
  let maxL = Math.max(1, ...level);
  for (let i = 0; i < n; i++) if (level[i] < 0 && i !== net.sink) level[i] = Math.max(1, Math.ceil(maxL / 2));
  maxL = Math.max(1, ...level);
  level[net.sink] = maxL + 1;
  const cols = maxL + 1;
  const groups: number[][] = Array.from({ length: cols + 1 }, () => []);
  for (let i = 0; i < n; i++) groups[level[i]].push(i);
  const pos: { x: number; y: number }[] = new Array(n);
  const padX = 60;
  const padY = 50;
  groups.forEach((g, c) => {
    g.forEach((v, k) => {
      pos[v] = {
        x: padX + (c / cols) * (width - 2 * padX),
        y: g.length === 1 ? height / 2 : padY + (k / (g.length - 1)) * (height - 2 * padY),
      };
    });
  });
  return pos;
}
