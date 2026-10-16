import { useMemo, useState } from 'react';
import { findAlgo } from '../algorithms';
import { AlgoShell } from '../components/AlgoShell';
import { RB_CODE, runRedBlackTree, type RBState } from '../engine/redBlackTree';
import { parseNumberList, randInt, rng } from '../engine/types';
import { usePlayer } from '../hooks/usePlayer';
import { useTweenedPoints, type Points } from '../hooks/useTween';

// Same keys as main() in the Java notes.
const DEFAULT = '10 5 15 12 3 7 18 1 6';

export default function RedBlackTreePage() {
  const meta = findAlgo('red-black-tree')!;
  const [text, setText] = useState(DEFAULT);
  const [single, setSingle] = useState('');
  const [input, setInput] = useState<{ keys: number[]; start: number; autoplay: boolean }>(() => ({
    keys: DEFAULT.split(' ').map(Number),
    start: 0,
    autoplay: false,
  }));
  const keys = input.keys;
  const [error, setError] = useState<string | null>(null);
  const trace = useMemo(() => runRedBlackTree(input.keys), [input]);
  const player = usePlayer(trace.steps.length, trace, input);

  const run = (src = text) => {
    const r = parseNumberList(src, { integer: true, min: -999, max: 999, maxCount: 31, minCount: 1 });
    if (!r.ok) return setError(r.error);
    setError(null);
    setInput({ keys: r.value, start: 0, autoplay: true });
  };

  const randomize = () => {
    const g = rng();
    const n = randInt(g, 7, 14);
    const set = new Set<number>();
    while (set.size < n) set.add(randInt(g, 1, 99));
    const s = [...set].join(' ');
    setText(s);
    run(s);
  };

  const insertOne = () => {
    const v = Number(single);
    if (single.trim() === '' || !Number.isInteger(v) || v < -999 || v > 999) return setError('Enter a whole number from −999 to 999 to insert.');
    if (keys.length >= 31) return setError('Tree is limited to 31 keys for readability. Reset with a shorter list.');
    setError(null);
    const next = [...keys, v];
    setText(next.join(' '));
    setSingle('');
    // Jump straight to where the new key's insertion begins.
    setInput({ keys: next, start: runRedBlackTree(next).result.keyStart[next.length - 1], autoplay: true });
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
      code={RB_CODE}
      inputs={
        <>
          <label className="field">
            <span>Keys to insert (in order)</span>
            <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. 10 20 30 15 25" spellCheck={false} />
            <small>Whole numbers −999…999, up to 31. Duplicates are skipped.</small>
          </label>
          <div className="field inline">
            <input
              value={single}
              onChange={(e) => setSingle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  insertOne();
                }
              }}
              placeholder="Insert one key…"
              inputMode="numeric"
              aria-label="Insert one key"
            />
            <button type="button" className="btn btn-ghost sm" onClick={insertOne}>
              Insert
            </button>
          </div>
        </>
      }
      legend={
        <>
          <span className="lg">
            <i className="dot rb-red" /> Red node
          </span>
          <span className="lg">
            <i className="dot rb-black" /> Black node
          </span>
          <span className="lg">
            <i className="dot ring-teal" /> Current (z)
          </span>
          <span className="lg">
            <i className="dot ring-magenta" /> Parent / uncle / grandparent
          </span>
          <span className="lg muted">Empty children are black NIL leaves (not drawn).</span>
        </>
      }
      canvas={step && <RBCanvas state={step.state} ms={player.stepMs} />}
      result={
        <ul className="kv">
          <li>
            <span>Nodes</span>
            <b>{r.size}</b>
          </li>
          <li>
            <span>Height (edges)</span>
            <b>{r.height}</b>
          </li>
          <li>
            <span>Black-height</span>
            <b>{r.blackHeight}</b>
          </li>
          <li>
            <span>Rotations</span>
            <b>{r.rotations}</b>
          </li>
          <li>
            <span>Recolours</span>
            <b>{r.recolors}</b>
          </li>
          {r.duplicates.length > 0 && (
            <li>
              <span>Skipped duplicates</span>
              <b>{r.duplicates.join(', ')}</b>
            </li>
          )}
          <li className="wide">
            <span>In-order</span>
            <b className="mono">{r.inorder.join(' · ') || '—'}</b>
          </li>
        </ul>
      }
      complexity={[
        { label: 'Insert', value: 'O(log n)' },
        { label: 'Rotations per insert', value: '≤ 2' },
        { label: 'Height bound', value: '≤ 2·log₂(n+1)' },
        { label: 'Space', value: 'O(n)' },
      ]}
    />
  );
}

function RBCanvas({ state, ms }: { state: RBState; ms: number }) {
  const { nodes, root } = state;
  const layout = useMemo(() => {
    const pos: Points = {};
    let i = 0;
    let maxDepth = 0;
    const walk = (id: number | null, d: number) => {
      if (id === null) return;
      walk(nodes[id].left, d + 1);
      pos[id] = { x: i++, y: d };
      maxDepth = Math.max(maxDepth, d);
      walk(nodes[id].right, d + 1);
    };
    walk(root, 0);
    const count = Math.max(1, i);
    const W = Math.max(520, count * 52);
    const H = Math.max(260, (maxDepth + 1) * 78 + 40);
    const out: Points = {};
    for (const k in pos) out[k] = { x: count === 1 ? W / 2 : 36 + (pos[k].x / (count - 1)) * (W - 72), y: 44 + pos[k].y * 78 };
    return { pos: out, W, H };
  }, [nodes, root]);

  const p = useTweenedPoints(layout.pos, Math.min(520, ms * 0.8));
  const ids = Object.keys(nodes).map(Number);
  const related = new Set(state.related);

  if (!ids.length)
    return (
      <div className="empty-stage">
        <p>The tree is empty. Insert a key to begin.</p>
      </div>
    );

  return (
    <div className="canvas-wrap">
      {state.inserting !== null && (
        <div className="canvas-badge">
          Inserting <b>{state.inserting}</b>
        </div>
      )}
      <svg viewBox={`0 0 ${layout.W} ${layout.H}`} className="svg-canvas" role="img" aria-label="Red-black tree">
        {ids.map((id) => {
          const n = nodes[id];
          if (n.parent === null || !p[id] || !p[n.parent]) return null;
          return <line key={`e${id}`} x1={p[n.parent].x} y1={p[n.parent].y} x2={p[id].x} y2={p[id].y} className="tree-edge" />;
        })}
        {ids.map((id) => {
          const n = nodes[id];
          const pt = p[id];
          if (!pt) return null;
          const isCur = state.current === id;
          const isRel = related.has(id);
          const pivot = state.rotation?.pivot === id;
          return (
            <g key={id} transform={`translate(${pt.x} ${pt.y})`} className="rb-node">
              {isCur && <circle r={27} className="halo-teal" />}
              {isRel && !isCur && <circle r={25} className="halo-magenta" />}
              <circle r={19} className={n.color === 'R' ? 'rb-fill-red' : 'rb-fill-black'} />
              <text dy="0.35em" textAnchor="middle" className="node-label">
                {n.key}
              </text>
              {pivot && (
                <text y={-32} textAnchor="middle" className="rot-label">
                  {state.rotation!.dir === 'left' ? '↺ rotate left' : '↻ rotate right'}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
