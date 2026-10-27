"""Reference values for v4's graph algorithms, from NetworkX / SciPy / NumPy.

Run once, by hand, when a fixture graph or a reference changes, in the
locked environment of scripts/references/pixi.toml (pixi installs it on
first run):

    pixi run --manifest-path scripts/references/pixi.toml python

It writes test/fixtures/algorithm-references.json: the fixture graphs, and
per algorithm the values an independent implementation computes on them.
test/algorithms-reference.test.mjs builds the same graphs in v4 and compares.
The specs never run Python; the JSON is the checked-in record.

Each reference is chosen to compute *v4's* definition, which is v3's where
the two differ from a textbook — every such mapping is noted at its call
(e.g. closeness measured from the node).  Where no library computes v4's exact
definition (SimRank's fixed point, random walk with an absorbing sink,
Markov clustering, affinity propagation) the reference is a short NumPy
transcription of the published algorithm, not of v4's code.
"""

import json
import math
import os
import random
import sys
from pathlib import Path

# set iteration order, and with it some summation orders, follows the
# string hash: pin it so a rerun writes the same bytes
if os.environ.get('PYTHONHASHSEED') != '0':
    os.execve(sys.executable, [sys.executable, *sys.argv], {**os.environ, 'PYTHONHASHSEED': '0'})

import networkx as nx
import numpy as np
import scipy
import scipy.linalg as sla
from scipy.cluster.hierarchy import fcluster, linkage
from scipy.cluster.vq import kmeans2
from scipy.spatial.distance import pdist, squareform

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'test' / 'fixtures' / 'algorithm-references.json'


# -- the fixture graphs -------------------------------------------------------
#
# Edges are [id, source, target, weight].  Every graph is small enough for
# the specs to run in milliseconds and large enough (30+ nodes) that a
# hand-checkable example would not have caught what a reference does.


def graph(name, directed, nodes, edges, note):
    return {
        'name': name,
        'directed': directed,
        'note': note,
        'nodes': [str(n) for n in nodes],
        'edges': [[f'e{i}', str(s), str(t), w] for i, (s, t, w) in enumerate(edges)],
    }


def karate():
    G = nx.karate_club_graph()
    return graph('karate', False, list(G.nodes), [(s, t, 1) for s, t in G.edges],
                 "Zachary's karate club, unweighted")


def weighted_undirected(rng):
    # a connected simple graph: a random spanning tree plus random chords
    n = 30
    edges = {}
    for v in range(1, n):
        edges[tuple(sorted((v, rng.randrange(v))))] = rng.randint(1, 9)
    while len(edges) < 70:
        a, b = rng.sample(range(n), 2)
        edges.setdefault(tuple(sorted((a, b))), rng.randint(1, 9))
    return graph('wu', False, range(n), [(a, b, w) for (a, b), w in edges.items()],
                 'connected weighted simple graph, 30 nodes / 70 edges')


def weighted_directed(rng):
    # nodes 27..29 have no out-edges: dangling for PageRank, sinks for the walk
    n = 30
    edges = {}
    while len(edges) < 90:
        a = rng.randrange(27)
        b = rng.randrange(n)
        if a != b:
            edges.setdefault((a, b), rng.randint(1, 9))
    return graph('wd', True, range(n), [(a, b, w) for (a, b), w in edges.items()],
                 'weighted simple digraph, 30 nodes / 90 edges, 3 sinks')


def disconnected(rng):
    # two components and an isolated node
    edges = {}
    for lo, hi in ((0, 8), (8, 14)):
        for v in range(lo + 1, hi):
            edges[(rng.randrange(lo, v), v)] = rng.randint(1, 9)
        for _ in range(4):
            a, b = sorted(rng.sample(range(lo, hi), 2))
            edges.setdefault((a, b), rng.randint(1, 9))
    return graph('disc', False, range(15), [(a, b, w) for (a, b), w in edges.items()],
                 'two weighted components and the isolated node 14')


def negative_dag(rng):
    # edges only run from lower to higher ids, so no cycle of any sign
    n = 20
    edges = {}
    while len(edges) < 45:
        a, b = sorted(rng.sample(range(n), 2))
        edges.setdefault((a, b), rng.randint(-4, 9))
    return graph('negd', True, range(n), [(a, b, w) for (a, b), w in edges.items()],
                 'weighted DAG with negative edges, no negative cycle')


def negative_cycle():
    edges = [(0, 1, 2), (1, 2, 1), (2, 3, -4), (3, 1, 1), (3, 4, 2), (0, 5, 1)]
    return graph('negcyc', True, range(6), edges,
                 'digraph whose cycle 1 -> 2 -> 3 -> 1 weighs -2')


def multigraph(rng):
    # parallel edges, no loops: the shapes a simple-graph reference hides
    n = 16
    edges = []
    for v in range(1, n):
        edges.append((rng.randrange(v), v, rng.randint(1, 9)))
    for _ in range(14):
        a, b = sorted(rng.sample(range(n), 2))
        edges.append((a, b, rng.randint(1, 9)))
    for s, t, _ in edges[:6]:
        edges.append((s, t, rng.randint(1, 9)))  # parallel twins
    return graph('multi', False, range(n), edges,
                 'weighted multigraph with parallel edges, 16 nodes')


def twins():
    # parallel pairs that are a node's only link: a leaf hanging by two
    # edges (0 = 1), and a doubled bridge (4 = 5) between two triangles
    edges = [(0, 1, 1), (0, 1, 2), (1, 2, 1), (2, 3, 1), (3, 1, 1),
             (3, 4, 1), (4, 5, 1), (4, 5, 1), (5, 6, 1), (6, 7, 1), (7, 5, 1)]
    return graph('twins', False, range(8), edges,
                 'parallel pairs that are the only link: a leaf and a bridge')


def barbell():
    # two 6-cliques joined by three disjoint edges: the min cut is 3, where
    # every other fixture has a degree-1 node and a trivial cut of 1
    edges = [(a, b, 1) for lo in (0, 6) for a in range(lo, lo + 6) for b in range(a + 1, lo + 6)]
    edges += [(0, 6, 1), (1, 7, 1), (2, 8, 1)]
    return graph('barbell', False, range(12), edges, 'two 6-cliques joined by 3 edges')


def blobs(rng):
    # three 2-D blobs; the first point is the middle of its blob, so it is
    # an exemplar for affinity propagation (the node-0 case)
    pts = []
    for cx, cy in ((0, 0), (6, 1), (2, 7)):
        pts.append((cx, cy))
        for _ in range(5):
            pts.append((cx + rng.uniform(-1, 1), cy + rng.uniform(-1, 1)))
    return [[round(x, 6), round(y, 6)] for x, y in pts]


# -- helpers ------------------------------------------------------------------


def nx_graph(g, multi=False):
    G = (nx.MultiDiGraph if g['directed'] else nx.MultiGraph)() if multi else \
        (nx.DiGraph if g['directed'] else nx.Graph)()
    G.add_nodes_from(g['nodes'])
    for eid, s, t, w in g['edges']:
        G.add_edge(s, t, w=w)
    return G


def finite(x):
    # null for Infinity (JSON has none); 14 significant digits, so a rerun
    # on another machine does not churn the last bit of every value
    if x is None or (isinstance(x, float) and math.isinf(x)):
        return None
    return float(f'{x:.14g}') if isinstance(x, float) else x


def per_node(g, values):
    return {n: finite(float(values[n])) for n in g['nodes']}


def matrix(g, M):
    return [[finite(float(v)) for v in row] for row in M]


def adjacency(g, weighted=True):
    idx = {n: i for i, n in enumerate(g['nodes'])}
    A = np.zeros((len(idx), len(idx)))
    for _, s, t, w in g['edges']:
        if s == t:
            continue
        A[idx[s], idx[t]] += w if weighted else 1
        if not g['directed']:
            A[idx[t], idx[s]] += w if weighted else 1
    return A


# -- the references -----------------------------------------------------------


def shortest_paths(G, refs):
    for g in G.values():
        if g['name'] in ('negcyc', 'negd'):
            continue
        root = g['nodes'][0]
        d = nx.single_source_dijkstra_path_length(nx_graph(g, multi=True), root, weight='w')
        refs['dijkstra'][g['name']] = {'root': root, 'distance': {n: finite(d.get(n, math.inf)) for n in g['nodes']}}

    for name in ('wu', 'wd', 'multi', 'disc'):
        g = G[name]
        M = nx.floyd_warshall_numpy(nx_graph(g, multi=True), nodelist=g['nodes'], weight='w')
        refs['floydWarshall'][name] = matrix(g, M)

    g = G['negd']
    d = nx.single_source_bellman_ford_path_length(nx_graph(g), '0', weight='w')
    refs['bellmanFord']['negd'] = {
        'root': '0',
        'distance': {n: finite(d.get(n, math.inf)) for n in g['nodes']},
        'hasNegativeWeightCycle': False,
    }
    # undirected: each edge is both arcs, so a negative edge reachable from
    # the root is a 2-node negative cycle (NetworkXUnbounded)
    def unbounded(D, root):
        try:
            nx.single_source_bellman_ford_path_length(D, root, weight='w')
            return False
        except nx.NetworkXUnbounded:
            return True

    refs['bellmanFord']['negd-undirected'] = {
        'root': '0',
        'hasNegativeWeightCycle': unbounded(nx_graph({**g, 'directed': False}), '0'),
    }
    for name in ('wu', 'multi'):
        g = G[name]
        root = g['nodes'][0]
        d = nx.single_source_bellman_ford_path_length(nx_graph(g, multi=True), root, weight='w')
        refs['bellmanFord'][name] = {
            'root': root,
            'distance': {n: finite(d.get(n, math.inf)) for n in g['nodes']},
            'hasNegativeWeightCycle': False,
        }

    g = G['negcyc']
    refs['bellmanFord']['negcyc'] = {
        'root': '0',
        'hasNegativeWeightCycle': nx.negative_edge_cycle(nx_graph(g), weight='w'),
        'cycle': sorted(set(nx.find_negative_cycle(nx_graph(g), '0', weight='w'))),
    }

    for name in ('wu', 'disc', 'multi'):
        g = G[name]
        T = nx.minimum_spanning_tree(nx_graph(g, multi=True), weight='w')
        refs['kruskal'][name] = {
            'weight': sum(w for _, _, w in T.edges(data='w')),
            'edges': T.number_of_edges(),
        }


def structure(G, refs):
    g = G['wd']
    refs['tarjanStronglyConnected']['wd'] = sorted(
        sorted(c) for c in nx.strongly_connected_components(nx_graph(g)))

    for name in ('karate', 'wu', 'multi', 'disc', 'twins'):
        g = G[name]
        S = nx.Graph(nx_graph(g, multi=True))
        refs['hopcroftTarjanBiconnected'][name] = {
            'cut': sorted(nx.articulation_points(S)),
            'components': sorted(sorted(c) for c in nx.biconnected_components(S)),
        }

    for name in ('barbell', 'multi'):
        g = G[name]
        # the min cut counts parallel edges: weight each pair by multiplicity
        S = nx.Graph()
        S.add_nodes_from(g['nodes'])
        for _, s, t, _ in g['edges']:
            S.add_edge(s, t, m=S.get_edge_data(s, t, {'m': 0})['m'] + 1)
        refs['kargerStein'][name] = nx.stoer_wagner(S, weight='m')[0]


def centralities(G, refs):
    # PageRank: v4's dampingFactor is NetworkX's alpha (v3's d was
    # alpha = 1/(2 - d); v4 took the textbook definition).  An undirected
    # graph walks each edge both ways, as NetworkX does (round 150); the
    # '-dir' cases read its edge list as a digraph, v4's `directed: true`
    for name, weighted, as_digraph in (('karate', False, False), ('karate', False, True),
                                       ('wu', True, False), ('wd', False, False), ('wd', True, False)):
        g = G[name]
        D = nx_graph({**g, 'directed': True} if as_digraph else g, multi=True)
        for d in (0.85, 0.5):
            pr = nx.pagerank(D,
                             alpha=d, weight='w' if weighted else None,
                             tol=1e-15, max_iter=10000)
            key = f'{name}{"-dir" if as_digraph else ""}{"-w" if weighted else ""}-d{d}'
            refs['pageRank'][key] = per_node(g, pr)

    # closeness, harmonic (sum 1/d) and classic ((n-1)/sum d with the
    # Wasserman-Faust correction, round 150), both NetworkX's own.
    # NetworkX sums distances *to* the node; v4's default direction is
    # from it, which is NetworkX on the reversed graph, and a directed
    # graph also records v4's direction: 'in', NetworkX unreversed
    for name, weighted in (('karate', False), ('wu', True), ('wd', True), ('disc', True)):
        g = G[name]
        Gx = nx_graph(g, multi=True)
        w = 'w' if weighted else None
        ref = {'weighted': weighted}
        for suffix, D in (('', Gx.reverse() if g['directed'] else Gx),
                          *((('In', Gx),) if g['directed'] else ())):
            ref['harmonic' + suffix] = per_node(g, nx.harmonic_centrality(D, distance=w))
            ref['classic' + suffix] = per_node(g, nx.closeness_centrality(D, distance=w, wf_improved=True))
        refs['closenessCentrality'][name] = ref

    # betweenness, NetworkX's unnormalized definition (round 150 halved
    # v4's undirected scores to it)
    for name, weighted in (('karate', False), ('wu', True), ('wd', True)):
        g = G[name]
        b = nx.betweenness_centrality(nx_graph(g), normalized=False, weight='w' if weighted else None)
        refs['betweennessCentrality'][name] = {
            'weighted': weighted,
            'betweenness': per_node(g, b),
        }

    # Katz at half the convergence radius
    for name in ('wu', 'wd'):
        g = G[name]
        A = adjacency(g)
        alpha = 0.5 / max(abs(np.linalg.eigvals(A)))
        k = nx.katz_centrality(nx_graph(g), alpha=alpha, beta=1.0, normalized=False,
                               weight='w', tol=1e-15, max_iter=100000)
        refs['katzCentrality'][name] = {'alpha': finite(float(alpha)), 'katz': per_node(g, k)}

    for name in ('karate', 'wu'):
        g = G[name]
        S = nx_graph(g)
        refs['triangleCount'][name] = {
            'triangles': per_node(g, nx.triangles(S)),
            'clusteringCoefficient': per_node(g, nx.clustering(S)),
            'totalTriangles': sum(nx.triangles(S).values()) // 3,
            'transitivity': finite(nx.transitivity(S)),
        }


def proximity(G, refs):
    # neighbourhood similarity over open neighbourhoods (out-neighbours when
    # directed), by set arithmetic: jaccard c/|A u B|, cosine c/sqrt(|A||B|),
    # overlap c/min(|A|,|B|), 0 for an empty denominator
    for name in ('karate', 'wd'):
        g = G[name]
        Gx = nx_graph(g)
        nb = {n: set(Gx.successors(n) if g['directed'] else Gx.neighbors(n)) - {n} for n in g['nodes']}
        out = {}
        for metric in ('jaccard', 'cosine', 'overlap'):
            rows = []
            for a in g['nodes']:
                row = []
                for b in g['nodes']:
                    A, B = nb[a], nb[b]
                    c = len(A & B)
                    den = {'jaccard': len(A | B), 'cosine': math.sqrt(len(A) * len(B)),
                           'overlap': min(len(A), len(B))}[metric]
                    row.append(c / den if den else 0.0)
                rows.append(row)
            out[metric] = rows
        if not g['directed']:
            # the set arithmetic agrees with NetworkX where NetworkX has the metric
            for a, b, j in nx.jaccard_coefficient(Gx, [(g['nodes'][0], n) for n in g['nodes'][1:]]):
                assert abs(out['jaccard'][0][g['nodes'].index(b)] - j) < 1e-15
        refs['neighborhoodSimilarity'][name] = out

    # SimRank's exact fixed point: nx.simrank_similarity stops early (its
    # allclose carries an rtol), ~5e-6 short of it even at tol 1e-14
    for name in ('wu', 'wd'):
        g = G[name]
        A = adjacency(g, weighted=False)
        In = A.T if g['directed'] else A
        deg = In.sum(1)
        Q = np.divide(In, deg[:, None], out=np.zeros_like(In), where=deg[:, None] > 0)
        S = np.eye(len(A))
        for _ in range(5000):
            S = 0.8 * Q @ S @ Q.T
            np.fill_diagonal(S, 1)
        refs['simRank'][name] = matrix(g, S)

    # random walk with restart, solved exactly: K = c (I - (1 - c) P^T)^-1,
    # where a node with no out-edges absorbs the walk (a zero row of P)
    for name in ('wd', 'wu'):
        g = G[name]
        A = adjacency(g)
        out = A.sum(1)
        P = np.divide(A, out[:, None], out=np.zeros_like(A), where=out[:, None] > 0)
        c = 0.15
        K = c * np.linalg.inv(np.eye(len(A)) - (1 - c) * P.T)
        p0 = np.zeros(len(A))
        p0[0] = 1
        refs['randomWalkWithRestart'][name] = {
            'seed': g['nodes'][0],
            'score': [finite(float(v)) for v in K @ p0],
            'proximity': matrix(g, K.T),  # [from][to]
        }

    # the heat kernel exp(-tL), combinatorial and normalised Laplacians
    for name in ('wu', 'disc'):
        g = G[name]
        Gx = nx_graph(g, multi=True)
        out = {}
        for lap, fn in (('combinatorial', nx.laplacian_matrix),
                        ('normalized', nx.normalized_laplacian_matrix)):
            L = fn(Gx, nodelist=g['nodes'], weight='w').toarray()
            for t in (0.3, 2.0):
                out[f'{lap}-{t}'] = matrix(g, sla.expm(-t * L))
        refs['heatKernel'][name] = out

    # effective resistance with weights as conductances
    for name in ('wu', 'disc'):
        g = G[name]
        Gx = nx_graph(g)
        comps = list(nx.connected_components(Gx))
        comp = {n: i for i, c in enumerate(comps) for n in c}
        sub = [Gx.subgraph(c) for c in comps]  # NetworkX needs it connected
        rows = []
        for a in g['nodes']:
            row = []
            for b in g['nodes']:
                if a == b:
                    row.append(0.0)
                elif comp[a] != comp[b]:
                    row.append(None)
                else:
                    row.append(nx.resistance_distance(sub[comp[a]], a, b, weight='w', invert_weight=False))
            rows.append(row)
        refs['effectiveResistance'][name] = rows

    g = G['wd']
    refs['motifCensus']['wd'] = nx.triadic_census(nx_graph(g))


def clustering(points, karate_g, refs):
    X = np.array(points)

    # v4's 'mean' linkage is size-weighted: SciPy's 'average'; it merges
    # while the closest pair is < threshold, fcluster cuts at <= t
    for linkage_name, method in (('single', 'single'), ('complete', 'complete'), ('mean', 'average')):
        Z = linkage(X, method=method, metric='euclidean')
        for t in (1.5, 3.0, 6.0):
            lab = fcluster(Z, t=t - 1e-12, criterion='distance')
            refs['hierarchicalClustering'][f'{linkage_name}-{t}'] = sorted(
                np.flatnonzero(lab == l).tolist() for l in np.unique(lab))

    C0 = np.array([[0.0, 0.0], [1.0, 1.0], [2.0, 2.0]])
    C, lab = kmeans2(X, C0, iter=100, minit='matrix')
    refs['kMeans']['blobs'] = {
        'initial': C0.tolist(),
        'clusters': [np.flatnonzero(lab == k).tolist() for k in range(3)],
        'centroids': [[finite(float(v)) for v in c] for c in C],
    }

    # affinity propagation (Frey & Dueck 2007), similarity = -euclidean,
    # a numeric preference on the diagonal, damping 0.5, convergence when
    # the exemplar set holds for 100 iterations (v4's minIterations)
    S = -squareform(pdist(X))
    for pref in (-20.0, -8.0):
        S2 = S.copy()
        np.fill_diagonal(S2, pref)
        refs['affinityPropagation'][f'pref{pref:g}'] = affinity_propagation(S2)

    # Markov clustering on the karate club, v3's flavour: self-loops set to
    # multFactor 1, expand 2, inflate 2, stop when the inflated and expanded
    # matrices agree to 4 decimals, clusters read at 3 decimals
    g = karate_g
    n = len(g['nodes'])
    M = adjacency(g, weighted=False)
    np.fill_diagonal(M, 1)
    M /= M.sum(0)
    for _ in range(20):
        E = M @ M
        M = E ** 2
        M /= M.sum(0)
        if np.array_equal(np.floor(M * 1e4 + 0.5) / 1e4, np.floor(E * 1e4 + 0.5) / 1e4):
            break
    clusters, seen = [], set()
    for i in range(n):
        c = [j for j in range(n) if np.floor(M[i, j] * 1000 + 0.5) / 1000 > 0]
        if c and tuple(c) not in seen:
            seen.add(tuple(c))
            clusters.append(c)
    refs['markovClustering']['karate'] = clusters


def affinity_propagation(S, damping=0.5, max_iter=1000, conv=100):
    n = len(S)
    R = np.zeros((n, n))
    A = np.zeros((n, n))
    history = np.zeros((n, conv))
    for it in range(max_iter):
        AS = A + S
        I = np.argmax(AS, 1)
        Y = AS[np.arange(n), I]
        AS[np.arange(n), I] = -np.inf
        Y2 = AS.max(1)
        Rn = S - Y[:, None]
        Rn[np.arange(n), I] = S[np.arange(n), I] - Y2
        R = damping * R + (1 - damping) * Rn
        Rp = np.maximum(R, 0)
        np.fill_diagonal(Rp, np.diag(R))
        An = Rp.sum(0)[None, :] - Rp
        dA = np.diag(An).copy()
        An = np.minimum(An, 0)
        np.fill_diagonal(An, dA)
        A = damping * A + (1 - damping) * An
        E = (np.diag(A) + np.diag(R)) > 0
        history[:, it % conv] = E
        if it >= conv - 1:
            se = history.sum(1)
            if E.sum() > 0 and np.sum((se == conv) | (se == 0)) == n:
                break
    exemplars = np.flatnonzero(np.diag(A) + np.diag(R) > 0)
    assign = np.argmax(S[:, exemplars], 1)
    assign[exemplars] = np.arange(len(exemplars))
    return {
        'exemplars': exemplars.tolist(),
        'clusters': sorted(np.flatnonzero(assign == k).tolist() for k in range(len(exemplars))),
    }


def main():
    rng = random.Random(20261019)
    graphs = [karate(), weighted_undirected(rng), weighted_directed(rng), disconnected(rng),
              negative_dag(rng), negative_cycle(), multigraph(rng), barbell(), twins()]
    G = {g['name']: g for g in graphs}
    points = blobs(rng)
    names = ['dijkstra', 'floydWarshall', 'bellmanFord', 'kruskal', 'tarjanStronglyConnected',
             'hopcroftTarjanBiconnected', 'kargerStein', 'pageRank', 'closenessCentrality',
             'betweennessCentrality', 'katzCentrality', 'triangleCount', 'neighborhoodSimilarity',
             'simRank', 'randomWalkWithRestart', 'heatKernel', 'effectiveResistance',
             'motifCensus', 'hierarchicalClustering', 'kMeans', 'affinityPropagation',
             'markovClustering']
    refs = {n: {} for n in names}

    shortest_paths(G, refs)
    structure(G, refs)
    centralities(G, refs)
    proximity(G, refs)
    clustering(points, G['karate'], refs)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        'generator': 'scripts/algorithm-references.py',
        'versions': {'networkx': nx.__version__, 'scipy': scipy.__version__, 'numpy': np.__version__},
        'graphs': G,
        'points': points,
        'references': refs,
    }, indent=1) + '\n')
    print(f'wrote {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
