import { useMemo, useState } from 'react';
import { findAlgo } from '../algorithms';
import { AlgoShell } from '../components/AlgoShell';
import { DSU_PSEUDOCODE, opText, parseDsuOps, randomDsuOps, runDsu, SAMPLE_DSU, type DsuOp, type DsuState, type UnionStrategy } from '../engine/dsu';
import { usePlayer } from '../hooks/usePlayer';
import { useTweenedPoints, type Points } from '../hooks/useTween';

interface DsuInput {
  n: number;
  ops: DsuOp[];
  strategy: UnionStrategy;
  compression: boolean;
  autoplay: boolean;
}

export default function DsuPage() {
  const meta = findAlgo('disjoint-set-union')!;
  const [nText, setNText] = useState('10');
  const [text, setText] = useState(SAMPLE_DSU);
  const [strategy, setStrategy] = useState<UnionStrategy>('rank');
  const [compression, setCompression] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState<DsuInput>(() => {
    const p = parseDsuOps(SAMPLE_DSU, 10);
    return { n: 10, ops: p.ok ? p.value : [], strategy: 'rank', compression: true, autoplay: false };
  });
  const trace = useMemo(() => runDsu(input.n, input.ops, input.strategy, input.compression), [input]);
  const player = usePlayer(trace.steps.length, trace, input);

  const run = (nt = nText, t = text, s = strategy, c = compression) => {
    const n = Number(nt);
    if (!Number.isInteger(n) || n < 2 || n > 16) return setError('Number of elements must be a whole number from 2 to 16.');
    const p = parseDsuOps(t, n);
    if (!p.ok) return setError(p.error);
    setError(null);
    setInput({ n, ops: p.value, strategy: s, compression: c, autoplay: true });
  };
  const randomize = () => {
    const n = 8 + Math.floor(Math.random() * 7);
    const t = randomDsuOps(n);
    setNText(String(n));
    setText(t);
    run(String(n), t);
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
      pseudocode={DSU_PSEUDOCODE}
      inputs={
        <>
          <label className="field">
            <span>Elements (0 … n−1)</span>
            <input type="number" min={2} max={16} value={nText} onChange={(e) => setNText(e.target.value)} />
          </label>
          <label className="field">
            <span>Operations — one per line</span>
            <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} className="mono" />
            <small>union a b · find a · connected a b (max 40)</small>
          </label>
          <div className="seg" role="radiogroup" aria-label="Union strategy">
            <button type="button" className={strategy === 'rank' ? 'on' : ''} onClick={() => setStrategy('rank')} aria-pressed={strategy === 'rank'}>
              Union by rank
            </button>
            <button type="button" className={strategy === 'size' ? 'on' : ''} onClick={() => setStrategy('size')} aria-pressed={strategy === 'size'}>
              Union by size
            </button>
          </div>
          <label className="check">
            <input type="checkbox" checked={compression} onChange={(e) => setCompression(e.target.checked)} />
            <span>Path compression</span>
          </label>
        </>
      }
      legend={
        <>
          <span className="lg">
            <i className="dot fill-teal" /> On the find path
          </span>
          <span className="lg">
            <i className="dot ring-magenta" /> Root being united
          </span>
          <span className="lg">
            <i className="bar magenta" /> Pointer just changed
          </span>
        </>
      }
      canvas={step && <DsuCanvas state={step.state} ops={input.ops} strategy={input.strategy} ms={player.stepMs} />}
      result={
        <ul className="kv">
          <li className="hero">
            <span>Components</span>
            <b>{r.components}</b>
          </li>
          <li>
            <span>Pointer hops</span>
            <b>{r.pointerHops}</b>
          </li>
          <li className="wide">
            <span>Sets</span>
            <b className="mono small">{r.sets.map((s) => `{${s.join(',')}}`).join('  ')}</b>
          </li>
          <li className="wide">
            <span>Answers</span>
            <b className="mono small">
              {r.answers.map((a, i) => (
                <span key={i} className="path-line">
                  {a}
                </span>
              ))}
            </b>
          </li>
        </ul>
      }
      complexity={[
        { label: 'Find / Union', value: 'O(α(n)) amortised with both optimisations' },
        { label: 'Rank/size only', value: 'O(log n)' },
        { label: 'Neither', value: 'O(n) worst case' },
        { label: 'Space', value: 'O(n)' },
      ]}
    />
  );
}

function DsuCanvas({ state, ops, strategy, ms }: { state: DsuState; ops: DsuOp[]; strategy: UnionStrategy; ms: number }) {
  const n = state.parent.length;
  const layout = useMemo(() => {
    const children: number[][] = Array.from({ length: n }, () => []);
    const roots: number[] = [];
    state.parent.forEach((p, i) => (p === i ? roots.push(i) : children[p].push(i)));
    const leaves = (v: number): number => (children[v].length ? children[v].reduce((a, c) => a + leaves(c), 0) : 1);
    const total = roots.reduce((a, r) => a + leaves(r), 0);
    const W = Math.max(560, total * 56);
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
    roots.forEach((r) => place(r, 0));
    const H = Math.max(220, (maxD + 1) * 74 + 50);
    const out: Points = {};
    for (const k in pos) out[k] = { x: 20 + (pos[k].x / total) * (W - 40), y: 40 + pos[k].y * 74 };
    return { pos: out, W, H };
  }, [state.parent, n]);
  const p = useTweenedPoints(layout.pos, Math.min(520, ms * 0.8));
  const path = new Set(state.path);
  const roots = new Set(state.roots);
  const changed = new Set(state.changed);
  const op = state.opIndex >= 0 && state.opIndex < ops.length ? ops[state.opIndex] : null;

  return (
    <div className="canvas-wrap">
      <div className="canvas-badges">
        <span className="canvas-badge">
          Components <b>{state.components}</b>
        </span>
        {op && (
          <span className="canvas-badge magenta">
            Op {state.opIndex + 1}/{ops.length} <b>{opText(op)}</b>
          </span>
        )}
      </div>
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
          const onPath = path.has(i) && path.has(par);
          return (
            <line
              key={`e${i}`}
              x1={a.x + ux * 18}
              y1={a.y + uy * 18}
              x2={b.x - ux * 22}
              y2={b.y - uy * 22}
              className={`dsu-edge ${hot ? 'hot' : ''} ${onPath ? 'path' : ''}`}
              markerEnd={`url(#${hot ? 'dsu-arrow-hot' : 'dsu-arrow'})`}
            />
          );
        })}
        {state.parent.map((par, i) => {
          const pt = p[i];
          if (!pt) return null;
          return (
            <g key={i} transform={`translate(${pt.x} ${pt.y})`} className={`dsu-node ${path.has(i) ? 'path' : ''} ${par === i ? 'root' : ''}`}>
              {state.current === i && <circle r={25} className="halo-teal" />}
              {roots.has(i) && <circle r={23} className="halo-magenta" />}
              <circle r={17} className="dsu-body" />
              <text dy="0.35em" textAnchor="middle" className="node-label">
                {i}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="array-table" role="table" aria-label="Parent array">
        <div className="arr-row head" role="row">
          <span role="rowheader">i</span>
          {state.parent.map((_, i) => (
            <span key={i} role="cell" className={path.has(i) ? 'path' : ''}>
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
          <span role="rowheader">{strategy}</span>
          {(strategy === 'rank' ? state.rank : state.size).map((v, i) => (
            <span key={i} role="cell" className={state.parent[i] === i ? '' : 'dim'}>
              {v}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
