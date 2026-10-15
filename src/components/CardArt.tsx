/** Small static illustrations for the landing-page cards. */
export function CardArt({ slug }: { slug: string }) {
  switch (slug) {
    case 'red-black-tree':
      return (
        <svg viewBox="0 0 160 90" className="card-art">
          <g className="art-lines">
            <line x1="80" y1="18" x2="45" y2="48" />
            <line x1="80" y1="18" x2="115" y2="48" />
            <line x1="45" y1="48" x2="25" y2="76" />
            <line x1="45" y1="48" x2="65" y2="76" />
            <line x1="115" y1="48" x2="135" y2="76" />
          </g>
          <circle cx="80" cy="18" r="10" className="art-black" />
          <circle cx="45" cy="48" r="10" className="art-red" />
          <circle cx="115" cy="48" r="10" className="art-black" />
          <circle cx="25" cy="76" r="9" className="art-black" />
          <circle cx="65" cy="76" r="9" className="art-black" />
          <circle cx="135" cy="76" r="9" className="art-red art-pulse" />
        </svg>
      );
    case 'ford-fulkerson':
    case 'edmonds-karp': {
      const bfs = slug === 'edmonds-karp';
      return (
        <svg viewBox="0 0 160 90" className="card-art">
          {bfs && (
            <g className="art-rings">
              <circle cx="18" cy="45" r="34" />
              <circle cx="18" cy="45" r="70" />
              <circle cx="18" cy="45" r="110" />
            </g>
          )}
          <g className="art-lines">
            <line x1="18" y1="45" x2="62" y2="18" />
            <line x1="18" y1="45" x2="62" y2="72" />
            <line x1="62" y1="18" x2="104" y2="18" />
            <line x1="62" y1="72" x2="104" y2="72" />
            <line x1="62" y1="72" x2="104" y2="18" />
            <line x1="104" y1="18" x2="142" y2="45" />
            <line x1="104" y1="72" x2="142" y2="45" />
          </g>
          <polyline
            points={bfs ? '18,45 62,18 104,18 142,45' : '18,45 62,72 104,18 142,45'}
            className="art-path"
          />
          {[
            [18, 45],
            [62, 18],
            [62, 72],
            [104, 18],
            [104, 72],
            [142, 45],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="7" className={i === 0 || i === 5 ? 'art-accent' : 'art-node'} />
          ))}
        </svg>
      );
    }
    case 'n-queens':
      return (
        <svg viewBox="0 0 160 90" className="card-art">
          <g transform="translate(44 3)">
            {Array.from({ length: 16 }, (_, i) => (
              <rect key={i} x={(i % 4) * 21} y={Math.floor(i / 4) * 21} width="21" height="21" className={(i % 4) + Math.floor(i / 4) * 1 ? (((i % 4) + Math.floor(i / 4)) % 2 ? 'art-sq-d' : 'art-sq-l') : 'art-sq-l'} />
            ))}
            {[1, 3, 0, 2].map((c, r) => (
              <circle key={r} cx={c * 21 + 10.5} cy={r * 21 + 10.5} r="6" className={r === 3 ? 'art-red art-pulse' : 'art-accent'} />
            ))}
          </g>
        </svg>
      );
    case 'disjoint-set-union':
      return (
        <svg viewBox="0 0 160 90" className="card-art">
          <g className="art-lines">
            <line x1="40" y1="22" x2="22" y2="62" />
            <line x1="40" y1="22" x2="58" y2="62" />
            <line x1="118" y1="22" x2="104" y2="62" />
            <line x1="118" y1="22" x2="136" y2="62" />
          </g>
          <path d="M118,22 Q80,0 46,18" className="art-path" />
          <circle cx="40" cy="22" r="9" className="art-accent" />
          <circle cx="22" cy="62" r="8" className="art-node" />
          <circle cx="58" cy="62" r="8" className="art-node" />
          <circle cx="118" cy="22" r="9" className="art-red" />
          <circle cx="104" cy="62" r="8" className="art-node" />
          <circle cx="136" cy="62" r="8" className="art-node" />
        </svg>
      );
    case 'bucket-sort':
      return (
        <svg viewBox="0 0 160 90" className="card-art">
          {[0, 1, 2].map((b) => (
            <path key={b} d={`M${18 + b * 46},40 v40 h36 v-40`} className="art-bucket" />
          ))}
          {[
            [22, 66, 12],
            [36, 60, 18],
            [68, 56, 22],
            [82, 50, 28],
            [114, 46, 32],
            [128, 40, 38],
          ].map(([x, y, h], i) => (
            <rect key={i} x={x} y={y + (38 - h) - 12} width="9" height={h} rx="2" className={i % 2 ? 'art-accent-fill' : 'art-node-fill'} />
          ))}
          {[30, 52, 88, 120].map((x, i) => (
            <rect key={i} x={x} y="8" width="8" height={10 + i * 4} rx="2" className="art-drop" style={{ animationDelay: `${i * 0.25}s` }} />
          ))}
        </svg>
      );
    default:
      return null;
  }
}
