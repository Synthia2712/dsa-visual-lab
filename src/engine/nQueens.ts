import type { Step, Trace } from './types';

export interface QueensState {
  n: number;
  /** queens[row] = column, or -1 when the row is empty. */
  queens: number[];
  trying: { r: number; c: number } | null;
  conflict: { r: number; c: number; reason: 'column' | 'diagonal' } | null;
  solutionsFound: number;
  row: number;
}

export interface QueensResult {
  solutions: number[][];
  placements: number;
  backtracks: number;
  checks: number;
  complete: boolean;
}

export const QUEENS_PSEUDOCODE = [
  'solve(row): if row == n → record solution',
  '  for col in 0..n−1:',
  '    if (row, col) is attacked by an earlier queen → skip',
  '    place queen at (row, col)',
  '    solve(row + 1)',
  '    remove queen (backtrack)',
];

const STEP_LIMIT = 20000;

export function runNQueens(n: number, findAll: boolean): Trace<QueensState, QueensResult> {
  const steps: Step<QueensState>[] = [];
  const queens = new Array<number>(n).fill(-1);
  const solutions: number[][] = [];
  let placements = 0;
  let backtracks = 0;
  let checks = 0;
  let truncated = false;
  let stop = false;

  const snap = (
    message: string,
    tag: Step<QueensState>['tag'],
    line: number | undefined,
    row: number,
    trying: QueensState['trying'] = null,
    conflict: QueensState['conflict'] = null,
    force = false,
  ) => {
    if (!force && steps.length >= STEP_LIMIT) {
      truncated = true;
      return;
    }
    steps.push({
      state: { n, queens: queens.slice(), trying, conflict, solutionsFound: solutions.length, row },
      message,
      tag,
      line,
    });
  };

  const attacker = (r: number, c: number): QueensState['conflict'] => {
    for (let pr = 0; pr < r; pr++) {
      checks++;
      const pc = queens[pr];
      if (pc === c) return { r: pr, c: pc, reason: 'column' };
      if (Math.abs(pc - c) === r - pr) return { r: pr, c: pc, reason: 'diagonal' };
    }
    return null;
  };

  const cell = (r: number, c: number) => `(${r + 1}, ${c + 1})`;

  const solve = (r: number) => {
    if (stop) return;
    if (r === n) {
      solutions.push(queens.slice());
      snap(`Solution #${solutions.length} found: all ${n} queens placed safely.`, 'success', 0, r, null, null, true);
      if (!findAll) stop = true;
      return;
    }
    for (let c = 0; c < n && !stop; c++) {
      const hit = attacker(r, c);
      if (hit) {
        snap(
          `Row ${r + 1}: ${cell(r, c)} is attacked by queen at ${cell(hit.r, hit.c)} (same ${hit.reason}). Skip.`,
          'compare',
          2,
          r,
          { r, c },
          hit,
        );
        continue;
      }
      queens[r] = c;
      placements++;
      snap(`Row ${r + 1}: ${cell(r, c)} is safe → place queen.`, 'action', 3, r, { r, c });
      solve(r + 1);
      if (stop) return;
      queens[r] = -1;
      backtracks++;
      snap(`Backtrack: remove queen from ${cell(r, c)} and try the next column.`, 'warn', 5, r, { r, c });
    }
    if (!stop && r > 0) snap(`Row ${r + 1}: no safe column left — return to row ${r}.`, 'warn', 1, r);
  };

  snap(`Place ${n} queen${n > 1 ? 's' : ''} on a ${n}×${n} board so none attack each other. Start at row 1.`, 'info', 0, 0, null, null, true);
  solve(0);
  const count = solutions.length;
  const msg =
    count === 0
      ? `No solution exists for n = ${n}. Every branch was explored and backtracked.`
      : findAll
        ? `Search complete: ${count} solution${count === 1 ? '' : 's'} for n = ${n}.`
        : `Done: first solution found after ${placements} placements and ${backtracks} backtracks.`;
  // Show the first solution on the final frame if one exists.
  if (count) for (let i = 0; i < n; i++) queens[i] = solutions[findAll ? count - 1 : 0][i];
  snap(msg, count ? 'done' : 'warn', undefined, n, null, null, true);
  return { steps, truncated, result: { solutions, placements, backtracks, checks, complete: true } };
}

/** Squares attacked by queens in rows < upTo (used to shade the board). */
export function attackedCells(queens: number[], n: number): boolean[][] {
  const a = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  queens.forEach((qc, qr) => {
    if (qc < 0) return;
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) if (c === qc || Math.abs(c - qc) === Math.abs(r - qr)) a[r][c] = true;
  });
  return a;
}
