export interface AlgoMeta {
  slug: string;
  name: string;
  short: string;
  category: string;
  blurb: string;
  time: string;
  space: string;
  accent: 'magenta' | 'teal';
}

export const ALGORITHMS: AlgoMeta[] = [
  {
    slug: 'red-black-tree',
    name: 'Red-Black Tree',
    short: 'RBT',
    category: 'Balanced BST',
    blurb: 'Watch insertions trigger recolouring and rotations that keep the tree balanced.',
    time: 'O(log n) per insert',
    space: 'O(n)',
    accent: 'magenta',
  },
  {
    slug: 'ford-fulkerson',
    name: 'Ford–Fulkerson',
    short: 'FF',
    category: 'Max Flow · DFS',
    blurb: 'Depth-first search hunts augmenting paths through the residual network.',
    time: 'O(E · f*)',
    space: 'O(V + E)',
    accent: 'teal',
  },
  {
    slug: 'edmonds-karp',
    name: 'Edmonds–Karp',
    short: 'EK',
    category: 'Max Flow · BFS',
    blurb: 'Breadth-first search always picks the shortest augmenting path.',
    time: 'O(V · E²)',
    space: 'O(V + E)',
    accent: 'magenta',
  },
  {
    slug: 'n-queens',
    name: 'N-Queens',
    short: 'NQ',
    category: 'Backtracking',
    blurb: 'Place queens row by row, check safety and backtrack out of dead ends.',
    time: 'O(n!)',
    space: 'O(n)',
    accent: 'teal',
  },
  {
    slug: 'disjoint-set-union',
    name: 'Disjoint Set Union',
    short: 'DSU',
    category: 'Union–Find',
    blurb: 'Find, union by rank or size, and path compression on a live forest.',
    time: 'O(α(n)) amortised',
    space: 'O(n)',
    accent: 'magenta',
  },
  {
    slug: 'bucket-sort',
    name: 'Bucket Sort',
    short: 'BS',
    category: 'Distribution Sort',
    blurb: 'Scatter values into range buckets, sort each one, then gather.',
    time: 'O(n + k) avg · O(n²) worst',
    space: 'O(n + k)',
    accent: 'teal',
  },
];

export const findAlgo = (slug: string | undefined) => ALGORITHMS.find((a) => a.slug === slug);
