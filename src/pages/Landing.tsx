import { Link } from 'react-router-dom';
import { ALGORITHMS } from '../algorithms';
import { CardArt } from '../components/CardArt';
import { Icon } from '../components/Icon';

export default function Landing() {
  return (
    <main className="landing">
      <section className="hero">
        <span className="eyebrow accent-teal">Data Structures &amp; Algorithms</span>
        <h1>
          See how algorithms <span className="grad">actually think.</span>
        </h1>
        <div className="hero-cols">
          <p>
            <b>Data structures</b> organise information so it can be used efficiently; <b>algorithms</b> are precise step-by-step procedures that
            operate on them. Together they decide whether a program answers in milliseconds or minutes.
          </p>
          <p>
            This lab runs each algorithm on <b>your input</b>, records every comparison, rotation, push and backtrack, and lets you replay the run
            forwards and backwards. Nothing is pre-animated: what you see is the real execution.
          </p>
        </div>
        <ul className="hero-stats">
          <li>
            <b>6</b>
            <span>algorithms</span>
          </li>
          <li>
            <b>Step</b>
            <span>by step replay</span>
          </li>
          <li>
            <b>Your</b>
            <span>own inputs</span>
          </li>
        </ul>
      </section>

      <section className="cards" aria-label="Algorithms">
        {ALGORITHMS.map((a, i) => (
          <Link key={a.slug} to={`/lab/${a.slug}`} className={`algo-card accent-${a.accent}`} style={{ animationDelay: `${0.05 * i}s` }}>
            <div className="card-top">
              <span className="card-num">0{i + 1}</span>
              <span className="card-cat">{a.category}</span>
            </div>
            <CardArt slug={a.slug} />
            <h2>{a.name}</h2>
            <p>{a.blurb}</p>
            <div className="card-foot">
              <span className="mono">{a.time}</span>
              <span className="open">
                Open <Icon name="arrowRight" size={14} />
              </span>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
