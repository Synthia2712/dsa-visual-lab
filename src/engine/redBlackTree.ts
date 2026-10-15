import type { Step, Trace } from './types';

export type RBColor = 'R' | 'B';

export interface RBNode {
  id: number;
  key: number;
  color: RBColor;
  left: number | null;
  right: number | null;
  parent: number | null;
}

export interface RBState {
  nodes: Record<number, RBNode>;
  root: number | null;
  /** Node currently being worked on (z in CLRS). */
  current: number | null;
  /** Nodes involved in the current operation (parent, uncle, grandparent, rotation pivot). */
  related: number[];
  /** Key being inserted in this phase. */
  inserting: number | null;
  rotation: { pivot: number; dir: 'left' | 'right' } | null;
}

export interface RBResult {
  inorder: number[];
  size: number;
  height: number;
  blackHeight: number;
  rotations: number;
  recolors: number;
  duplicates: number[];
  /** First step index for each inserted key (used to jump to the latest insertion). */
  keyStart: number[];
}

export const RB_PSEUDOCODE = [
  'insert(k): descend from root comparing keys',
  '  attach new node z as RED leaf',
  'while parent(z) is RED:',
  '  Case 1 — uncle(z) is RED:',
  '    parent, uncle → BLACK; grandparent → RED; z = grandparent',
  '  Case 2 — z is an inner child (triangle):',
  '    z = parent; rotate at z toward the outside',
  '  Case 3 — z is an outer child (line):',
  '    parent → BLACK, grandparent → RED; rotate at grandparent',
  'root.color = BLACK',
];

class RBEngine {
  nodes: Record<number, RBNode> = {};
  root: number | null = null;
  nextId = 0;
  steps: Step<RBState>[] = [];
  rotations = 0;
  recolors = 0;
  inserting: number | null = null;

  snap(
    message: string,
    tag: Step<RBState>['tag'],
    line: number | undefined,
    current: number | null = null,
    related: number[] = [],
    rotation: RBState['rotation'] = null,
  ) {
    const nodes: Record<number, RBNode> = {};
    for (const k in this.nodes) nodes[k] = { ...this.nodes[k] };
    this.steps.push({
      state: { nodes, root: this.root, current, related, inserting: this.inserting, rotation },
      message,
      tag,
      line,
    });
  }

  n(id: number): RBNode {
    return this.nodes[id];
  }
  isRed(id: number | null): boolean {
    return id !== null && this.nodes[id].color === 'R';
  }

  rotateLeft(x: number) {
    const X = this.n(x);
    const y = X.right!;
    const Y = this.n(y);
    X.right = Y.left;
    if (Y.left !== null) this.n(Y.left).parent = x;
    Y.parent = X.parent;
    if (X.parent === null) this.root = y;
    else if (this.n(X.parent).left === x) this.n(X.parent).left = y;
    else this.n(X.parent).right = y;
    Y.left = x;
    X.parent = y;
    this.rotations++;
  }

  rotateRight(x: number) {
    const X = this.n(x);
    const y = X.left!;
    const Y = this.n(y);
    X.left = Y.right;
    if (Y.right !== null) this.n(Y.right).parent = x;
    Y.parent = X.parent;
    if (X.parent === null) this.root = y;
    else if (this.n(X.parent).right === x) this.n(X.parent).right = y;
    else this.n(X.parent).left = y;
    Y.right = x;
    X.parent = y;
    this.rotations++;
  }

  /** Returns false if the key was a duplicate. */
  insert(key: number): boolean {
    this.inserting = key;
    let cur = this.root;
    let parent: number | null = null;
    if (cur === null) this.snap(`Insert ${key}: tree is empty, ${key} becomes the root.`, 'info', 0);
    while (cur !== null) {
      const c = this.n(cur);
      if (key === c.key) {
        this.snap(`${key} already exists — duplicates are ignored.`, 'warn', 0, cur);
        this.inserting = null;
        return false;
      }
      const dir = key < c.key ? 'left' : 'right';
      this.snap(`Compare ${key} with ${c.key}: ${key} ${key < c.key ? '<' : '>'} ${c.key}, go ${dir}.`, 'compare', 0, cur);
      parent = cur;
      cur = dir === 'left' ? c.left : c.right;
    }
    const id = this.nextId++;
    this.nodes[id] = { id, key, color: 'R', left: null, right: null, parent };
    if (parent === null) this.root = id;
    else if (key < this.n(parent).key) this.n(parent).left = id;
    else this.n(parent).right = id;
    this.snap(
      parent === null ? `Attach ${key} as a RED root.` : `Attach ${key} as a RED ${key < this.n(parent).key ? 'left' : 'right'} child of ${this.n(parent).key}.`,
      'action',
      1,
      id,
      parent === null ? [] : [parent],
    );
    this.fixup(id);
    return true;
  }

  fixup(z0: number) {
    let z = z0;
    while (this.n(z).parent !== null && this.isRed(this.n(z).parent)) {
      const p = this.n(z).parent!;
      const g = this.n(p).parent!; // a red parent is never the root, so g exists
      const pIsLeft = this.n(g).left === p;
      const u = pIsLeft ? this.n(g).right : this.n(g).left;
      const zk = this.n(z).key;
      const pk = this.n(p).key;
      const gk = this.n(g).key;
      this.snap(`Red-red violation: ${zk} and its parent ${pk} are both RED.`, 'warn', 2, z, [p, g, ...(u !== null ? [u] : [])]);
      if (this.isRed(u)) {
        this.snap(`Case 1: uncle ${this.n(u!).key} is RED → recolor parent & uncle BLACK, grandparent ${gk} RED.`, 'info', 3, z, [p, u!, g]);
        this.n(p).color = 'B';
        this.n(u!).color = 'B';
        this.n(g).color = 'R';
        this.recolors += 3;
        this.snap(`Recolored. Move z up to grandparent ${gk} and re-check.`, 'action', 4, g, [p, u!]);
        z = g;
        continue;
      }
      const uncleTxt = u === null ? 'NIL (black)' : `${this.n(u).key} (black)`;
      const inner = pIsLeft ? this.n(p).right === z : this.n(p).left === z;
      let pp = p;
      if (inner) {
        const dir = pIsLeft ? 'left' : 'right';
        this.snap(`Case 2: uncle is ${uncleTxt} and ${zk} is an inner child → rotate ${dir} at ${pk}.`, 'info', 5, z, [p, g], { pivot: p, dir });
        if (pIsLeft) this.rotateLeft(p);
        else this.rotateRight(p);
        z = p;
        pp = this.n(z).parent!;
        this.snap(`Rotated ${dir} at ${pk}. Now ${this.n(z).key} is an outer child — continue with Case 3.`, 'action', 6, z, [pp, g]);
      }
      const dir = pIsLeft ? 'right' : 'left';
      this.snap(
        `Case 3: recolor ${this.n(pp).key} BLACK and grandparent ${gk} RED, then rotate ${dir} at ${gk}.`,
        'info',
        7,
        z,
        [pp, g],
        { pivot: g, dir },
      );
      this.n(pp).color = 'B';
      this.n(g).color = 'R';
      this.recolors += 2;
      if (pIsLeft) this.rotateRight(g);
      else this.rotateLeft(g);
      this.snap(`Rotated ${dir} at ${gk}. ${this.n(pp).key} is now the subtree root; violation fixed.`, 'action', 8, pp, [z, g]);
    }
    const r = this.root!;
    if (this.n(r).color === 'R') {
      this.n(r).color = 'B';
      this.recolors++;
      this.snap(`Root ${this.n(r).key} is RED → recolor it BLACK.`, 'action', 9, r);
    }
    this.snap(`${this.inserting} inserted. All red-black properties hold.`, 'success', undefined, null);
    this.inserting = null;
  }
}

export function rbHeight(nodes: Record<number, RBNode>, id: number | null): number {
  if (id === null) return 0;
  return 1 + Math.max(rbHeight(nodes, nodes[id].left), rbHeight(nodes, nodes[id].right));
}

/** Returns black-height, or -1 if invalid. Used by tests and the result panel. */
export function rbBlackHeight(nodes: Record<number, RBNode>, id: number | null): number {
  if (id === null) return 1;
  const l = rbBlackHeight(nodes, nodes[id].left);
  const r = rbBlackHeight(nodes, nodes[id].right);
  if (l < 0 || r < 0 || l !== r) return -1;
  return l + (nodes[id].color === 'B' ? 1 : 0);
}

export function rbInorder(nodes: Record<number, RBNode>, id: number | null, out: number[] = []): number[] {
  if (id === null) return out;
  rbInorder(nodes, nodes[id].left, out);
  out.push(nodes[id].key);
  rbInorder(nodes, nodes[id].right, out);
  return out;
}

/** Checks every red-black invariant. Returns null when valid, else a description. */
export function rbValidate(state: Pick<RBState, 'nodes' | 'root'>): string | null {
  const { nodes, root } = state;
  if (root === null) return null;
  if (nodes[root].color !== 'B') return 'root is red';
  if (nodes[root].parent !== null) return 'root has a parent';
  for (const k in nodes) {
    const n = nodes[k];
    for (const c of [n.left, n.right]) {
      if (c === null) continue;
      if (nodes[c].parent !== n.id) return `bad parent pointer at ${nodes[c].key}`;
      if (n.color === 'R' && nodes[c].color === 'R') return `red-red at ${n.key}`;
    }
  }
  const ino = rbInorder(nodes, root);
  for (let i = 1; i < ino.length; i++) if (ino[i] <= ino[i - 1]) return 'BST order broken';
  if (ino.length !== Object.keys(nodes).length) return 'unreachable nodes';
  if (rbBlackHeight(nodes, root) < 0) return 'unequal black heights';
  return null;
}

export function runRedBlackTree(keys: number[]): Trace<RBState, RBResult> {
  const e = new RBEngine();
  e.snap(keys.length ? `Ready to insert ${keys.length} key${keys.length > 1 ? 's' : ''}: ${keys.join(', ')}.` : 'No keys to insert.', 'info', undefined);
  const duplicates: number[] = [];
  const keyStart: number[] = [];
  for (const k of keys) {
    keyStart.push(e.steps.length);
    if (!e.insert(k)) duplicates.push(k);
  }
  const size = Object.keys(e.nodes).length;
  const result: RBResult = {
    inorder: rbInorder(e.nodes, e.root),
    size,
    height: rbHeight(e.nodes, e.root),
    blackHeight: Math.max(0, rbBlackHeight(e.nodes, e.root) - 1),
    rotations: e.rotations,
    recolors: e.recolors,
    duplicates,
    keyStart,
  };
  e.snap(
    `Done. ${size} node${size === 1 ? '' : 's'}, height ${result.height}, black-height ${result.blackHeight}, ${e.rotations} rotation${e.rotations === 1 ? '' : 's'}.`,
    'done',
    undefined,
  );
  return { steps: e.steps, result };
}
