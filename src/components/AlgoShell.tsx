import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { AlgoMeta } from '../algorithms';
import type { Step } from '../engine/types';
import { SPEEDS, type Player } from '../hooks/usePlayer';
import { Icon } from './Icon';

interface Props {
  meta: AlgoMeta;
  inputs: ReactNode;
  onRun: () => void;
  onRandomize?: () => void;
  error: string | null;
  canvas: ReactNode;
  legend?: ReactNode;
  steps: Step<unknown>[];
  player: Player;
  /** Source shown in the code panel; step.line indexes into lines. */
  code: { title: string; lines: string[] };
  result: ReactNode;
  complexity: { label: string; value: string }[];
  note?: string | null;
}

const TAG_LABEL: Record<Step<unknown>['tag'], string> = {
  info: 'Info',
  compare: 'Check',
  action: 'Update',
  success: 'Found',
  warn: 'Backtrack / Fix',
  done: 'Result',
};

export function AlgoShell(p: Props) {
  const { player, steps } = p;
  const step = steps[player.index];
  const atEnd = steps.length > 0 && player.index === steps.length - 1;
  const stageRef = useRef<HTMLDivElement>(null);
  // On narrow screens the canvas sits below the inputs, so bring it into view after Run.
  const revealStage = () => {
    if (window.innerWidth <= 860) setTimeout(() => stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  // Keyboard: space = play/pause, ←/→ = step, Home = reset, End = jump to end.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (e.key === ' ') {
        e.preventDefault();
        player.toggle();
      } else if (e.key === 'ArrowRight') player.next();
      else if (e.key === 'ArrowLeft') player.prev();
      else if (e.key === 'Home') player.reset();
      else if (e.key === 'End') player.seek(steps.length - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [player, steps.length]);

  return (
    <div className="algo-page">
      <header className="algo-head">
        <Link to="/lab" className="back-link">
          <Icon name="arrowLeft" /> All algorithms
        </Link>
        <div className="algo-title-row">
          <div>
            <span className={`eyebrow accent-${p.meta.accent}`}>{p.meta.category}</span>
            <h1>{p.meta.name}</h1>
          </div>
          <div className="complexity-pills">
            <span className="pill">
              <b>Time</b> {p.meta.time}
            </span>
            <span className="pill">
              <b>Space</b> {p.meta.space}
            </span>
          </div>
        </div>
      </header>

      <div className="algo-grid">
        <aside className="panel inputs-panel">
          <h2 className="panel-title">Input</h2>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              p.onRun();
              revealStage();
            }}
          >
            {p.inputs}
            {p.error && (
              <div className="error" role="alert">
                <Icon name="alert" /> {p.error}
              </div>
            )}
            <div className="btn-row">
              <button type="submit" className="btn btn-primary">
                <Icon name="play" /> Run
              </button>
              {p.onRandomize && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    p.onRandomize!();
                    revealStage();
                  }}
                >
                  <Icon name="shuffle" /> Randomize
                </button>
              )}
            </div>
          </form>
          {p.legend && <div className="legend legend-wide">{p.legend}</div>}
        </aside>

        <section className="stage-col">
          <div className="panel stage" ref={stageRef}>
            {steps.length ? p.canvas : <EmptyStage />}
          </div>
          {step && (
            <div className={`step-msg tag-${step.tag}`} aria-live="polite">
              <span className="step-tag">{TAG_LABEL[step.tag]}</span>
              <span className="step-text">{step.message}</span>
            </div>
          )}
          {p.note && <div className="note">{p.note}</div>}
          <Controls player={player} />
          <CodePanel code={p.code} line={step?.line} />
          {p.legend && <div className="panel legend legend-narrow">{p.legend}</div>}
        </section>

        <aside className="side-col">
          <div className="panel">
            <h2 className="panel-title">
              Result
              {!atEnd && steps.length > 0 && (
                <button className="link-btn" onClick={() => player.seek(steps.length - 1)}>
                  Skip to end
                </button>
              )}
            </h2>
            {atEnd ? (
              <div className="result">{p.result}</div>
            ) : (
              <p className="muted small">The final result appears when playback reaches the last step.</p>
            )}
            <dl className="cx-table">
              {p.complexity.map((c) => (
                <div key={c.label}>
                  <dt>{c.label}</dt>
                  <dd>{c.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="panel">
            <h2 className="panel-title">Step log</h2>
            <StepLog steps={steps} index={player.index} onSeek={player.seek} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function CodePanel({ code, line }: { code: { title: string; lines: string[] }; line?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  // Keep the active line in view by scrolling the panel only (never the page).
  useEffect(() => {
    const box = ref.current;
    const el = box?.querySelector<HTMLElement>('.on');
    if (!box || !el) return;
    const top = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2;
    box.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, [line]);
  return (
    <div className="panel code-panel">
      <h2 className="panel-title">
        {code.title}
        <span className="code-hint">highlighted line = what's running now</span>
      </h2>
      <div className="code-box" ref={ref}>
        <pre>
          {code.lines.map((l, i) => (
            <div key={i} className={`code-line ${line === i ? 'on' : ''}`}>
              <span className="ln">{i + 1}</span>
              <code>{l || ' '}</code>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

function EmptyStage() {
  return (
    <div className="empty-stage">
      <Icon name="spark" />
      <p>Enter an input and press Run to record the algorithm's steps.</p>
    </div>
  );
}

function Controls({ player }: { player: Player }) {
  const disabled = player.total === 0;
  return (
    <div className="controls panel">
      <div className="ctl-buttons">
        <button className="icon-btn" onClick={player.reset} disabled={disabled} title="Reset (Home)" aria-label="Reset">
          <Icon name="reset" />
        </button>
        <button className="icon-btn" onClick={player.prev} disabled={disabled || player.index === 0} title="Previous step (←)" aria-label="Previous step">
          <Icon name="prev" />
        </button>
        <button className="icon-btn big" onClick={player.toggle} disabled={disabled} title="Play / Pause (Space)" aria-label={player.playing ? 'Pause' : 'Play'}>
          <Icon name={player.playing ? 'pause' : 'play'} />
        </button>
        <button
          className="icon-btn"
          onClick={player.next}
          disabled={disabled || player.index >= player.total - 1}
          title="Next step (→)"
          aria-label="Next step"
        >
          <Icon name="next" />
        </button>
      </div>
      <input
        className="scrub"
        type="range"
        min={0}
        max={Math.max(0, player.total - 1)}
        value={player.index}
        onChange={(e) => player.seek(Number(e.target.value))}
        disabled={disabled}
        aria-label="Step"
        style={{ ['--pct' as string]: `${player.total > 1 ? (player.index / (player.total - 1)) * 100 : 0}%` }}
      />
      <span className="counter">
        {player.total ? player.index + 1 : 0}
        <span className="dim"> / {player.total}</span>
      </span>
      <label className="speed">
        <span>Speed</span>
        <select value={player.speed} onChange={(e) => player.setSpeed(Number(e.target.value))}>
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function StepLog({ steps, index, onSeek }: { steps: Step<unknown>[]; index: number; onSeek: (i: number) => void }) {
  const ref = useRef<HTMLOListElement>(null);
  const WINDOW = 40;
  const start = Math.max(0, index - WINDOW);
  const end = Math.min(steps.length, index + WINDOW);
  const items = useMemo(() => steps.slice(start, end).map((s, k) => ({ s, i: start + k })), [steps, start, end]);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('.on');
    const list = ref.current;
    if (el && list) list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2;
  }, [index]);
  if (!steps.length) return <p className="muted small">No steps yet.</p>;
  return (
    <ol className="step-log" ref={ref}>
      {items.map(({ s, i }) => (
        <li key={i} className={`${i === index ? 'on' : ''} ${i > index ? 'future' : ''} tag-${s.tag}`}>
          <button onClick={() => onSeek(i)}>
            <span className="n">{i + 1}</span>
            <span>{s.message}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
