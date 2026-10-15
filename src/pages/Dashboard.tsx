import { useNavigate } from 'react-router-dom';
import { APP_CONFIG } from '../config';
import { Icon } from '../components/Icon';

const NODES = [
  [60, 120],
  [150, 50],
  [170, 180],
  [270, 100],
  [330, 200],
  [380, 60],
];
const LINKS = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 3],
  [2, 4],
  [3, 5],
  [3, 4],
];

export default function Dashboard() {
  const nav = useNavigate();
  const c = APP_CONFIG;
  const rows: [string, string][] = [
    ['Project', c.projectTitle],
    ['Author', c.author],
    ['Institution', c.institution],
    ['Course', c.course],
    ['Roll / ID', c.rollNumber],
    ['Version', `v${c.version} · ${c.year}`],
  ];
  return (
    <main className="dash">
      <div className="dash-bg" aria-hidden="true">
        <div className="glow g1" />
        <div className="glow g2" />
        <div className="grid-lines" />
      </div>

      <div className="dash-inner">
        <div className="dash-left">
          <span className="dash-kicker reveal" style={{ animationDelay: '0.05s' }}>
            <span className="live-dot" /> Project Dashboard
          </span>
          <h1 className="dash-title reveal" style={{ animationDelay: '0.15s' }}>
            {c.appName.split(' ').map((w, i, a) => (
              <span key={i} className={i === a.length - 1 ? 'grad' : ''}>
                {w}
                {i < a.length - 1 ? ' ' : ''}
              </span>
            ))}
          </h1>
          <p className="dash-sub reveal" style={{ animationDelay: '0.25s' }}>
            Six classic algorithms, executed for real and replayed step by step.
          </p>
          <div className="app-id reveal" style={{ animationDelay: '0.35s' }}>
            <span>APP ID</span>
            <code>{c.appId}</code>
          </div>
          <button className="btn btn-primary btn-xl reveal" style={{ animationDelay: '0.45s' }} onClick={() => nav('/lab')} autoFocus>
            Enter the lab <Icon name="arrowRight" />
          </button>
        </div>

        <div className="dash-right reveal" style={{ animationDelay: '0.3s' }}>
          <svg viewBox="0 0 440 240" className="dash-graph" aria-hidden="true">
            {LINKS.map(([a, b], i) => (
              <line
                key={i}
                x1={NODES[a][0]}
                y1={NODES[a][1]}
                x2={NODES[b][0]}
                y2={NODES[b][1]}
                className="dg-line"
                style={{ animationDelay: `${0.5 + i * 0.12}s` }}
              />
            ))}
            {NODES.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={i === 0 || i === 5 ? 11 : 8} className={`dg-node ${i === 0 ? 'm' : i === 5 ? 't' : ''}`} style={{ animationDelay: `${0.3 + i * 0.1}s` }} />
            ))}
          </svg>
          <dl className="id-card">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <footer className="dash-foot">
        <span>Red-Black Tree · Ford–Fulkerson · Edmonds–Karp · N-Queens · DSU · Bucket Sort</span>
      </footer>
    </main>
  );
}
