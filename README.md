# DSA Visual Lab

**Antriksha Jain** · App ID 2409038 · B.Tech in AI, ML & Computer Science · Atlas SkillTech University

Interactive, step-by-step visualisations of six classic algorithms. Every animation is driven by the algorithm's **real execution**: each engine runs on your input, records a snapshot after every operation, and the UI replays that trace forwards and backwards.

**Stack:** React 18 · TypeScript · Vite · React Router · Vitest. No UI or animation libraries; visuals are hand-built SVG and CSS.

---

## Features

- **Three-page flow:** animated project dashboard (app name, app ID, project identity) → landing page with an introduction to DSA and six algorithm cards → a dedicated visualiser per algorithm.
- **Your own inputs** with validation and specific error messages, plus **Randomize** where it makes sense.
- **Playback controls:** Run, Play/Pause, Previous/Next step, Reset, a scrubber, and speed from 0.25× to 8×.
- **Keyboard:** `Space` play/pause · `←` `→` step · `Home` reset · `End` jump to result.
- **Explanations:** every step has a one-line description, tagged as check / update / found / backtrack; the matching **pseudocode line** is highlighted; a clickable **step log** lets you jump anywhere.
- **Results and complexity:** final result panel and time/space complexity for each algorithm.
- **Responsive:** three-column desktop layout that collapses to a single column on phones. Respects `prefers-reduced-motion`.
- **Robust:** edge cases (empty or duplicate input, unreachable sink, n = 2/3 queens, identical values, single element, negatives and decimals) are handled without crashing. Very long traces are condensed so playback stays responsive.

## Algorithms

| Algorithm | What you see | Complexity |
|---|---|---|
| **Red-Black Tree** | BST descent, red leaf insertion, red-red violations, Case 1 recolouring, Case 2/3 rotations, root recolour. Insert keys one at a time or as a batch. | O(log n) per insert |
| **Ford–Fulkerson (DFS)** | Capacity graph with flow/capacity labels, DFS stack, skipped/visited edges, backtracking, augmenting path and bottleneck, backward residual edges, min cut. Optional residual-network view. | O(E · f\*) |
| **Edmonds–Karp (BFS)** | BFS queue, visited nodes and discovery tree, shortest augmenting paths, residual updates, max flow and min cut. | O(V · E²) |
| **N-Queens** | Configurable board (1–12), safety checks with the attacking queen and line of attack, placement and backtracking; first solution or all solutions (n ≤ 8). | O(n!) |
| **Disjoint Set Union** | Forest view plus parent and rank/size arrays; find paths, path compression, union by rank **or** size, live component count. | O(α(n)) amortised |
| **Bucket Sort** | User numbers (negatives and decimals OK), configurable bucket count, distribution with the index formula, insertion sort inside each bucket, collection into the output. | O(n + k) avg · O(n²) worst |

### Correctness notes

- Engines in `src/engine/` are **pure functions** with no React imports. They return `{ steps, result }`, and each step holds a full state snapshot, so Previous/Next and scrubbing are always consistent.
- Max flow uses a proper **residual network**: original edge *i* has a forward residual edge `2i` (cap − flow) and a backward one `2i+1` (flow). Ford–Fulkerson searches it with recursive **DFS**; Edmonds–Karp uses a **BFS queue** with parent pointers.
- `npm test` checks the engines against independent oracles: red-black invariants after every insertion (60 random trials), flow conservation and capacity limits, **max-flow = min-cut** and DFS/BFS agreement on 80 random networks, non-decreasing path lengths for Edmonds–Karp, known N-Queens counts (1, 0, 0, 2, 10, 4, 40, 92), DSU against a naive connectivity model for all four strategy combinations, and Bucket Sort against `Array.sort`.

## Project structure

```
src/
  config.ts              # App name, app ID and project identity (placeholders, env-overridable)
  algorithms.ts          # Card metadata for the six algorithms
  engine/                # Pure algorithm engines + tests (no UI code)
    redBlackTree.ts  maxFlow.ts  nQueens.ts  dsu.ts  bucketSort.ts  types.ts
    engine.test.ts
  hooks/
    usePlayer.ts         # Trace playback (play/pause/step/seek/speed)
    useTween.ts          # Smooth position interpolation for tree/forest layouts
  components/            # AlgoShell (shared visualiser layout + controls), icons, card art
  visualizers/           # One page per algorithm: inputs + SVG renderer
  pages/                 # Dashboard (page 1), Landing (page 2)
```

## Local setup

Requires Node.js 18+.

```bash
npm install
npm run dev        # http://localhost:5173
```

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc -b`) and build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the engine test suite (Vitest) |
| `npm run lint` | ESLint |

## Configuring the project identity

Edit the defaults in `src/config.ts`, or set environment variables (see `.env.example`):

```
VITE_APP_ID=2409038
VITE_AUTHOR=Antriksha Jain
VITE_INSTITUTION=Atlas SkillTech University
VITE_COURSE=B.Tech in AI, ML & Computer Science
VITE_ROLL_NUMBER=            # optional — leave empty to hide the row
```

Put local values in `.env.local`, which is git-ignored. No secrets are needed to run or deploy this app.

## Deploying to Vercel

The repo includes `vercel.json` (Vite framework preset, `dist/` output, and an SPA rewrite so deep links like `/lab/n-queens` work on refresh).

**Dashboard:** go to [vercel.com/new](https://vercel.com/new) → *Import* the GitHub repository → keep the detected settings (Framework *Vite*, Build `npm run build`, Output `dist`) → *Deploy*. Optionally add the `VITE_*` variables under *Settings → Environment Variables* and redeploy.

**CLI:**

```bash
npm i -g vercel
vercel          # first run links the project and creates a preview deployment
vercel --prod   # production deployment
```

## License

MIT
