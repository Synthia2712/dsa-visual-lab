import { useMemo, useState } from 'react';
import { findAlgo } from '../algorithms';
import { AlgoShell } from '../components/AlgoShell';
import {
  EK_PSEUDOCODE,
  FF_PSEUDOCODE,
  layoutNetwork,
  networkToText,
  parseNetwork,
  randomNetwork,
  residualFrom,
  residualOf,
  residualTo,
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
  const [src, setSrc] = useState('S');
  const [sink, setSink] = useState('T');
  const [error, setError] = useState<string | null>(null);
  const [showResidual, setShowResidual] = useState(false);
  const [input, setInput] = useState<{ net: FlowNetwork; autoplay: boolean }>(() => {
    const p = parseNetwork(SAMPLE_NETWORK, 'S', 'T');
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
    setSrc('S');
    setSink('T');
    run(t, 'S', 'T');
  };

  const step = trace.steps[player.index];
  const r = trace.result;
  const isDfs = method === 'dfs';

  return (
    <AlgoShell
      meta={meta}
      error={error}
      onRun={() => run()}
      onRandomize={randomize}
      steps={trace.steps}
      player={player}
      pseudocode={isDfs ? FF_PSEUDOCODE : EK_PSEUDOCODE}
      note={trace.truncated ? 'Large run: some search steps were condensed. Every augmentation is still shown.' : null}
      inputs={
        <>
          <label className="field">
            <span>Edges — one per line: FROM TO CAPACITY</span>
            <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} className="mono" />
            <small>Up to 12 nodes and 30 edges. Capacities 1–999.</small>
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
          <label className="check">
            <input type="checkbox" checked={showResidual} onChange={(e) => setShowResidual(e.target.checked)} />
            <span>Show residual network</span>
          </label>
        </>
      }
      legend={
        <>
          <span className="lg">
            <i className="bar teal" /> Edge carrying flow (flow / capacity)
          </span>
          <span className="lg">
            <i className="bar magenta" /> Augmenting path
          </span>
          <span className="lg">
            <i className="bar dashed" /> Backward residual edge (cancels flow)
          </span>
          <span className="lg">
            <i className="dot fill-teal" /> Visited in this {isDfs ? 'DFS' : 'BFS'}
          </span>
          <span className="lg">
            <i className="dot fill-magenta" /> Source side of min cut
          </span>
        </>
      }
      canvas={step && <FlowCanvas net={net} pos={pos} state={step.state} method={method} residual={showResidual} />}
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
            <span>Min cut (source side)</span>
            <b className="mono">{'{' + r.minCut.map((v) => net.names[v]).join(', ') + '}'}</b>
          </li>
          <li className="wide">
            <span>Paths</span>
            <b className="mono small">
              {r.augmentations.map((a, i) => (
                <span key={i} className="path-line">
                  {[net.source, ...a.path.map((rid) => residualTo(net, rid))].map((v) => net.names[v]).join('→')} <em>+{a.bottleneck}</em>
                </span>
              ))}
              {!r.augmentations.length && '—'}
            </b>
          </li>
        </ul>
      }
      complexity={
        isDfs
          ? [
              { label: 'Time', value: 'O(E · f*)  (f* = max flow)' },
              { label: 'One DFS', value: 'O(V + E)' },
              { label: 'Space', value: 'O(V + E)' },
              { label: 'Note', value: 'Path choice is arbitrary; can be slow on large capacities' },
            ]
          : [
              { label: 'Time', value: 'O(V · E²)' },
              { label: 'One BFS', value: 'O(V + E)' },
              { label: 'Space', value: 'O(V + E)' },
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
  residual: boolean;
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

function FlowCanvas({ net, pos, state, method, residual }: CanvasProps) {
  const visited = new Set(state.visited);
  const pathSet = new Set(state.path.map((rid) => rid >> 1));
  const treeSet = new Set(state.tree);
  const cut = state.minCut ? new Set(state.minCut) : null;
  const pairs = new Set(net.edges.map((e) => `${e.from}-${e.to}`));
  const activeEdge = state.active !== null ? state.active >> 1 : null;

  const nodeName = (v: number) => net.names[v];

  return (
    <div className="canvas-wrap">
      <div className="canvas-badges">
        <span className="canvas-badge">
          Iteration <b>{state.iteration}</b>
        </span>
        <span className="canvas-badge">
          Flow <b>{state.maxFlow}</b>
        </span>
        {state.bottleneck !== null && (
          <span className="canvas-badge magenta">
            Bottleneck <b>{state.bottleneck}</b>
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="svg-canvas" role="img" aria-label="Flow network">
        <defs>
          {['muted', 'teal', 'magenta', 'warn'].map((k) => (
            <marker key={k} id={`arrow-${k}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className={`arrowhead ${k}`} />
            </marker>
          ))}
        </defs>

        {!residual &&
          net.edges.map((e, i) => {
            const bend = pairs.has(`${e.to}-${e.from}`) ? 22 : 0;
            const g = curve(pos[e.from], pos[e.to], bend);
            const f = state.flows[i];
            const onPath = pathSet.has(i);
            const isActive = activeEdge === i;
            const backward = isActive && state.active! & 1;
            let cls = 'f-edge';
            if (f > 0) cls += ' has-flow';
            if (f === e.cap) cls += ' saturated';
            if (onPath) cls += ' on-path';
            if (isActive && !backward) cls += state.activeOk ? ' active-ok' : ' active-skip';
            const marker = onPath ? 'magenta' : isActive && state.activeOk && !backward ? 'teal' : f > 0 ? 'teal' : 'muted';
            const width = 1.5 + (f / Math.max(1, e.cap)) * 3.5;
            return (
              <g key={i}>
                <path d={g.d} className={cls} style={{ strokeWidth: onPath ? 4.5 : width }} markerEnd={`url(#arrow-${marker})`} />
                {backward && (
                  <path
                    d={curve(pos[e.to], pos[e.from], -bend - 16).d}
                    className={`f-edge backward ${state.activeOk ? 'active-ok' : 'active-skip'}`}
                    markerEnd={`url(#arrow-${state.activeOk ? 'magenta' : 'muted'})`}
                  />
                )}
                <g transform={`translate(${g.label.x} ${g.label.y})`}>
                  <rect x={-22} y={-11} width={44} height={22} rx={6} className={`edge-tag ${onPath ? 'on-path' : ''} ${f === e.cap ? 'full' : ''}`} />
                  <text dy="0.35em" textAnchor="middle" className="edge-label">
                    {f}/{e.cap}
                  </text>
                </g>
              </g>
            );
          })}

        {residual &&
          net.edges.flatMap((_, i) =>
            [2 * i, 2 * i + 1].map((rid) => {
              const rc = residualOf(net, state.flows, rid);
              const isActive = state.active === rid;
              const inPath = state.path.includes(rid);
              if (rc <= 0 && !isActive) return null;
              const a = pos[residualFrom(net, rid)];
              const b = pos[residualTo(net, rid)];
              const g = curve(a, b, 18);
              let cls = 'f-edge residual';
              if (rid & 1) cls += ' backward';
              if (treeSet.has(rid)) cls += ' has-flow';
              if (inPath) cls += ' on-path';
              if (isActive) cls += state.activeOk ? ' active-ok' : ' active-skip';
              return (
                <g key={rid}>
                  <path d={g.d} className={cls} markerEnd={`url(#arrow-${inPath ? 'magenta' : isActive && state.activeOk ? 'teal' : 'muted'})`} />
                  <g transform={`translate(${g.label.x} ${g.label.y})`}>
                    <rect x={-14} y={-10} width={28} height={20} rx={6} className={`edge-tag ${inPath ? 'on-path' : ''}`} />
                    <text dy="0.35em" textAnchor="middle" className="edge-label">
                      {rc}
                    </text>
                  </g>
                </g>
              );
            }),
          )}

        {pos.map((p, v) => {
          const isS = v === net.source;
          const isT = v === net.sink;
          let cls = 'f-node';
          if (cut ? cut.has(v) : visited.has(v)) cls += cut ? ' cut' : ' visited';
          if (state.current === v) cls += ' current';
          return (
            <g key={v} transform={`translate(${p.x} ${p.y})`} className={cls}>
              {state.current === v && <circle r={R + 7} className="halo-teal" />}
              <circle r={R} className="f-node-body" />
              {(isS || isT) && <circle r={R - 4} className={`f-node-inner ${isS ? 'src' : 'snk'}`} />}
              <text dy="0.35em" textAnchor="middle" className="node-label">
                {nodeName(v)}
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
        <span className="frontier-label">{method === 'dfs' ? 'DFS stack (path)' : 'BFS queue'}</span>
        <div className="chips">
          {state.frontier.length ? (
            state.frontier.map((v, i) => (
              <span key={`${v}-${i}`} className={`chip ${state.current === v && method === 'dfs' && i === state.frontier.length - 1 ? 'on' : ''}`}>
                {nodeName(v)}
              </span>
            ))
          ) : (
            <span className="muted small">empty</span>
          )}
        </div>
      </div>
    </div>
  );
}
