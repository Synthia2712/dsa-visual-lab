import { useMemo, useState } from 'react';
import { findAlgo } from '../algorithms';
import { AlgoShell } from '../components/AlgoShell';
import { BUCKET_CODE, formatNum, randomBucketInput, runBucketSort, type BucketMode, type BucketState, type Item } from '../engine/bucketSort';
import { parseNumberList } from '../engine/types';
import { usePlayer } from '../hooks/usePlayer';

// The worked example from the notes.
const DEFAULT = '0.42 0.37 0.33 0.32 0.14 0.12 0.56 0.24 0.29 0.91';

export default function BucketSortPage() {
  const meta = findAlgo('bucket-sort')!;
  const [text, setText] = useState(DEFAULT);
  const [mode, setMode] = useState<BucketMode>('notes');
  const [kText, setKText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState(() => ({ values: DEFAULT.split(' ').map(Number), k: 10, mode: 'notes' as BucketMode, autoplay: false }));
  const trace = useMemo(() => runBucketSort(input.values, input.k, input.mode), [input]);
  const player = usePlayer(trace.steps.length, trace, input);

  const run = (t = text, kt = kText, m = mode) => {
    const p = parseNumberList(t, { maxCount: 40, minCount: 1 });
    if (!p.ok) return setError(p.error);
    let k = 10;
    if (m === 'notes') {
      const bad = p.value.find((v) => v < 0 || v >= 1);
      if (bad !== undefined)
        return setError(`${bad} is outside 0 ≤ value < 1, so floor(value × 10) would not be a bucket 0–9. Use values like 0.42, or switch to "Any range".`);
    } else {
      k = Math.max(1, Math.round(Math.sqrt(p.value.length)));
      if (kt.trim() !== '') {
        const v = Number(kt);
        if (!Number.isInteger(v) || v < 1 || v > 20) return setError('Bucket count must be a whole number from 1 to 20 (or blank for √n).');
        k = v;
      }
    }
    setError(null);
    setInput({ values: p.value, k, mode: m, autoplay: true });
  };
  const randomize = () => {
    const t = randomBucketInput(mode).join(' ');
    setText(t);
    run(t);
  };

  const step = trace.steps[player.index];
  const r = trace.result;
  const lo = input.mode === 'notes' ? 0 : Math.min(...input.values);
  const hi = input.mode === 'notes' ? 1 : Math.max(...input.values);
  const show = (b: number[][]) =>
    b.map((x, i) => (
      <span key={i} className="path-line">
        Bucket {i} → [{x.map(formatNum).join(', ')}]
      </span>
    ));

  return (
    <AlgoShell
      meta={meta}
      error={error}
      onRun={() => run()}
      onRandomize={randomize}
      steps={trace.steps}
      player={player}
      code={BUCKET_CODE}
      inputs={
        <>
          <div className="seg" role="radiogroup" aria-label="Bucket formula">
            <button type="button" className={mode === 'notes' ? 'on' : ''} onClick={() => setMode('notes')} aria-pressed={mode === 'notes'}>
              Notes: ⌊value × 10⌋
            </button>
            <button type="button" className={mode === 'range' ? 'on' : ''} onClick={() => setMode('range')} aria-pressed={mode === 'range'}>
              Any range
            </button>
          </div>
          <label className="field">
            <span>Numbers to sort</span>
            <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} className="mono" />
            <small>
              {mode === 'notes'
                ? 'Up to 40 values with 0 ≤ value < 1 (10 buckets, like the notes).'
                : 'Up to 40 values; negatives and decimals allowed. Buckets span min…max.'}
            </small>
          </label>
          {mode === 'range' && (
            <label className="field">
              <span>Bucket count k</span>
              <input type="number" min={1} max={20} value={kText} onChange={(e) => setKText(e.target.value)} placeholder="auto (≈ √n)" />
            </label>
          )}
        </>
      }
      legend={
        <>
          <span className="lg">
            <i className="dot fill-teal" /> Value being placed
          </span>
          <span className="lg">
            <i className="dot ring-magenta" /> Pair being compared
          </span>
          <span className="lg muted">Bar height shows each value's size.</span>
        </>
      }
      canvas={step && <BucketCanvas state={step.state} lo={lo} hi={hi} />}
      result={
        <ul className="kv">
          <li>
            <span>Buckets (k)</span>
            <b>{r.k}</b>
          </li>
          <li>
            <span>Largest bucket</span>
            <b>{Math.max(...r.bucketSizes)}</b>
          </li>
          <li>
            <span>Comparisons</span>
            <b>{r.comparisons}</b>
          </li>
          <li>
            <span>Swaps</span>
            <b>{r.shifts}</b>
          </li>
          <li className="wide">
            <span>Step 2 — after distributing</span>
            <b className="mono small">{show(r.distributed)}</b>
          </li>
          <li className="wide">
            <span>Step 3 — after sorting each bucket</span>
            <b className="mono small">{show(r.sortedBuckets)}</b>
          </li>
          <li className="wide">
            <span>Step 4 — concatenated</span>
            <b className="mono small">[{r.sorted.map(formatNum).join(', ')}]</b>
          </li>
        </ul>
      }
      complexity={[
        { label: 'Distribute', value: 'O(n)' },
        { label: 'Concatenate', value: 'O(n)' },
        { label: 'Average', value: 'O(n + k)' },
        { label: 'Worst (insertion sort)', value: 'O(n²) — all in one bucket' },
        { label: 'Worst (Collections.sort)', value: 'O(n log n)' },
        { label: 'Space', value: 'O(n + k)' },
      ]}
    />
  );
}

function Chip({ it, lo, hi, cls }: { it: Item; lo: number; hi: number; cls?: string }) {
  const h = hi === lo ? 1 : (it.v - lo) / (hi - lo);
  return (
    <span className={`num-chip ${cls ?? ''}`}>
      <i className="num-bar" style={{ ['--h' as string]: `${12 + h * 88}%` }} />
      <b>{formatNum(it.v)}</b>
    </span>
  );
}

function BucketCanvas({ state, lo, hi }: { state: BucketState; lo: number; hi: number }) {
  const placed = new Set(state.placed);
  const cmp = new Set(state.compare ?? []);
  const phases: BucketState['phase'][] = ['distribute', 'sort', 'collect'];
  return (
    <div className="canvas-wrap bucket-canvas">
      <div className="canvas-badges">
        {phases.map((ph, i) => (
          <span key={ph} className={`canvas-badge phase ${state.phase === ph ? 'magenta' : ''} ${phases.indexOf(state.phase) > i || state.phase === 'done' ? 'past' : ''}`}>
            {i + 1}. {ph[0].toUpperCase() + ph.slice(1)}
          </span>
        ))}
      </div>
      <div className="zone">
        <div className="zone-label">Input</div>
        <div className="chip-row">
          {state.input.map((it) => (
            <Chip key={it.id} it={it} lo={lo} hi={hi} cls={`${placed.has(it.id) ? 'gone' : ''} ${state.activeId === it.id ? 'active' : ''}`} />
          ))}
        </div>
      </div>
      <div className="zone">
        <div className="zone-label">Buckets</div>
        <div className="bucket-row">
          {state.buckets.map((b, i) => (
            <div key={i} className={`bucket ${state.activeBucket === i ? 'on' : ''}`}>
              <div className="bucket-items">
                {b.map((it) => (
                  <Chip
                    key={it.id}
                    it={it}
                    lo={lo}
                    hi={hi}
                    cls={`pop ${state.activeId === it.id ? 'active' : ''} ${cmp.has(it.id) ? (state.swapped ? 'swapped' : 'cmp') : ''}`}
                  />
                ))}
                {!b.length && <span className="bucket-empty">·</span>}
              </div>
              <div className="bucket-foot">
                <b>B{i}</b>
                <span>
                  [{formatNum(+state.ranges[i][0].toFixed(2))}, {formatNum(+state.ranges[i][1].toFixed(2))}
                  {i === state.buckets.length - 1 ? ']' : ')'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="zone">
        <div className="zone-label">Output</div>
        <div className="chip-row">
          {state.output.length ? (
            state.output.map((it) => <Chip key={it.id} it={it} lo={lo} hi={hi} cls="pop done" />)
          ) : (
            <span className="muted small">Filled during the collect phase.</span>
          )}
        </div>
      </div>
    </div>
  );
}
