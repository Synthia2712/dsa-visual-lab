import { useMemo, useState } from 'react';
import { findAlgo } from '../algorithms';
import { AlgoShell } from '../components/AlgoShell';
import { edgeText, KRUSKAL_CODE, parseEdges, randomGraph, runKruskal, SAMPLE_EDGES, type KEdge, type KruskalState } from '../engine/kruskal';
import { usePlayer } from '../hooks/usePlayer';
import { useTweenedPoints, type Points } from '../hooks/useTween';

interface KInput {
  vertices: number;
  edges: KEdge[];
  autoplay: boolean;
}

const STATUS_LABEL = { pending: 'waiting', current: 'checking', mst: 'in MST', cycle: 'cycle — skipped', unused: 'not needed' } as const;

export default function DsuPage() {
  const meta = findAlgo('disjoint-set-union')!;
  const [vText, setVText] = useState('5');
  const [text, setText] = useState(SAMPLE_EDGES);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState<KInput>(() => {
    const p = parseEdges(SAMPLE_EDGES, 5);
    return { vertices: 5, edges: p.ok ? p.value : [], autoplay: false };
  });
  const trace = useMemo(() => runKruskal(input.vertices, input.edges), [input]);
  const player = usePlayer(trace.steps.length, trace, input);

  const run = (vt = vText, t = text) => {
    const V = Number(vt);
    if (!Number.isInteger(V) || V < 2 || V > 12) return setError('Number of vertices must be a whole number from 2 to 12.');
    const p = parseEdges(t, V);
    if (!p.ok) return setError(p.error);
    setError(null);
    setInput({ vertices: V, edges: p.value, autoplay: true });
  };
  const randomize = () => {
    const g = randomGraph();
    setVText(String(g.vertices));
    setText(g.text);
    run(String(g.vertices), g.text);
  };

  const step = trace.steps[player.index];
  const r = trace.result;

  return (
    <AlgoShell
      meta={meta}
      error={error}
      onRun={() => run()}
      onRandomize={randomize}
      steps={trace.steps}
      player={player}
      code={KRUSKAL_CODE}
      inputs={
        <>
          <label className="field">
            <span>Vertices (0 … V−1)</span>
            <input type="number" min={2} max={12} value={vText} onChange={(e) => setVText(e.target.value)} />
          </label>
          <label className="field">
            <span>Edges — one per line: src dest weight</span>
            <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} className="mono" />
            <small>Undirected, up to 30 edges. You can also paste lines like edges.add(new Edge(0, 1, 2));</small>
          </label>
        </>
      }
      legend={
        <>
          <span className="lg">
            <i className="bar teal" /> Edge in the MST
          </span>
          <span className="lg">
            <i className="bar magenta" /> Edge being checked
          </span>
          <span className="lg">
            <i className="bar dashed" /> Rejected — would form a cycle
          </span>
          <span className="lg">
            <i className="dot fill-teal" /> On the find() call chain
          </span>
          <span className="lg">
            <i className="dot ring-magenta" /> rootX / rootY
          </span>
        </>
      }
      canvas={step && <KruskalCanvas state={step.state} vertices={input.vertices} sorted={r.sorted} ms={player.stepMs} />}
      result={
        <ul className="kv">
          <li className="hero">
            <span>Total MST weight</span>
            <b>{r.totalWeight}</b>
          </li>
          <li>
            <span>MST edges</span>
            <b>
              {r.mst.length} / {input.vertices - 1}
            </b>
          </li>
          <li>
            <span>Components</span>
            <b>{r.components}</b>
          </li>
          <li className="wide">
            <span>Java output</span>
            <b className="mono small">
              <span className="path-line">Edges in MST:</span>
              {r.mst.map((e) => (
                <span key={e.id} className="path-line">
                  {edgeText(e)}
                </span>
              ))}
              <span className="path-line">Total MST Weight = {r.totalWeight}</span>
            </b>
          </li>
        </ul>
      }
      complexity={[
        { label: 'Sort edges', value: 'O(E log E)' },
        { label: 'E × find/union', value: 'O(E · α(V))' },
        { label: 'Total', value: 'O(E log E)' },
        { label: 'Space', value: 'O(V + E)' },
      ]}
    />
  );
}

const GW = 420;
const GH = 300;

function KruskalCanvas({ state, vertices, sorted, ms }: { state: KruskalState; vertices: number; sorted: KEdge[]; ms: number }) {
  const gpos = useMemo(
    () =>
      Array.from({ length: vertices }, (_, i) => {
        const a = -Math.PI / 2 + (i / vertices) * Math.PI * 2;
        return { x: GW / 2 + Math.cos(a) * 118, y: GH / 2 + Math.sin(a) * 118 };
      }),
    [vertices],
  );
  const cur = state.edgeIndex !== null ? sorted[state.edgeIndex] : null;
  const roots = new Set(state.roots);
  const chain = new Set(state.findPath);

  return (
    <div className="canvas-wrap">
      <div className="canvas-badges">
        <span className="canvas-badge">
          MST edges <b>{state.mstCount}</b> / {vertices - 1}
        </span>
        <span className="canvas-badge">
          totalWeight <b>{state.totalWeight}</b>
        </span>
        {cur && (
          <span className="canvas-badge magenta">
            edge <b>{edgeText(cur)}</b>
          </span>
        )}
      </div>
      <div className="kruskal-top">
        <svg viewBox={`0 0 ${GW} ${GH}`} className="svg-canvas kruskal-graph" role="img" aria-label="Weighted graph">
          {sorted.map((e, i) => {
            const a = gpos[e.src];
            const b = gpos[e.dest];
            const st = state.status[i];
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            return (
              <g key={e.id}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`k-edge ${st}`} />
                <g transform={`translate(${mx} ${my})`}>
                  <rect x={-14} y={-10} width={28} height={20} rx={6} className={`edge-tag k-tag ${st}`} />
                  <text dy="0.35em" textAnchor="middle" className="edge-label">
                    {e.weight}
                  </text>
                </g>
              </g>
            );
          })}
          {gpos.map((p, v) => (
            <g key={v} transform={`translate(${p.x} ${p.y})`}>
              {chain.has(v) && <circle r={25} className="halo-teal" />}
              <circle r={18} className={`f-node-body ${cur && (cur.src === v || cur.dest === v) ? 'k-end' : ''}`} />
              <text dy="0.35em" textAnchor="middle" className="node-label">
                {v}
              </text>
            </g>
          ))}
        </svg>
        <ol className="edge-list" aria-label="Edges sorted by weight">
          {sorted.map((e, i) => (
            <li key={e.id} className={`k-row ${state.status[i]}`}>
              <span className="mono">{edgeText(e)}</span>
              <span className="k-status">{STATUS_LABEL[state.status[i]]}</span>
            </li>
          ))}
        </ol>
      </div>
      <Forest state={state} ms={ms} roots={roots} chain={chain} />
    </div>
  );
}

function Forest({ state, ms, roots, chain }: { state: KruskalState; ms: number; roots: Set<number>; chain: Set<number> }) {
  const n = state.parent.length;
  const layout = useMemo(() => {
    const children: number[][] = Array.from({ length: n }, () => []);
    const rs: number[] = [];
    state.parent.forEach((p, i) => (p === i ? rs.push(i) : children[p].push(i)));
    const leaves = (v: number): number => (children[v].length ? children[v].reduce((a, c) => a + leaves(c), 0) : 1);
    const total = rs.reduce((a, r) => a + leaves(r), 0);
    const W = Math.max(480, total * 52);
    const pos: Points = {};
    let maxD = 0;
    let cursor = 0;
    const place = (v: number, d: number) => {
      maxD = Math.max(maxD, d);
      if (!children[v].length) {
        pos[v] = { x: cursor + 0.5, y: d };
        cursor += 1;
        return;
      }
      const start = cursor;
      children[v].forEach((c) => place(c, d + 1));
      pos[v] = { x: (start + cursor) / 2, y: d };
    };
    rs.forEach((r) => place(r, 0));
    const H = Math.max(150, (maxD + 1) * 66 + 40);
    const out: Points = {};
    for (const k in pos) out[k] = { x: 20 + (pos[k].x / total) * (W - 40), y: 34 + pos[k].y * 66 };
    return { pos: out, W, H };
  }, [state.parent, n]);
  const p = useTweenedPoints(layout.pos, Math.min(520, ms * 0.8));
  const changed = new Set(state.changed);
  return (
    <div className="forest-block">
      <div className="zone-label">DSU forest (arrows point to parent)</div>
      <svg viewBox={`0 0 ${layout.W} ${layout.H}`} className="svg-canvas" role="img" aria-label="Disjoint set forest">
        <defs>
          <marker id="dsu-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" className="arrowhead muted" />
          </marker>
          <marker id="dsu-arrow-hot" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" className="arrowhead magenta" />
          </marker>
        </defs>
        {state.parent.map((par, i) => {
          if (par === i || !p[i] || !p[par]) return null;
          const a = p[i];
          const b = p[par];
          const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          const ux = (b.x - a.x) / len;
          const uy = (b.y - a.y) / len;
          const hot = changed.has(i);
          return (
            <line
              key={`e${i}`}
              x1={a.x + ux * 17}
              y1={a.y + uy * 17}
              x2={b.x - ux * 21}
              y2={b.y - uy * 21}
              className={`dsu-edge ${hot ? 'hot' : ''} ${chain.has(i) && chain.has(par) ? 'path' : ''}`}
              markerEnd={`url(#${hot ? 'dsu-arrow-hot' : 'dsu-arrow'})`}
            />
          );
        })}
        {state.parent.map((par, i) => {
          const pt = p[i];
          if (!pt) return null;
          return (
            <g key={i} transform={`translate(${pt.x} ${pt.y})`} className={`dsu-node ${chain.has(i) ? 'path' : ''} ${par === i ? 'root' : ''}`}>
              {state.current === i && <circle r={24} className="halo-teal" />}
              {roots.has(i) && <circle r={22} className="halo-magenta" />}
              <circle r={16} className="dsu-body" />
              <text dy="0.35em" textAnchor="middle" className="node-label">
                {i}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="array-table" role="table" aria-label="parent and rank arrays">
        <div className="arr-row head" role="row">
          <span role="rowheader">i</span>
          {state.parent.map((_, i) => (
            <span key={i} role="cell" className={chain.has(i) ? 'path' : ''}>
              {i}
            </span>
          ))}
        </div>
        <div className="arr-row" role="row">
          <span role="rowheader">parent</span>
          {state.parent.map((v, i) => (
            <span key={i} role="cell" className={`${changed.has(i) ? 'hot' : ''} ${v === i ? 'self' : ''}`}>
              {v}
            </span>
          ))}
        </div>
        <div className="arr-row" role="row">
          <span role="rowheader">rank</span>
          {state.rank.map((v, i) => (
            <span key={i} role="cell" className={state.parent[i] === i ? '' : 'dim'}>
              {v}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
