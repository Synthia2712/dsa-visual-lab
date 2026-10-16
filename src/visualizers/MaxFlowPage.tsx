import { useMemo, useState } from 'react';
import { findAlgo } from '../algorithms';
import { AlgoShell } from '../components/AlgoShell';
import {
  edgeFlow,
  EK_CODE,
  FF_CODE,
  layoutNetwork,
  networkToText,
  parseNetwork,
  randomNetwork,
  runMaxFlow,
  SAMPLE_NETWORK,
  type FlowMethod,
  type FlowNetwork,
  type FlowState,
} from '../engine/maxFlow';
import { usePlayer } from '../hooks/usePlayer';

const W = 760;
const H = 420;
const R = 21;

export default function MaxFlowPage({ method }: { method: FlowMethod }) {
  const meta = findAlgo(method === 'dfs' ? 'ford-fulkerson' : 'edmonds-karp')!;
  const [text, setText] = useState(SAMPLE_NETWORK);
  const [src, setSrc] = useState('0');
  const [sink, setSink] = useState('5');
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'flow' | 'residual'>('flow');
  const [input, setInput] = useState<{ net: FlowNetwork; autoplay: boolean }>(() => {
    const p = parseNetwork(SAMPLE_NETWORK, '0', '5');
    if (!p.ok) throw new Error(p.error);
    return { net: p.value, autoplay: false };
  });
  const net = input.net;
  const trace = useMemo(() => runMaxFlow(input.net, method), [input, method]);
  const player = usePlayer(trace.steps.length, trace, input);
  const pos = useMemo(() => layoutNetwork(net, W, H), [net]);

  const run = (t = text, s = src, k = sink) => {
    const p = parseNetwork(t, s, k);
    if (!p.ok) return setError(p.error);
    setError(null);
    setInput({ net: p.value, autoplay: true });
  };
  const randomize = () => {
    const n = randomNetwork();
    const t = networkToText(n);
    setText(t);
    setSrc(n.names[n.source]);
    setSink(n.names[n.sink]);
    run(t, n.names[n.source], n.names[n.sink]);
  };

  const step = trace.steps[player.index];
  const r = trace.result;
  const isDfs = method === 'dfs';
  const name = (v: number) => net.names[v];

  return (
    <AlgoShell
      meta={meta}
      error={error}
      onRun={() => run()}
      onRandomize={randomize}
      steps={trace.steps}
      player={player}
      code={isDfs ? FF_CODE : EK_CODE}
      note={trace.truncated ? 'Large run: some neighbour checks were condensed. Every augmenting path is still shown.' : null}
      inputs={
        <>
          <label className="field">
            <span>Graph — edges "u v capacity", or the int[][] matrix</span>
            <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} className="mono" />
            <small>Nodes 0…V−1 are scanned in index order, like the Java for-loop. Up to 12 nodes, capacities 1–999.</small>
          </label>
          <div className="field-row">
            <label className="field">
              <span>Source</span>
              <input value={src} onChange={(e) => setSrc(e.target.value)} maxLength={4} />
            </label>
            <label className="field">
              <span>Sink</span>
              <input value={sink} onChange={(e) => setSink(e.target.value)} maxLength={4} />
            </label>
          </div>
          <div className="seg" role="radiogroup" aria-label="Graph view">
            <button type="button" className={view === 'flow' ? 'on' : ''} onClick={() => setView('flow')} aria-pressed={view === 'flow'}>
              Flow / capacity
            </button>
            <button type="button" className={view === 'residual' ? 'on' : ''} onClick={() => setView('residual')} aria-pressed={view === 'residual'}>
              Residual graph
            </button>
          </div>
        </>
      }
      legend={
        <>
          <span className="lg">
            <i className="bar teal" /> Edge carrying flow
          </span>
          <span className="lg">
            <i className="bar magenta" /> Augmenting path (from parent[])
          </span>
          <span className="lg">
            <i className="bar dashed" /> Reverse residual edge (cancels flow)
          </span>
          <span className="lg">
            <i className="dot fill-teal" /> visited[v] = true
          </span>
          <span className="lg">
            <i className="dot fill-magenta" /> Source side of the min cut
          </span>
        </>
      }
      canvas={step && <FlowCanvas net={net} pos={pos} state={step.state} method={method} view={view} />}
      result={
        <ul className="kv">
          <li className="hero">
            <span>Maximum flow</span>
            <b>{r.maxFlow}</b>
          </li>
          <li>
            <span>Augmenting paths</span>
            <b>{r.augmentations.length}</b>
          </li>
          <li>
            <span>Min-cut capacity</span>
            <b>{r.cutCapacity}</b>
          </li>
          <li className="wide">
            <span>Java output</span>
            <b className="mono small">
              {r.augmentations.map((a, i) => (
                <span key={i} className="path-line">
                  Augmenting flow = {a.flow} <em>({a.path.map(name).join('→')})</em>
                </span>
              ))}
              <span className="path-line">Maximum Flow = {r.maxFlow}</span>
            </b>
          </li>
          <li className="wide">
            <span>Min cut (source side)</span>
            <b className="mono">{'{' + r.minCut.map(name).join(', ') + '}'}</b>
          </li>
        </ul>
      }
      complexity={
        isDfs
          ? [
              { label: 'Time', value: 'O(E · f*)  (f* = max flow)' },
              { label: 'One DFS (matrix)', value: 'O(V²)' },
              { label: 'Space', value: 'O(V²) residual matrix' },
              { label: 'Note', value: 'DFS takes any path — can need many iterations' },
            ]
          : [
              { label: 'Time', value: 'O(V · E²)' },
              { label: 'One BFS (matrix)', value: 'O(V²)' },
              { label: 'Space', value: 'O(V²) residual matrix' },
              { label: 'Note', value: 'Shortest paths bound augmentations to O(V·E)' },
            ]
      }
    />
  );
}

interface CanvasProps {
  net: FlowNetwork;
  pos: { x: number; y: number }[];
  state: FlowState;
  method: FlowMethod;
  view: 'flow' | 'residual';
}

function curve(a: { x: number; y: number }, b: { x: number; y: number }, bend: number) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const c = { x: mx - (dy / len) * bend, y: my + (dx / len) * bend };
  const unit = (p: { x: number; y: number }, q: { x: number; y: number }) => {
    const l = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    return { x: (q.x - p.x) / l, y: (q.y - p.y) / l };
  };
  const u1 = unit(a, c);
  const u2 = unit(b, c);
  const s = { x: a.x + u1.x * R, y: a.y + u1.y * R };
  const e = { x: b.x + u2.x * (R + 5), y: b.y + u2.y * (R + 5) };
  const label = { x: 0.25 * s.x + 0.5 * c.x + 0.25 * e.x, y: 0.25 * s.y + 0.5 * c.y + 0.25 * e.y };
  return { d: `M${s.x},${s.y} Q${c.x},${c.y} ${e.x},${e.y}`, label };
}

function FlowCanvas({ net, pos, state, method, view }: CanvasProps) {
  const V = net.names.length;
  const visited = new Set(state.visited);
  const cut = state.minCut ? new Set(state.minCut) : null;
  const onPath = (u: number, v: number) => {
    const i = state.path.indexOf(u);
    return i >= 0 && state.path[i + 1] === v;
  };
  const isPathEdge = (u: number, v: number) => state.pathEdge?.u === u && state.pathEdge?.v === v;
  const chk = state.check;
  const name = (v: number) => net.names[v];

  // A residual move u→v along a pair that has no original u→v edge cancels flow on v→u.
  const reverseMove = (u: number, v: number) => net.cap[u][v] === 0 && net.cap[v][u] > 0;

  const flowEdges = net.edges.map((e, i) => {
    const { from: u, to: v, cap } = e;
    const bend = net.cap[v][u] > 0 ? 48 : 0; // antiparallel pair: separate the two labels
    const g = curve(pos[u], pos[v], bend);
    const f = edgeFlow(net, state.residual, u, v);
    const hot = onPath(u, v);
    const checking = chk && chk.u === u && chk.v === v;
    let cls = 'f-edge';
    if (f > 0) cls += ' has-flow';
    if (f === cap) cls += ' saturated';
    if (hot) cls += ' on-path';
    if (checking) cls += chk!.ok ? ' active-ok' : ' active-skip';
    if (isPathEdge(u, v)) cls += ' active-ok';
    const marker = hot ? 'magenta' : f > 0 || checking ? 'teal' : 'muted';
    return (
      <g key={`f${i}`}>
        <path d={g.d} className={cls} style={{ strokeWidth: hot ? 4.5 : 1.5 + (f / cap) * 3.5 }} markerEnd={`url(#arrow-${marker})`} />
        <g transform={`translate(${g.label.x} ${g.label.y})`}>
          <rect x={-22} y={-11} width={44} height={22} rx={6} className={`edge-tag ${hot ? 'on-path' : ''} ${f === cap ? 'full' : ''}`} />
          <text dy="0.35em" textAnchor="middle" className="edge-label">
            {f}/{cap}
          </text>
        </g>
      </g>
    );
  });

  // Reverse residual moves (u→v where only v→u exists in the original graph) drawn as dashed overlays.
  const reverseOverlays: JSX.Element[] = [];
  const addReverse = (u: number, v: number, cls: string, key: string) => {
    const g = curve(pos[u], pos[v], -30);
    reverseOverlays.push(<path key={key} d={g.d} className={`f-edge backward ${cls}`} markerEnd={`url(#arrow-${cls.includes('on-path') ? 'magenta' : 'teal'})`} />);
  };
  if (chk && reverseMove(chk.u, chk.v)) addReverse(chk.u, chk.v, chk.ok ? 'active-ok' : 'active-skip', 'chk');
  for (let i = 0; i + 1 < state.path.length; i++) {
    const u = state.path[i];
    const v = state.path[i + 1];
    if (reverseMove(u, v)) addReverse(u, v, 'on-path', `p${i}`);
  }

  const residualEdges: JSX.Element[] = [];
  if (view === 'residual')
    for (let u = 0; u < V; u++)
      for (let v = 0; v < V; v++) {
        const rc = state.residual[u][v];
        const checking = chk && chk.u === u && chk.v === v;
        if (rc <= 0 && !checking) continue;
        const g = curve(pos[u], pos[v], 18);
        const hot = onPath(u, v);
        let cls = 'f-edge residual';
        if (reverseMove(u, v)) cls += ' backward';
        if (hot) cls += ' on-path';
        if (checking) cls += chk!.ok ? ' active-ok' : ' active-skip';
        residualEdges.push(
          <g key={`r${u}-${v}`}>
            <path d={g.d} className={cls} markerEnd={`url(#arrow-${hot ? 'magenta' : checking && chk!.ok ? 'teal' : 'muted'})`} />
            <g transform={`translate(${g.label.x} ${g.label.y})`}>
              <rect x={-14} y={-10} width={28} height={20} rx={6} className={`edge-tag ${hot ? 'on-path' : ''}`} />
              <text dy="0.35em" textAnchor="middle" className="edge-label">
                {rc}
              </text>
            </g>
          </g>,
        );
      }

  return (
    <div className="canvas-wrap">
      <div className="canvas-badges">
        <span className="canvas-badge">
          Iteration <b>{state.iteration}</b>
        </span>
        <span className="canvas-badge">
          maxFlow <b>{state.maxFlow}</b>
        </span>
        {state.pathFlow !== null && (
          <span className="canvas-badge magenta">
            pathFlow <b>{state.pathFlow}</b>
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="svg-canvas" role="img" aria-label="Flow network">
        <defs>
          {['muted', 'teal', 'magenta'].map((k) => (
            <marker key={k} id={`arrow-${k}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className={`arrowhead ${k}`} />
            </marker>
          ))}
        </defs>
        {view === 'flow' ? flowEdges : residualEdges}
        {view === 'flow' && reverseOverlays}
        {pos.map((p, v) => {
          const isS = v === net.source;
          const isT = v === net.sink;
          let cls = 'f-node';
          if (cut ? cut.has(v) : visited.has(v)) cls += cut ? ' cut' : ' visited';
          return (
            <g key={v} transform={`translate(${p.x} ${p.y})`} className={cls}>
              {state.current === v && <circle r={R + 7} className="halo-teal" />}
              <circle r={R} className="f-node-body" />
              {(isS || isT) && <circle r={R - 4} className={`f-node-inner ${isS ? 'src' : 'snk'}`} />}
              <text dy="0.35em" textAnchor="middle" className="node-label">
                {name(v)}
              </text>
              {(isS || isT) && (
                <text y={R + 16} textAnchor="middle" className="node-sub">
                  {isS ? 'source' : 'sink'}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="frontier">
        <span className="frontier-label">{method === 'dfs' ? 'dfs() call stack' : 'queue'}</span>
        <div className="chips">
          {state.frontier.length ? (
            state.frontier.map((v, i) => (
              <span key={`${v}-${i}`} className={`chip ${state.current === v ? 'on' : ''}`}>
                {name(v)}
              </span>
            ))
          ) : (
            <span className="muted small">empty</span>
          )}
        </div>
        <span className="frontier-label" style={{ marginLeft: 'auto' }}>
          parent[]
        </span>
        <div className="chips">
          {state.parent.map((p, v) => (
            <span key={v} className="chip small-chip" title={`parent[${name(v)}]`}>
              {name(v)}:{p < 0 ? '−1' : name(p)}
            </span>
          ))}
        </div>
      </div>
      <ResidualMatrix net={net} state={state} />
    </div>
  );
}

function ResidualMatrix({ net, state }: { net: FlowNetwork; state: FlowState }) {
  const V = net.names.length;
  const chk = state.check;
  const pe = state.pathEdge;
  return (
    <details className="matrix-wrap" open={V <= 8}>
      <summary>residualGraph[u][v]</summary>
      <div className="matrix-scroll">
        <table className="matrix">
          <thead>
            <tr>
              <th>u \ v</th>
              {net.names.map((n) => (
                <th key={n} className={chk && net.names[chk.v] === n ? 'hl' : ''}>
                  {n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.residual.map((row, u) => (
              <tr key={u} className={chk?.u === u ? 'row-hl' : ''}>
                <th>{net.names[u]}</th>
                {row.map((val, v) => {
                  const isChk = chk && chk.u === u && chk.v === v;
                  const isPE = pe && ((pe.u === u && pe.v === v) || (pe.u === v && pe.v === u));
                  const changed = val !== net.cap[u][v];
                  return (
                    <td key={v} className={`${isChk ? (chk!.ok ? 'chk-ok' : 'chk-no') : ''} ${isPE ? 'pe' : ''} ${val === 0 ? 'zero' : ''} ${changed ? 'changed' : ''}`}>
                      {val}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
