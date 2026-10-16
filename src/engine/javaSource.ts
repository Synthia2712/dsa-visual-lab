/**
 * Java source shown in the code panel. Taken from the course notes (CIA 2) — logic unchanged,
 * only re-indented. Engines locate lines with `lineOf` so highlighting stays correct if a
 * listing is edited.
 */

export interface CodeListing {
  title: string;
  lines: string[];
}

function listing(title: string, src: string): CodeListing {
  return { title, lines: src.replace(/^\n/, '').replace(/\s+$/, '').split('\n') };
}

/** Index of the n-th (0-based) line containing `snippet`. Throws early if a listing drifts. */
export function lineOf(code: CodeListing, snippet: string, nth = 0): number {
  let seen = 0;
  for (let i = 0; i < code.lines.length; i++) {
    if (code.lines[i].includes(snippet)) {
      if (seen === nth) return i;
      seen++;
    }
  }
  throw new Error(`lineOf: "${snippet}" not found in ${code.title}`);
}

export const RBT_JAVA = listing(
  'Java · RedBlackTree.insert / insertFixup',
  `
public void insert(int key) {
    Node node = new Node(key, RED);
    node.left = node.right = node.parent = NIL;
    Node parent = NIL;
    Node cur = root;
    // Standard BST descent
    while (cur != NIL) {
        parent = cur;
        if (key == cur.key) {
            return; // ignore duplicates
        }
        cur = (key < cur.key) ? cur.left : cur.right;
    }
    // Link under parent
    node.parent = parent;
    if (parent == NIL) {
        // Empty tree: new node becomes root — make it BLACK explicitly
        root = node;
        node.color = BLACK;
        return;
    } else if (key < parent.key) {
        parent.left = node;
    } else {
        parent.right = node;
    }
    // Restore RB properties if parent was RED
    insertFixup(node);
}

private void insertFixup(Node node) {
    while (node.parent.color == RED) {
        boolean parentIsLeft = (node.parent == node.parent.parent.left);
        Node grandparent = node.parent.parent;
        Node uncle = parentIsLeft ? grandparent.right : grandparent.left;
        if (uncle.color == RED) {
            // Case 1: parent & uncle RED → recolor & climb
            node.parent.color = BLACK;
            uncle.color = BLACK;
            grandparent.color = RED;
            node = grandparent; // climb up and continue
        } else {
            // Uncle BLACK: shape decides Case 2 then Case 3
            if (parentIsLeft && node == node.parent.right) {
                // Left–Right (triangle) → rotate at parent
                node = node.parent;
                rotateLeft(node);
            } else if (!parentIsLeft && node == node.parent.left) {
                // Right–Left (triangle) → rotate at parent
                node = node.parent;
                rotateRight(node);
            }
            // Case 3 (line): rotate at grandparent, recolor
            node.parent.color = BLACK; // new top of subtree
            grandparent.color = RED;   // pushed down
            if (parentIsLeft) {
                rotateRight(grandparent);
            } else {
                rotateLeft(grandparent);
            }
        }
    }
    // Always ensure root is BLACK
    root.color = BLACK;
}
`,
);

export const FF_JAVA = listing(
  'Java · FordFulkersonDFS',
  `
// DFS searches for ANY augmenting path from source to sink
private boolean dfs(int[][] residualGraph, int u, int sink,
                    boolean[] visited, int[] parent) {
    visited[u] = true;
    if (u == sink)
        return true;
    for (int v = 0; v < V; v++) {
        // Edge can be used only if residual capacity > 0
        if (!visited[v] && residualGraph[u][v] > 0) {
            parent[v] = u;
            if (dfs(residualGraph, v, sink, visited, parent))
                return true;
        }
    }
    return false;
}

public int maxFlow(int[][] graph, int source, int sink) {
    // Initially residual capacity = original capacity
    int[][] residualGraph = new int[V][V];
    for (int u = 0; u < V; u++)
        for (int v = 0; v < V; v++)
            residualGraph[u][v] = graph[u][v];
    int[] parent = new int[V];
    int maxFlow = 0;
    // Keep finding augmenting paths
    while (true) {
        boolean[] visited = new boolean[V];
        Arrays.fill(parent, -1);
        // DFS finds an augmenting path
        if (!dfs(residualGraph, source, sink, visited, parent)) {
            break;
        }
        // Find bottleneck capacity
        int pathFlow = Integer.MAX_VALUE;
        for (int v = sink; v != source; v = parent[v]) {
            int u = parent[v];
            pathFlow = Math.min(pathFlow, residualGraph[u][v]);
        }
        // Update residual graph
        for (int v = sink; v != source; v = parent[v]) {
            int u = parent[v];
            residualGraph[u][v] -= pathFlow; // Forward edge
            residualGraph[v][u] += pathFlow; // Reverse edge
        }
        maxFlow += pathFlow;
        System.out.println("Augmenting flow = " + pathFlow);
    }
    return maxFlow;
}
`,
);

export const EK_JAVA = listing(
  'Java · EdmondsKarpBFS',
  `
// BFS finds the shortest augmenting path
// in terms of NUMBER OF EDGES
private boolean bfs(int[][] residualGraph, int source, int sink, int[] parent) {
    boolean[] visited = new boolean[V];
    Queue<Integer> queue = new LinkedList<>();
    queue.add(source);
    visited[source] = true;
    Arrays.fill(parent, -1);
    while (!queue.isEmpty()) {
        int u = queue.poll();
        for (int v = 0; v < V; v++) {
            // Can travel only if residual capacity > 0
            if (!visited[v] && residualGraph[u][v] > 0) {
                parent[v] = u;
                visited[v] = true;
                queue.add(v);
                // Sink reached
                if (v == sink)
                    return true;
            }
        }
    }
    return false;
}

public int maxFlow(int[][] graph, int source, int sink) {
    int[][] residualGraph = new int[V][V];
    // Initially residual capacity = original capacity
    for (int u = 0; u < V; u++)
        for (int v = 0; v < V; v++)
            residualGraph[u][v] = graph[u][v];
    int[] parent = new int[V];
    int maxFlow = 0;
    // Keep finding augmenting paths using BFS
    while (bfs(residualGraph, source, sink, parent)) {
        // Step 1: Find bottleneck
        int pathFlow = Integer.MAX_VALUE;
        for (int v = sink; v != source; v = parent[v]) {
            int u = parent[v];
            pathFlow = Math.min(pathFlow, residualGraph[u][v]);
        }
        // Step 2: Update residual graph
        for (int v = sink; v != source; v = parent[v]) {
            int u = parent[v];
            residualGraph[u][v] -= pathFlow; // Reduce forward capacity
            residualGraph[v][u] += pathFlow; // Increase reverse capacity
        }
        // Step 3: Add flow
        maxFlow += pathFlow;
        System.out.println("Augmenting flow = " + pathFlow);
    }
    return maxFlow;
}
`,
);

export const KRUSKAL_JAVA = listing(
  'Java · KruskalMST (DSU)',
  `
// Find with Path Compression
int find(int x) {
    if (parent[x] != x) {
        parent[x] = find(parent[x]);
    }
    return parent[x];
}

// Union by Rank
boolean union(int x, int y) {
    int rootX = find(x);
    int rootY = find(y);
    // Already connected → adding this edge creates a cycle
    if (rootX == rootY) {
        return false;
    }
    if (rank[rootX] < rank[rootY]) {
        parent[rootX] = rootY;
    } else if (rank[rootX] > rank[rootY]) {
        parent[rootY] = rootX;
    } else {
        parent[rootY] = rootX;
        rank[rootX]++;
    }
    return true;
}

public static void kruskalMST(int vertices, List<Edge> edges) {
    // Step 1: Sort all edges by increasing weight
    Collections.sort(edges);
    DSU dsu = new DSU(vertices);
    List<Edge> mst = new ArrayList<>();
    int totalWeight = 0;
    // Step 2: Process edges one by one
    for (Edge edge : edges) {
        // If src and dest are in different components,
        // this edge will not create a cycle
        if (dsu.union(edge.src, edge.dest)) {
            mst.add(edge);
            totalWeight += edge.weight;
            // MST contains exactly V - 1 edges
            if (mst.size() == vertices - 1) {
                break;
            }
        }
    }
    System.out.println("Total MST Weight = " + totalWeight);
}
`,
);

export const BUCKET_NOTES = listing(
  'Bucket Sort · steps from the notes',
  `
// Step 1: Create buckets
//   n = number of elements, k = number of buckets (10)
//   bucketIndex = floor(value × 10)
//
// Step 2: Distribute elements into buckets according to their value
for each value in arr:
    bucket[floor(value × 10)].add(value)
//
// Step 3: Sort each bucket individually (insertion sort)
for each bucket b:
    for i = 1 .. b.size − 1:
        while j > 0 and b[j − 1] > b[j]:
            swap(b[j − 1], b[j]);  j−−
//
// Step 4: Concatenate the buckets
for b = 0 .. 9:
    output.addAll(bucket[b])
`,
);
