import { EK_JAVA, FF_JAVA, lineOf } from './javaSource';
import type { ParseResult, Step, Trace } from './types';
import { randInt, rng } from './types';

/**
 * Max-flow engines that mirror FordFulkersonDFS and EdmondsKarpBFS from the notes:
 * an adjacency-matrix residualGraph[u][v], neighbours scanned v = 0 … V−1,
 * parent[] to rebuild the path, bottleneck = min residual, then
 * residualGraph[u][v] −= f and residualGraph[v][u] += f.
 */

export interface FlowEdge {
  from: number;
  to: number;
  cap: number;
}

export interface FlowNetwork {
  names: string[];
  /** graph[u][v] capacity matrix, exactly like the Java input. */
  cap: number[][];
  /** Edges with cap > 0, in row-major order (for drawing). */
  edges: FlowEdge[];
  source: number;
  sink: number;
}

export interface FlowState {
  residual: number[][];
  visited: number[];
  current: number | null;
  /** Cell residualGraph[u][v] being examined, and whether the edge is usable. */
  check: { u: number; v: number; ok: boolean } | null;
  parent: number[];
  /** Node sequence source → sink of the augmenting path (once found). */
  path: number[];
  /** Path edge currently used for the bottleneck / update loop. */
  pathEdge: { u: number; v: number } | null;
  /** DFS recursion stack, or the BFS queue. */
  frontier: number[];
  maxFlow: number;
  iteration: number;
  pathFlow: number | null;
  minCut: number[] | null;
}

export interface FlowResult {
  maxFlow: number;
  augmentations: { path: number[]; flow: number }[];
  minCut: number[];
  cutCapacity: number;
  residual: number[][];
}

export type FlowMethod = 'dfs' | 'bfs';

export const FF_CODE = FF_JAVA;
export const EK_CODE = EK_JAVA;

const lines = (method: FlowMethod) => {
  const J = method === 'dfs' ? FF_JAVA : EK_JAVA;
  return {
    init: lineOf(J, 'residualGraph[u][v] = graph[u][v];'),
    check: lineOf(J, 'if (!visited[v] && residualGraph[u][v] > 0)'),
    take: lineOf(J, 'parent[v] = u;'),
    noPath: lineOf(J, 'return false;'),
    min: lineOf(J, 'pathFlow = Math.min'),
    update: lineOf(J, 'residualGraph[u][v] -= pathFlow;'),
    add: lineOf(J, 'maxFlow += pathFlow;'),
    ret: lineOf(J, 'return maxFlow;'),
    // DFS-only
    newIter: method === 'dfs' ? lineOf(J, 'boolean[] visited = new boolean[V];') : -1,
    visit: method === 'dfs' ? lineOf(J, 'visited[u] = true;') : -1,
    atSink: method === 'dfs' ? lineOf(J, 'if (u == sink)') : -1,
    brk: method === 'dfs' ? lineOf(J, 'break;') : -1,
    // BFS-only
    bfsInit: method === 'bfs' ? lineOf(J, 'queue.add(source);') : -1,
    poll: method === 'bfs' ? lineOf(J, 'int u = queue.poll();') : -1,
    sinkHit: method === 'bfs' ? lineOf(J, 'if (v == sink)') : -1,
    loop: method === 'bfs' ? lineOf(J, 'while (bfs(') : -1,
  };
};

/** Net flow shown on an original edge u→v: cap − residual, clamped to [0, cap]. */
export function edgeFlow(net: FlowNetwork, residual: number[][], u: number, v: number): number {
  const c = net.cap[u][v];
  return Math.max(0, Math.min(c, c - residual[u][v]));
}

const DETAIL_LIMIT = 4000;
const HARD_LIMIT = 9000;

export function runMaxFlow(net: FlowNetwork, method: FlowMethod): Trace<FlowState, FlowResult> {
  const V = net.names.length;
  const { source, sink } = net;
  const L = lines(method);
  const name = (v: number) => net.names[v];
  const residual = net.cap.map((r) => r.slice());
  const parent = new Array<number>(V).fill(-1);
  const steps: Step<FlowState>[] = [];
  let truncated = false;
  let maxFlow = 0;
  let iteration = 0;
  let visited = new Array<boolean>(V).fill(false);
  let current: number | null = null;
  let frontier: number[] = [];

  // Only cells that can ever carry residual capacity are worth a visible "check" step;
  // the Java loop also tests the other v's, but those are always 0.
  const related = (u: number, v: number) => net.cap[u][v] > 0 || net.cap[v][u] > 0;

  const snap = (message: string, tag: Step<FlowState>['tag'], line: number, extra: Partial<FlowState> = {}, force: boolean | 'final' = false) => {
    if ((!force && steps.length >= DETAIL_LIMIT) || (force === true && steps.length >= HARD_LIMIT)) {
      truncated = true;
      return;
    }
    steps.push({
      state: {
        residual: residual.map((r) => r.slice()),
        visited: visited.flatMap((b, i) => (b ? [i] : [])),
        current,
        check: null,
        parent: parent.slice(),
        path: [],
        pathEdge: null,
        frontier: frontier.slice(),
        maxFlow,
        iteration,
        pathFlow: null,
        minCut: null,
        ...extra,
      },
      message,
      tag,
      line,
    });
  };

  // ---- DFS exactly as FordFulkersonDFS.dfs ----
  const dfs = (u: number): boolean => {
    visited[u] = true;
    current = u;
    frontier.push(u);
    snap(`dfs(${name(u)}): visited[${name(u)}] = true.`, 'info', L.visit);
    if (u === sink) {
      snap(`u == sink (${name(u)}) → return true. Augmenting path found.`, 'success', L.atSink);
      return true;
    }
    for (let v = 0; v < V; v++) {
      if (!related(u, v)) continue;
      const r = residual[u][v];
      const ok = !visited[v] && r > 0;
      current = u;
      snap(
        visited[v]
          ? `v = ${name(v)}: visited[${name(v)}] is true → skip.`
          : r > 0
            ? `v = ${name(v)}: residualGraph[${name(u)}][${name(v)}] = ${r} > 0 and not visited → usable.`
            : `v = ${name(v)}: residualGraph[${name(u)}][${name(v)}] = 0 → skip.`,
        ok ? 'action' : 'compare',
        L.check,
        { check: { u, v, ok } },
      );
      if (ok) {
        parent[v] = u;
        snap(`parent[${name(v)}] = ${name(u)}; recurse dfs(${name(v)}).`, 'action', L.take, { check: { u, v, ok: true } });
        if (dfs(v)) return true;
        frontier.pop();
        current = u;
        snap(`dfs(${name(v)}) returned false → back in dfs(${name(u)}), try the next v.`, 'warn', L.check);
      }
    }
    snap(`dfs(${name(u)}): no usable edge left → return false.`, 'warn', L.noPath);
    return false;
  };

  // ---- BFS exactly as EdmondsKarpBFS.bfs ----
  const bfs = (): boolean => {
    visited = new Array<boolean>(V).fill(false);
    frontier = [source];
    visited[source] = true;
    parent.fill(-1);
    current = null;
    snap(`bfs(): queue = [${name(source)}], visited[${name(source)}] = true, parent[] = −1.`, 'info', L.bfsInit);
    while (frontier.length) {
      const u = frontier.shift()!;
      current = u;
      snap(`u = queue.poll() → ${name(u)}.`, 'info', L.poll);
      for (let v = 0; v < V; v++) {
        if (!related(u, v)) continue;
        const r = residual[u][v];
        const ok = !visited[v] && r > 0;
        snap(
          visited[v]
            ? `v = ${name(v)}: already visited → skip.`
            : r > 0
              ? `v = ${name(v)}: residualGraph[${name(u)}][${name(v)}] = ${r} > 0 and not visited.`
              : `v = ${name(v)}: residualGraph[${name(u)}][${name(v)}] = 0 → skip.`,
          ok ? 'action' : 'compare',
          L.check,
          { check: { u, v, ok } },
        );
        if (ok) {
          parent[v] = u;
          visited[v] = true;
          frontier.push(v);
          snap(`parent[${name(v)}] = ${name(u)}, visited[${name(v)}] = true, queue.add(${name(v)}).`, 'action', L.take, { check: { u, v, ok: true } });
          if (v === sink) {
            snap(`v == sink (${name(v)}) → return true. Shortest augmenting path found.`, 'success', L.sinkHit, { check: { u, v, ok: true } });
            return true;
          }
        }
      }
    }
    snap(`Queue is empty and the sink was never reached → return false.`, 'warn', L.noPath);
    return false;
  };

  snap(
    `residualGraph = copy of graph (initial residual = capacity). Source ${name(source)}, sink ${name(sink)}, maxFlow = 0.`,
    'info',
    L.init,
    {},
    true,
  );

  const augmentations: FlowResult['augmentations'] = [];
  while (iteration < 100000) {
    iteration++;
    let found: boolean;
    if (method === 'dfs') {
      visited = new Array<boolean>(V).fill(false);
      parent.fill(-1);
      frontier = [];
      current = null;
      snap(`Iteration ${iteration}: visited = new boolean[V]; parent filled with −1; call dfs(${name(source)}).`, 'info', L.newIter);
      found = dfs(source);
    } else {
      found = bfs();
    }
    if (!found) break;

    // Rebuild the path from parent[] (sink → source), as the Java loops do.
    const path: number[] = [];
    for (let v = sink; v !== source; v = parent[v]) path.unshift(v);
    path.unshift(source);
    current = sink;
    let pathFlow = Infinity;
    for (let v = sink; v !== source; v = parent[v]) {
      const u = parent[v];
      pathFlow = Math.min(pathFlow, residual[u][v]);
      snap(
        `pathFlow = min(pathFlow, residualGraph[${name(u)}][${name(v)}] = ${residual[u][v]}) → ${pathFlow}.`,
        'compare',
        L.min,
        { path, pathEdge: { u, v }, pathFlow },
      );
    }
    for (let v = sink; v !== source; v = parent[v]) {
      const u = parent[v];
      residual[u][v] -= pathFlow;
      residual[v][u] += pathFlow;
      snap(
        `residualGraph[${name(u)}][${name(v)}] −= ${pathFlow} → ${residual[u][v]};  residualGraph[${name(v)}][${name(u)}] += ${pathFlow} → ${residual[v][u]}.`,
        'action',
        L.update,
        { path, pathEdge: { u, v }, pathFlow },
      );
    }
    maxFlow += pathFlow;
    augmentations.push({ path, flow: pathFlow });
    snap(
      `maxFlow += ${pathFlow} → ${maxFlow}.  (Java prints "Augmenting flow = ${pathFlow}")  Path: ${path.map(name).join(' → ')}.`,
      'success',
      L.add,
      { path, pathFlow },
      true,
    );
  }
  const minCut = visited.flatMap((b, i) => (b ? [i] : []));
  const cutSet = new Set(minCut);
  let cutCapacity = 0;
  for (let u = 0; u < V; u++) for (let v = 0; v < V; v++) if (cutSet.has(u) && !cutSet.has(v)) cutCapacity += net.cap[u][v];
  current = null;
  frontier = [];
  if (method === 'dfs') snap(`dfs found no augmenting path → break.`, 'warn', L.brk, {}, true);
  else snap(`bfs() returned false → the while loop ends.`, 'warn', L.loop, {}, true);
  snap(
    `return maxFlow = ${maxFlow}. Nodes still reachable from ${name(source)}: {${minCut.map(name).join(', ')}} — this min cut has capacity ${cutCapacity}.`,
    'done',
    L.ret,
    { minCut },
    'final',
  );
  return { steps, truncated, result: { maxFlow, augmentations, minCut, cutCapacity, residual: residual.map((r) => r.slice()) } };
}

// ---------- input helpers ----------

function fromMatrix(names: string[], cap: number[][], source: number, sink: number): FlowNetwork {
  const edges: FlowEdge[] = [];
  cap.forEach((row, u) => row.forEach((c, v) => c > 0 && edges.push({ from: u, to: v, cap: c })));
  return { names, cap, edges, source, sink };
}

/**
 * Accepts either an edge list ("FROM TO CAPACITY" per line) or a square capacity matrix
 * (rows of numbers, exactly like int[][] graph in Java). With numeric node names, node i is
 * row i of the matrix, so the v = 0 … V−1 scan order matches the Java program.
 */
export function parseNetwork(text: string, sourceName: string, sinkName: string): ParseResult<FlowNetwork> {
  const rows = text
    .split('\n')
    .map((l) => l.replace(/[{},]/g, ' ').trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('//'));
  if (!rows.length) return { ok: false, error: 'Add at least one edge ("0 1 16") or a capacity matrix.' };

  const tokens = rows.map((r) => r.split(/\s+|->|→/).filter(Boolean));
  const allInts = tokens.every((t) => t.every((x) => /^\d+$/.test(x)));
  const isMatrix = allInts && tokens.length >= 2 && tokens.every((t) => t.length === tokens.length);

  let names: string[];
  let cap: number[][];
  if (isMatrix) {
    const V = tokens.length;
    if (V > 12) return { ok: false, error: `Matrix is ${V}×${V}. Maximum is 12×12.` };
    names = Array.from({ length: V }, (_, i) => String(i));
    cap = tokens.map((t) => t.map(Number));
    for (let u = 0; u < V; u++) {
      if (cap[u][u] !== 0) return { ok: false, error: `graph[${u}][${u}] must be 0 (no self-loops).` };
      for (let v = 0; v < V; v++) if (cap[u][v] > 999) return { ok: false, error: `graph[${u}][${v}] = ${cap[u][v]} is too large (max 999).` };
    }
  } else {
    if (rows.length > 40) return { ok: false, error: `Too many edges (${rows.length}). Maximum is 40.` };
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.length !== 3) return { ok: false, error: `Line ${i + 1}: expected "FROM TO CAPACITY" (or a full square matrix), got "${rows[i]}".` };
      if (!/^[A-Za-z0-9_]{1,4}$/.test(t[0]) || !/^[A-Za-z0-9_]{1,4}$/.test(t[1]))
        return { ok: false, error: `Line ${i + 1}: node names must be 1–4 letters/digits.` };
      const c = Number(t[2]);
      if (!Number.isInteger(c) || c < 1 || c > 999) return { ok: false, error: `Line ${i + 1}: capacity "${t[2]}" must be a whole number from 1 to 999.` };
      if (t[0].toUpperCase() === t[1].toUpperCase()) return { ok: false, error: `Line ${i + 1}: self-loops (${t[0]}→${t[0]}) are not allowed.` };
    }
    const numeric = tokens.every((t) => /^\d+$/.test(t[0]) && /^\d+$/.test(t[1]));
    if (numeric) {
      const V = Math.max(...tokens.flatMap((t) => [Number(t[0]), Number(t[1])])) + 1;
      if (V > 12) return { ok: false, error: `Node ${V - 1} is too large: numeric nodes must be 0–11.` };
      names = Array.from({ length: V }, (_, i) => String(i));
    } else {
      names = [];
      for (const t of tokens) for (const x of [t[0], t[1]]) if (!names.includes(x.toUpperCase())) names.push(x.toUpperCase());
      if (names.length > 12) return { ok: false, error: `Too many nodes (${names.length}). Maximum is 12.` };
    }
    const idx = (x: string) => (numeric ? Number(x) : names.indexOf(x.toUpperCase()));
    cap = names.map(() => names.map(() => 0));
    for (let i = 0; i < tokens.length; i++) {
      const [a, b, c] = tokens[i];
      if (cap[idx(a)][idx(b)] > 0) return { ok: false, error: `Line ${i + 1}: edge ${a}→${b} is listed twice.` };
      cap[idx(a)][idx(b)] = Number(c);
    }
  }
  const s = names.indexOf(sourceName.trim().toUpperCase());
  const t = names.indexOf(sinkName.trim().toUpperCase());
  if (s < 0) return { ok: false, error: `Source "${sourceName}" is not a node in this graph.` };
  if (t < 0) return { ok: false, error: `Sink "${sinkName}" is not a node in this graph.` };
  if (s === t) return { ok: false, error: 'Source and sink must be different nodes.' };
  return { ok: true, value: fromMatrix(names, cap, s, t) };
}

export function networkToText(net: FlowNetwork): string {
  return net.edges.map((e) => `${net.names[e.from]} ${net.names[e.to]} ${e.cap}`).join('\n');
}

/** The int[][] graph from main() in both Java programs (CLRS example, max flow 23). */
export const SAMPLE_NETWORK = `0 1 16
0 2 13
1 2 10
1 3 12
2 1 4
2 4 14
3 2 9
3 5 20
4 3 7
4 5 4`;

/** Random layered network with numeric nodes 0 … V−1 (0 = source, V−1 = sink). */
export function randomNetwork(seed?: number): FlowNetwork {
  const r = rng(seed);
  const layers = randInt(r, 2, 3);
  const layerNodes: number[][] = [[0]];
  let next = 1;
  for (let l = 0; l < layers; l++) {
    const count = randInt(r, 2, 3);
    layerNodes.push(Array.from({ length: count }, () => next++));
  }
  const V = next + 1;
  layerNodes.push([V - 1]);
  const cap = Array.from({ length: V }, () => new Array<number>(V).fill(0));
  const c = () => randInt(r, 2, 20);
  for (let l = 0; l + 1 < layerNodes.length; l++) {
    const nextL = layerNodes[l + 1];
    for (const u of layerNodes[l]) {
      cap[u][nextL[randInt(r, 0, nextL.length - 1)]] ||= c();
      for (const w of nextL) if (r() < 0.45) cap[u][w] ||= c();
    }
    for (const v of nextL) if (!layerNodes[l].some((u) => cap[u][v] > 0)) cap[layerNodes[l][randInt(r, 0, layerNodes[l].length - 1)]][v] = c();
    if (nextL.length > 1 && l + 1 < layerNodes.length - 1 && r() < 0.6) {
      const [a, b] = nextL;
      if (!cap[a][b] && !cap[b][a]) {
        cap[a][b] = c();
        if (r() < 0.5) cap[b][a] = c(); // antiparallel pair, like 1↔2 in the CLRS graph
      }
    }
  }
  return fromMatrix(
    Array.from({ length: V }, (_, i) => String(i)),
    cap,
    0,
    V - 1,
  );
}

/** Column layout by BFS distance from the source. */
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
