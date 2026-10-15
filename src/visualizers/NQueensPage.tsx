import { useMemo, useState } from 'react';
import { findAlgo } from '../algorithms';
import { AlgoShell } from '../components/AlgoShell';
import { attackedCells, QUEENS_PSEUDOCODE, runNQueens, type QueensState } from '../engine/nQueens';
import { usePlayer } from '../hooks/usePlayer';

export default function NQueensPage() {
  const meta = findAlgo('n-queens')!;
  const [nText, setNText] = useState('6');
  const [findAll, setFindAll] = useState(false);
  const [showAttacks, setShowAttacks] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState({ n: 6, all: false, autoplay: false });
  const trace = useMemo(() => runNQueens(input.n, input.all), [input]);
  const player = usePlayer(trace.steps.length, trace, input);

  const run = (nt = nText, all = findAll) => {
    const n = Number(nt);
    if (!Number.isInteger(n) || n < 1 || n > 12) return setError('Board size must be a whole number from 1 to 12.');
    if (all && n > 8) return setError('"Find all solutions" is limited to n ≤ 8 to keep playback responsive. Use "first solution" for larger boards.');
    setError(null);
    setInput({ n, all, autoplay: true });
  };
  const randomize = () => {
    const n = 4 + Math.floor(Math.random() * 5);
    setNText(String(n));
    run(String(n), findAll);
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
      pseudocode={QUEENS_PSEUDOCODE}
      note={trace.truncated ? 'Very long search: later checks were condensed; every solution is still recorded.' : null}
      inputs={
        <>
          <label className="field">
            <span>Board size n</span>
            <input type="number" min={1} max={12} value={nText} onChange={(e) => setNText(e.target.value)} />
            <small>1–12. n = 2 and n = 3 have no solution.</small>
          </label>
          <div className="seg" role="radiogroup" aria-label="Search mode">
            <button type="button" className={!findAll ? 'on' : ''} onClick={() => setFindAll(false)} aria-pressed={!findAll}>
              First solution
            </button>
            <button type="button" className={findAll ? 'on' : ''} onClick={() => setFindAll(true)} aria-pressed={findAll}>
              All solutions
            </button>
          </div>
          <label className="check">
            <input type="checkbox" checked={showAttacks} onChange={(e) => setShowAttacks(e.target.checked)} />
            <span>Shade attacked squares</span>
          </label>
        </>
      }
      legend={
        <>
          <span className="lg">
            <i className="dot ring-teal" /> Square being tried
          </span>
          <span className="lg">
            <i className="bar magenta" /> Line of attack (conflict)
          </span>
          <span className="lg">
            <i className="dot fill-magenta" /> Attacked by a placed queen
          </span>
        </>
      }
      canvas={step && <Board state={step.state} showAttacks={showAttacks} />}
      result={
        <ul className="kv">
          <li className="hero">
            <span>{input.all ? 'Solutions' : 'Solution found'}</span>
            <b>{input.all ? r.solutions.length : r.solutions.length ? 'Yes' : 'None'}</b>
          </li>
          <li>
            <span>Placements</span>
            <b>{r.placements}</b>
          </li>
          <li>
            <span>Backtracks</span>
            <b>{r.backtracks}</b>
          </li>
          <li>
            <span>Safety checks</span>
            <b>{r.checks}</b>
          </li>
          {r.solutions[0] && (
            <li className="wide">
              <span>Columns by row</span>
              <b className="mono">{r.solutions[input.all ? r.solutions.length - 1 : 0].map((c) => c + 1).join(' ')}</b>
            </li>
          )}
        </ul>
      }
      complexity={[
        { label: 'Time (worst)', value: 'O(n!)' },
        { label: 'Safety check', value: 'O(n) per square' },
        { label: 'Space', value: 'O(n) board + recursion' },
      ]}
    />
  );
}

function Board({ state, showAttacks }: { state: QueensState; showAttacks: boolean }) {
  const { n, queens, trying, conflict } = state;
  const S = 60;
  const size = n * S;
  const attacked = useMemo(() => attackedCells(queens, n), [queens, n]);
  return (
    <div className="canvas-wrap">
      <div className="canvas-badges">
        <span className="canvas-badge">
          Row <b>{Math.min(state.row + 1, n)}</b> / {n}
        </span>
        <span className="canvas-badge">
          Queens <b>{queens.filter((q) => q >= 0).length}</b>
        </span>
        {state.solutionsFound > 0 && (
          <span className="canvas-badge magenta">
            Solutions <b>{state.solutionsFound}</b>
          </span>
        )}
      </div>
      <svg viewBox={`-28 -4 ${size + 32} ${size + 8}`} className="svg-canvas board" role="img" aria-label={`${n} by ${n} chess board`}>
        {Array.from({ length: n }, (_, r) =>
          Array.from({ length: n }, (_, c) => {
            const dark = (r + c) % 2 === 1;
            const att = showAttacks && attacked[r][c] && queens[r] !== c;
            return (
              <g key={`${r}-${c}`}>
                <rect x={c * S} y={r * S} width={S} height={S} className={`sq ${dark ? 'dark' : 'light'}`} />
                {att && (
                  <>
                    <rect x={c * S} y={r * S} width={S} height={S} className="sq-attacked" />
                    <circle cx={c * S + S / 2} cy={r * S + S / 2} r={4} className="sq-attacked-dot" />
                  </>
                )}
              </g>
            );
          }),
        )}
        {Array.from({ length: n }, (_, r) => (
          <text key={r} x={-14} y={r * S + S / 2} dy="0.35em" textAnchor="middle" className={`row-label ${r === state.row ? 'on' : ''}`}>
            {r + 1}
          </text>
        ))}
        {conflict && trying && (
          <line
            x1={conflict.c * S + S / 2}
            y1={conflict.r * S + S / 2}
            x2={trying.c * S + S / 2}
            y2={trying.r * S + S / 2}
            className="attack-line"
          />
        )}
        {trying && <rect x={trying.c * S + 3} y={trying.r * S + 3} width={S - 6} height={S - 6} rx={8} className={`try-box ${conflict ? 'bad' : 'ok'}`} />}
        {queens.map((c, r) =>
          c >= 0 ? (
            <g key={`q${r}`} transform={`translate(${c * S + S / 2} ${r * S + S / 2})`} className={`queen ${conflict && conflict.r === r ? 'attacker' : ''}`}>
              <Queen />
            </g>
          ) : null,
        )}
      </svg>
    </div>
  );
}

function Queen() {
  return (
    <g className="queen-glyph">
      <path d="M-16,12 L16,12 L13,4 L18,-10 L8,-2 L4,-15 L0,-4 L-4,-15 L-8,-2 L-18,-10 L-13,4 Z" />
      <rect x={-16} y={13} width={32} height={5} rx={2} />
    </g>
  );
}
