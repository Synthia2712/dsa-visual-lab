import { lineOf, RBT_JAVA } from './javaSource';
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

/** Code panel listing + the line each kind of step highlights (matches insert/insertFixup). */
export const RB_CODE = RBT_JAVA;
const J = {
  descent: lineOf(RBT_JAVA, 'while (cur != NIL)'),
  dup: lineOf(RBT_JAVA, 'return; // ignore duplicates'),
  step: lineOf(RBT_JAVA, 'cur = (key < cur.key)'),
  rootBlack: lineOf(RBT_JAVA, 'node.color = BLACK;'),
  linkL: lineOf(RBT_JAVA, 'parent.left = node;'),
  linkR: lineOf(RBT_JAVA, 'parent.right = node;'),
  whileRed: lineOf(RBT_JAVA, 'while (node.parent.color == RED)'),
  uncle: lineOf(RBT_JAVA, 'Node uncle ='),
  case1: lineOf(RBT_JAVA, 'grandparent.color = RED;'),
  climb: lineOf(RBT_JAVA, 'node = grandparent;'),
  rotL: lineOf(RBT_JAVA, 'rotateLeft(node);'),
  rotR: lineOf(RBT_JAVA, 'rotateRight(node);'),
  case3: lineOf(RBT_JAVA, 'node.parent.color = BLACK; // new top'),
  case3R: lineOf(RBT_JAVA, 'rotateRight(grandparent);'),
  case3L: lineOf(RBT_JAVA, 'rotateLeft(grandparent);'),
  rootEnd: lineOf(RBT_JAVA, 'root.color = BLACK;'),
};

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

  /** Mirrors RedBlackTree.insert(int key) from the notes. Returns false for duplicates. */
  insert(key: number): boolean {
    this.inserting = key;
    let parent: number | null = null; // NIL
    let cur = this.root;
    if (cur === null) this.snap(`insert(${key}): cur = root = NIL, so the descent loop is skipped.`, 'info', J.descent);
    while (cur !== null) {
      parent = cur;
      const c = this.n(cur);
      if (key === c.key) {
        this.snap(`key == cur.key (${key}) → return; duplicates are ignored.`, 'warn', J.dup, cur);
        this.inserting = null;
        return false;
      }
      const left = key < c.key;
      this.snap(`parent = ${c.key}. ${key} ${left ? '<' : '>'} ${c.key} → cur = cur.${left ? 'left' : 'right'}.`, 'compare', J.step, cur);
      cur = left ? c.left : c.right;
    }
    const id = this.nextId++;
    this.nodes[id] = { id, key, color: 'R', left: null, right: null, parent };
    if (parent === null) {
      this.root = id;
      this.nodes[id].color = 'B';
      this.snap(`parent == NIL → tree was empty: root = node, node.color = BLACK; return.`, 'action', J.rootBlack, id);
      this.snap(`${key} inserted as the BLACK root.`, 'success', undefined, null);
      this.inserting = null;
      return true;
    }
    const goLeft = key < this.n(parent).key;
    if (goLeft) this.n(parent).left = id;
    else this.n(parent).right = id;
    this.snap(
      `New RED node ${key} linked as ${this.n(parent).key}.${goLeft ? 'left' : 'right'}. Call insertFixup(node).`,
      'action',
      goLeft ? J.linkL : J.linkR,
      id,
      [parent],
    );
    this.fixup(id);
    return true;
  }

  /** Mirrors insertFixup(Node node). NIL is BLACK, so a null uncle counts as BLACK. */
  fixup(start: number) {
    let node = start;
    for (;;) {
      const p = this.n(node).parent;
      if (p === null || !this.isRed(p)) {
        this.snap(
          p === null ? `node ${this.n(node).key} is the root (its parent is NIL, which is BLACK) → loop ends.` : `node.parent (${this.n(p).key}) is BLACK → loop ends.`,
          'compare',
          J.whileRed,
          node,
          p === null ? [] : [p],
        );
        break;
      }
      const grandparent = this.n(p).parent!; // a RED parent is never the root
      const parentIsLeft = this.n(grandparent).left === p;
      const uncle = parentIsLeft ? this.n(grandparent).right : this.n(grandparent).left;
      const nk = this.n(node).key;
      const pk = this.n(p).key;
      const gk = this.n(grandparent).key;
      const uTxt = uncle === null ? 'NIL (BLACK)' : `${this.n(uncle).key} (${this.isRed(uncle) ? 'RED' : 'BLACK'})`;
      this.snap(
        `node.parent ${pk} is RED (red-red with ${nk}). parentIsLeft = ${parentIsLeft}, grandparent = ${gk}, uncle = ${uTxt}.`,
        'warn',
        J.uncle,
        node,
        [p, grandparent, ...(uncle !== null ? [uncle] : [])],
      );
      if (this.isRed(uncle)) {
        this.n(p).color = 'B';
        this.n(uncle!).color = 'B';
        this.n(grandparent).color = 'R';
        this.recolors += 3;
        this.snap(`Case 1: uncle is RED → parent ${pk} & uncle ${this.n(uncle!).key} BLACK, grandparent ${gk} RED.`, 'action', J.case1, node, [p, uncle!, grandparent]);
        node = grandparent;
        this.snap(`node = grandparent (${gk}) — climb up and continue.`, 'info', J.climb, node);
        continue;
      }
      if (parentIsLeft && this.n(p).right === node) {
        node = p;
        this.snap(`Uncle BLACK and ${nk} is parent.right (Left–Right triangle) → node = node.parent (${pk}); rotateLeft(${pk}).`, 'info', J.rotL, node, [grandparent], { pivot: p, dir: 'left' });
        this.rotateLeft(node);
        this.snap(`rotateLeft(${pk}) done — now a straight line. Continue to Case 3.`, 'action', J.rotL, node, [this.n(node).parent!, grandparent]);
      } else if (!parentIsLeft && this.n(p).left === node) {
        node = p;
        this.snap(`Uncle BLACK and ${nk} is parent.left (Right–Left triangle) → node = node.parent (${pk}); rotateRight(${pk}).`, 'info', J.rotR, node, [grandparent], { pivot: p, dir: 'right' });
        this.rotateRight(node);
        this.snap(`rotateRight(${pk}) done — now a straight line. Continue to Case 3.`, 'action', J.rotR, node, [this.n(node).parent!, grandparent]);
      }
      const top = this.n(node).parent!;
      this.n(top).color = 'B';
      this.n(grandparent).color = 'R';
      this.recolors += 2;
      this.snap(`Case 3: node.parent (${this.n(top).key}) = BLACK, grandparent (${gk}) = RED.`, 'action', J.case3, node, [top, grandparent]);
      const dir = parentIsLeft ? 'right' : 'left';
      this.snap(`rotate${parentIsLeft ? 'Right' : 'Left'}(grandparent ${gk}).`, 'info', parentIsLeft ? J.case3R : J.case3L, node, [top, grandparent], { pivot: grandparent, dir });
      if (parentIsLeft) this.rotateRight(grandparent);
      else this.rotateLeft(grandparent);
      this.snap(`${this.n(top).key} is now the top of this subtree.`, 'action', parentIsLeft ? J.case3R : J.case3L, node, [top, grandparent]);
    }
    const r = this.root!;
    const wasRed = this.n(r).color === 'R';
    this.n(r).color = 'B';
    if (wasRed) this.recolors++;
    this.snap(`root.color = BLACK (root ${this.n(r).key} ${wasRed ? 'was RED → now BLACK' : 'is already BLACK'}).`, wasRed ? 'action' : 'compare', J.rootEnd, r);
    this.snap(`${this.inserting} inserted. All red-black properties hold.`, 'success', undefined, null);
    this.inserting = null;
  }
}

/** heightEdges() from the notes: −1 for an empty tree, otherwise edges on the longest root-to-leaf path. */
export function rbHeight(nodes: Record<number, RBNode>, id: number | null): number {
  if (id === null) return -1;
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
    `Done. ${size} node${size === 1 ? '' : 's'}, height ${result.height} edges, black-height ${result.blackHeight}, ${e.rotations} rotation${e.rotations === 1 ? '' : 's'}.`,
    'done',
    undefined,
  );
  return { steps: e.steps, result };
}
