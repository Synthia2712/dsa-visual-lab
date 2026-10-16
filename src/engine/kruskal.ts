import { KRUSKAL_JAVA, lineOf } from './javaSource';
import type { ParseResult, Step, Trace } from './types';
import { randInt, rng } from './types';

/** Mirrors KruskalMST + DSU from the notes (recursive find with path compression, union by rank). */

export interface KEdge {
  src: number;
  dest: number;
  weight: number;
  /** Position in the user's input (Collections.sort is stable, so ties keep this order). */
  id: number;
}

export type EdgeStatus = 'pending' | 'current' | 'mst' | 'cycle' | 'unused';

export interface KruskalState {
  parent: number[];
  rank: number[];
  /** Status of each edge, indexed by position in the SORTED list. */
  status: EdgeStatus[];
  /** Index into the sorted list of the edge being processed. */
  edgeIndex: number | null;
  /** Recursive find() chain currently on the call stack. */
  findPath: number[];
  current: number | null;
  roots: number[];
  changed: number[];
  mstCount: number;
  totalWeight: number;
}

export interface KruskalResult {
  sorted: KEdge[];
  mst: KEdge[];
  totalWeight: number;
  components: number;
  parent: number[];
  rank: number[];
}

export const KRUSKAL_CODE = KRUSKAL_JAVA;
const J = {
  findIf: lineOf(KRUSKAL_JAVA, 'if (parent[x] != x)'),
  compress: lineOf(KRUSKAL_JAVA, 'parent[x] = find(parent[x]);'),
  findRet: lineOf(KRUSKAL_JAVA, 'return parent[x];'),
  roots: lineOf(KRUSKAL_JAVA, 'int rootY = find(y);'),
  cycle: lineOf(KRUSKAL_JAVA, 'return false;'),
  attachXY: lineOf(KRUSKAL_JAVA, 'parent[rootX] = rootY;'),
  attachYX: lineOf(KRUSKAL_JAVA, 'parent[rootY] = rootX;'),
  attachEq: lineOf(KRUSKAL_JAVA, 'parent[rootY] = rootX;', 1),
  rankUp: lineOf(KRUSKAL_JAVA, 'rank[rootX]++;'),
  sort: lineOf(KRUSKAL_JAVA, 'Collections.sort(edges);'),
  init: lineOf(KRUSKAL_JAVA, 'DSU dsu = new DSU(vertices);'),
  loop: lineOf(KRUSKAL_JAVA, 'for (Edge edge : edges)'),
  union: lineOf(KRUSKAL_JAVA, 'if (dsu.union(edge.src, edge.dest))'),
  add: lineOf(KRUSKAL_JAVA, 'totalWeight += edge.weight;'),
  full: lineOf(KRUSKAL_JAVA, 'if (mst.size() == vertices - 1)'),
  brk: lineOf(KRUSKAL_JAVA, 'break;'),
  print: lineOf(KRUSKAL_JAVA, 'Total MST Weight'),
};

export const edgeText = (e: KEdge) => `${e.src} -- ${e.dest} : ${e.weight}`;

export function runKruskal(vertices: number, edges: KEdge[]): Trace<KruskalState, KruskalResult> {
  const sorted = [...edges].sort((a, b) => a.weight - b.weight); // stable, like Collections.sort
  const parent = Array.from({ length: vertices }, (_, i) => i);
  const rank = new Array<number>(vertices).fill(0);
  const status: EdgeStatus[] = sorted.map(() => 'pending');
  const steps: Step<KruskalState>[] = [];
  const mst: KEdge[] = [];
  let totalWeight = 0;
  let edgeIndex: number | null = null;

  const snap = (
    message: string,
    tag: Step<KruskalState>['tag'],
    line: number | undefined,
    extra: Partial<Pick<KruskalState, 'findPath' | 'current' | 'roots' | 'changed'>> = {},
  ) =>
    steps.push({
      state: {
        parent: parent.slice(),
        rank: rank.slice(),
        status: status.slice(),
        edgeIndex,
        findPath: [],
        current: null,
        roots: [],
        changed: [],
        mstCount: mst.length,
        totalWeight,
        ...extra,
      },
      message,
      tag,
      line,
    });

  // Recursive find exactly as in the notes; `stack` is the call chain for display.
  const find = (x: number, stack: number[]): number => {
    const chain = [...stack, x];
    if (parent[x] !== x) {
      snap(`find(${x}): parent[${x}] = ${parent[x]} ≠ ${x} → call find(${parent[x]}).`, 'compare', J.findIf, { findPath: chain, current: x });
      const root = find(parent[x], chain);
      if (parent[x] !== root) {
        parent[x] = root;
        snap(`Path compression: parent[${x}] = ${root} (point ${x} straight at the root).`, 'action', J.compress, {
          findPath: chain,
          current: x,
          changed: [x],
        });
      }
      return parent[x];
    }
    snap(`find(${x}): parent[${x}] == ${x} → ${x} is a root; return ${x}.`, 'success', J.findRet, { findPath: chain, current: x });
    return x;
  };

  snap(
    `Collections.sort(edges): ${sorted.length} edge${sorted.length === 1 ? '' : 's'} sorted by increasing weight (ties keep input order).`,
    'info',
    J.sort,
  );
  snap(`new DSU(${vertices}): parent[i] = i and rank[i] = 0 for every vertex. totalWeight = 0.`, 'info', J.init);

  let stopped = false;
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    edgeIndex = i;
    status[i] = 'current';
    snap(`Next edge ${edgeText(e)} → dsu.union(${e.src}, ${e.dest}).`, 'info', J.loop);
    const rootX = find(e.src, []);
    const rootY = find(e.dest, []);
    snap(`rootX = find(${e.src}) = ${rootX}, rootY = find(${e.dest}) = ${rootY}.`, 'info', J.roots, { roots: [rootX, rootY] });
    if (rootX === rootY) {
      status[i] = 'cycle';
      snap(`rootX == rootY → ${e.src} and ${e.dest} are already connected; this edge would form a cycle. return false.`, 'warn', J.cycle, {
        roots: [rootX],
      });
      continue;
    }
    if (rank[rootX] < rank[rootY]) {
      parent[rootX] = rootY;
      snap(`rank[${rootX}] = ${rank[rootX]} < rank[${rootY}] = ${rank[rootY]} → parent[${rootX}] = ${rootY}.`, 'action', J.attachXY, {
        roots: [rootY],
        changed: [rootX],
      });
    } else if (rank[rootX] > rank[rootY]) {
      parent[rootY] = rootX;
      snap(`rank[${rootX}] = ${rank[rootX]} > rank[${rootY}] = ${rank[rootY]} → parent[${rootY}] = ${rootX}.`, 'action', J.attachYX, {
        roots: [rootX],
        changed: [rootY],
      });
    } else {
      parent[rootY] = rootX;
      rank[rootX]++;
      snap(`Equal ranks → parent[${rootY}] = ${rootX}; rank[${rootX}]++ → ${rank[rootX]}.`, 'action', J.rankUp, {
        roots: [rootX],
        changed: [rootY],
      });
    }
    status[i] = 'mst';
    mst.push(e);
    totalWeight += e.weight;
    snap(`union returned true → mst.add(${edgeText(e)}); totalWeight = ${totalWeight}.`, 'success', J.add);
    if (mst.length === vertices - 1) {
      snap(`mst.size() == vertices − 1 (${vertices - 1}) → break.`, 'info', J.brk);
      stopped = true;
      for (let k = i + 1; k < sorted.length; k++) status[k] = 'unused';
      break;
    }
  }
  edgeIndex = null;
  const roots = new Set<number>();
  for (let v = 0; v < vertices; v++) {
    let r = v;
    while (parent[r] !== r) r = parent[r];
    roots.add(r);
  }
  const components = roots.size;
  snap(
    stopped || components === 1
      ? `Total MST Weight = ${totalWeight} (${mst.length} edges).`
      : `All edges processed. The graph is disconnected (${components} components), so this is a minimum spanning forest: ${mst.length} edges, total weight ${totalWeight}.`,
    'done',
    J.print,
  );
  return { steps, result: { sorted, mst, totalWeight, components, parent: parent.slice(), rank: rank.slice() } };
}

export function parseEdges(text: string, vertices: number): ParseResult<KEdge[]> {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/new Edge\(|edges\.add\(|[();,]/g, ' ').trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('//'));
  if (!lines.length) return { ok: false, error: 'Add at least one edge, e.g. "0 1 2" (src dest weight).' };
  if (lines.length > 30) return { ok: false, error: `Too many edges (${lines.length}). Maximum is 30.` };
  const edges: KEdge[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].split(/\s+|--|:/).filter(Boolean);
    if (t.length !== 3) return { ok: false, error: `Line ${i + 1}: expected "src dest weight", got "${lines[i]}".` };
    const [a, b, w] = t.map(Number);
    if (![a, b].every((x) => Number.isInteger(x) && x >= 0 && x < vertices))
      return { ok: false, error: `Line ${i + 1}: vertices must be whole numbers from 0 to ${vertices - 1}.` };
    if (!Number.isInteger(w) || w < -999 || w > 999) return { ok: false, error: `Line ${i + 1}: weight must be a whole number from −999 to 999.` };
    if (a === b) return { ok: false, error: `Line ${i + 1}: self-loop ${a} -- ${a} can never be in an MST; remove it.` };
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) return { ok: false, error: `Line ${i + 1}: edge ${a} -- ${b} is listed twice.` };
    seen.add(key);
    edges.push({ src: a, dest: b, weight: w, id: i });
  }
  return { ok: true, value: edges };
}

/** Edges from main() in KruskalMST.java (5 vertices, MST weight 16). */
export const SAMPLE_EDGES = `0 1 2
0 3 6
1 2 3
1 3 8
1 4 5
2 4 7
3 4 9`;

export function randomGraph(seed?: number): { vertices: number; text: string } {
  const r = rng(seed);
  const V = randInt(r, 5, 8);
  const pairs = new Set<string>();
  const lines: string[] = [];
  const add = (a: number, b: number) => {
    const k = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (a === b || pairs.has(k)) return;
    pairs.add(k);
    lines.push(`${a} ${b} ${randInt(r, 1, 20)}`);
  };
  for (let v = 1; v < V; v++) add(randInt(r, 0, v - 1), v); // spanning tree keeps it connected
  const extra = randInt(r, Math.floor(V / 2), V + 2);
  for (let k = 0; k < extra; k++) add(randInt(r, 0, V - 1), randInt(r, 0, V - 1));
  // shuffle so the sort step matters
  for (let i = lines.length - 1; i > 0; i--) {
    const j = randInt(r, 0, i);
    [lines[i], lines[j]] = [lines[j], lines[i]];
  }
  return { vertices: V, text: lines.join('\n') };
}
