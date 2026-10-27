# Reference values for v4's graph algorithms from R: igraph, stats,
# cluster, e1071 and MCL (round 150).
#
# Run once, by hand, when a fixture graph or a reference changes, in the
# locked environment of scripts/references/pixi.toml:
#
#     pixi run --manifest-path scripts/references/pixi.toml refs-r
#
# It reads the fixture graphs and points that scripts/algorithm-references.py
# recorded in test/fixtures/algorithm-references.json, so both references see
# the same graphs, and writes test/fixtures/algorithm-references-r.json.
# test/algorithms-reference-r.test.mjs compares v4 against it.  The specs
# never run R; the JSON is the checked-in record.
#
# Where R's convention differs from v4's the spec says so and converts, the
# same rule as the Python reference: a disagreement is a finding to explain,
# not a tolerance to widen.

suppressPackageStartupMessages({
  library(igraph)
  library(cluster)
  library(e1071)
  library(MCL)
  library(jsonlite)
})

args <- commandArgs(trailingOnly = FALSE)
script <- normalizePath(sub("^--file=", "", args[grep("^--file=", args)]))
root <- dirname(dirname(script))
fixture <- fromJSON(file.path(root, "test", "fixtures", "algorithm-references.json"),
                    simplifyVector = FALSE)
out_path <- file.path(root, "test", "fixtures", "algorithm-references-r.json")

# -- helpers -------------------------------------------------------------------

# 14 significant digits, as the Python reference, so a rerun on another
# machine does not churn the last bit; Infinity is written as null
fin <- function(x) {
  x <- as.numeric(x)
  ifelse(is.finite(x), signif(x, 14), NA)
}

per_node <- function(g, values) {
  out <- as.list(fin(values))
  names(out) <- g$nodes
  out
}

as_matrix_rows <- function(m) lapply(seq_len(nrow(m)), function(i) fin(m[i, ]))

ig <- function(g, multi = TRUE) {
  edges <- do.call(rbind, lapply(g$edges, function(e) {
    data.frame(from = e[[2]], to = e[[3]], w = as.numeric(e[[4]]), id = e[[1]])
  }))
  nodes <- data.frame(name = unlist(g$nodes))
  G <- graph_from_data_frame(edges, directed = isTRUE(g$directed), vertices = nodes)
  if (!multi) {
    G <- simplify(G, remove.multiple = TRUE, remove.loops = TRUE,
                  edge.attr.comb = list(w = "first", id = "first"))
  }
  G
}

# a set stays a JSON array even with one member (auto_unbox would write
# a lone value as a scalar)
sets_of <- function(labels, names) {
  groups <- split(names, labels)
  groups <- lapply(groups, function(s) I(sort(s)))
  groups[order(sapply(groups, function(s) s[1]))]
}

graphs <- fixture$graphs
refs <- list()

# -- shortest paths, spanning forests, components, search ------------------------

for (name in c("karate", "wu", "wd", "disc", "multi", "barbell", "twins")) {
  g <- graphs[[name]]
  G <- ig(g)
  d <- distances(G, v = g$nodes[[1]], mode = "out", weights = E(G)$w,
                 algorithm = "dijkstra")
  refs$dijkstra[[name]] <- list(root = g$nodes[[1]], distance = per_node(g, d[1, ]))
}

for (name in c("wu", "wd", "multi", "disc")) {
  g <- graphs[[name]]
  G <- ig(g)
  refs$floydWarshall[[name]] <- as_matrix_rows(
    distances(G, mode = "out", weights = E(G)$w, algorithm = "johnson"))
}

for (name in c("negd", "wu", "multi")) {
  g <- graphs[[name]]
  G <- ig(g)
  d <- distances(G, v = g$nodes[[1]], mode = "out", weights = E(G)$w,
                 algorithm = "bellman-ford")
  refs$bellmanFord[[name]] <- list(root = g$nodes[[1]], distance = per_node(g, d[1, ]))
}

# igraph raises on a negative cycle reachable from the source
neg_cycle <- tryCatch({
  G <- ig(graphs$negcyc)
  distances(G, v = "0", mode = "out", weights = E(G)$w, algorithm = "bellman-ford")
  FALSE
}, error = function(e) TRUE)
refs$bellmanFord$negcyc <- list(root = "0", hasNegativeWeightCycle = neg_cycle)

for (name in c("wu", "disc", "multi")) {
  g <- graphs[[name]]
  G <- ig(g)
  T <- mst(G, weights = E(G)$w)
  refs$kruskal[[name]] <- list(weight = fin(sum(E(T)$w)), edges = ecount(T))
}

G <- ig(graphs$wd)
comp <- components(G, mode = "strong")
refs$tarjanStronglyConnected$wd <- unname(sets_of(comp$membership, V(G)$name))

for (name in c("karate", "wu", "multi", "disc", "twins")) {
  g <- graphs[[name]]
  G <- ig(g)
  bc <- biconnected_components(G)
  refs$hopcroftTarjanBiconnected[[name]] <- list(
    cut = I(sort(V(G)$name[articulation_points(G)])),
    components = {
      cs <- lapply(bc$components, function(vs) I(sort(V(G)$name[vs])))
      cs[order(sapply(cs, function(s) paste(s, collapse = ",")))]
    }
  )
}

for (name in c("barbell", "multi")) {
  # every edge a unit capacity, so parallel edges count
  refs$kargerStein[[name]] <- min_cut(ig(graphs[[name]]), capacity = NULL,
                                      value.only = TRUE)
}

for (name in c("karate", "wd", "disc")) {
  g <- graphs[[name]]
  G <- ig(g)
  # an unreached node's distance is -1, and the orders hold reached
  # nodes only
  b <- bfs(G, root = g$nodes[[1]], mode = "out", unreachable = FALSE, dist = TRUE)
  reached <- b$dist >= 0
  dd <- dfs(G, root = g$nodes[[1]], mode = "out", unreachable = FALSE)
  refs$search[[name]] <- list(
    root = g$nodes[[1]],
    depth = setNames(as.list(b$dist[reached]), V(G)$name[reached]),
    dfsReach = I(sort(dd$order$name))
  )
}

for (name in names(graphs)) {
  if (!startsWith(name, "euler-")) next
  G <- ig(graphs[[name]])
  refs$hierholzer[[name]] <- list(hasPath = has_eulerian_path(G),
                                  isCircuit = has_eulerian_cycle(G))
}

# -- centralities ----------------------------------------------------------------

# PageRank as the Python reference's cases: undirected walks both ways,
# '-dir' reads the edge list as a digraph
for (case in list(list("karate", FALSE, FALSE), list("karate", FALSE, TRUE),
                  list("wu", TRUE, FALSE), list("wd", FALSE, FALSE),
                  list("wd", TRUE, FALSE))) {
  name <- case[[1]]; weighted <- case[[2]]; as_digraph <- case[[3]]
  g <- graphs[[name]]
  if (as_digraph) g$directed <- TRUE
  G <- ig(g)
  for (d in c(0.85, 0.5)) {
    pr <- page_rank(G, directed = isTRUE(g$directed), damping = d,
                    weights = if (weighted) E(G)$w else NA)$vector
    key <- paste0(name, if (as_digraph) "-dir" else "", if (weighted) "-w" else "",
                  "-d", d)
    refs$pageRank[[key]] <- per_node(g, pr)
  }
}

# degree: raw (v4's 'max' divides it) and igraph's normalized = TRUE
for (name in c("karate", "wd", "multi")) {
  g <- graphs[[name]]
  G <- ig(g)
  if (isTRUE(g$directed)) {
    refs$degreeCentrality[[name]] <- list(
      indegree = per_node(g, degree(G, mode = "in")),
      outdegree = per_node(g, degree(G, mode = "out")),
      indegreeSize = per_node(g, degree(G, mode = "in", normalized = TRUE)),
      outdegreeSize = per_node(g, degree(G, mode = "out", normalized = TRUE)))
  } else {
    refs$degreeCentrality[[name]] <- list(
      degree = per_node(g, degree(G)),
      degreeSize = per_node(g, degree(G, normalized = TRUE)))
  }
}

# closeness and harmonic centrality, both directions.  igraph's
# normalized closeness is r / sum(d) over the r reachable nodes; v4's
# classic (NetworkX's) multiplies that by r / (n - 1) — the spec converts
# with the reached counts recorded here
for (case in list(list("karate", FALSE), list("wu", TRUE), list("wd", TRUE),
                  list("disc", TRUE))) {
  name <- case[[1]]; weighted <- case[[2]]
  g <- graphs[[name]]
  G <- ig(g)
  w <- if (weighted) E(G)$w else NA
  modes <- if (isTRUE(g$directed)) c(out = "out", In = "in") else c(out = "all")
  ref <- list(weighted = weighted)
  for (suffix in names(modes)) {
    mode <- modes[[suffix]]
    s <- if (suffix == "out") "" else suffix
    D <- distances(G, mode = mode, weights = w)
    reached <- rowSums(is.finite(D)) - 1
    ref[[paste0("closenessNormalized", s)]] <- per_node(
      g, suppressWarnings(closeness(G, mode = mode, weights = w, normalized = TRUE)))
    ref[[paste0("reached", s)]] <- per_node(g, reached)
    ref[[paste0("harmonic", s)]] <- per_node(g, harmonic_centrality(G, mode = mode, weights = w))
    ref[[paste0("harmonicSize", s)]] <- per_node(
      g, harmonic_centrality(G, mode = mode, weights = w, normalized = TRUE))
  }
  refs$closenessCentrality[[name]] <- ref
}

for (case in list(list("karate", FALSE), list("wu", TRUE), list("wd", TRUE))) {
  name <- case[[1]]; weighted <- case[[2]]
  g <- graphs[[name]]
  G <- ig(g, multi = FALSE)
  w <- if (weighted) E(G)$w else NA
  refs$betweennessCentrality[[name]] <- list(
    weighted = weighted,
    betweenness = per_node(g, betweenness(G, directed = isTRUE(g$directed), weights = w)),
    normalizedSize = per_node(g, betweenness(G, directed = isTRUE(g$directed), weights = w,
                                             normalized = TRUE)))
}

# Katz is igraph's alpha centrality, x = alpha A^T x + exo: incoming
# walks, as v4's; alpha as the Python reference chose it
for (name in c("wu", "wd")) {
  g <- graphs[[name]]
  G <- ig(g, multi = FALSE)
  alpha <- fixture$references$katzCentrality[[name]]$alpha
  k <- alpha_centrality(G, alpha = alpha, exo = 1, weights = E(G)$w, tol = 1e-15,
                        sparse = FALSE)
  refs$katzCentrality[[name]] <- list(alpha = alpha, katz = per_node(g, k))
}

for (name in c("karate", "wu")) {
  g <- graphs[[name]]
  G <- ig(g, multi = FALSE)
  refs$triangleCount[[name]] <- list(
    triangles = per_node(g, count_triangles(G)),
    clusteringCoefficient = per_node(
      g, transitivity(G, type = "local", isolates = "zero")),
    transitivity = fin(transitivity(G, type = "global")))
}

# igraph sets a node's similarity with itself to 1 even when its
# neighbourhood is empty; v4 and NetworkX's set arithmetic answer 0 there
# (0/0) — the spec pins the diagonal convention separately
for (name in c("karate", "wd")) {
  g <- graphs[[name]]
  G <- ig(g, multi = FALSE)
  refs$neighborhoodSimilarity[[name]] <- list(
    jaccard = as_matrix_rows(similarity(G, mode = "out", method = "jaccard")))
}

refs$motifCensus$wd <- {
  census <- triad_census(ig(graphs$wd, multi = FALSE))
  names(census) <- c("003", "012", "102", "021D", "021U", "021C", "111D", "111U",
                     "030T", "030C", "201", "120D", "120U", "120C", "210", "300")
  as.list(census)
}

# random walk with restart as igraph's personalized PageRank (damping
# is the follow probability 1 - c); its dead ends jump by the reset
# vector, v4's dangling: 'restart'
for (name in c("wd", "wu")) {
  g <- graphs[[name]]
  G <- ig(g)
  c <- 0.15
  reset <- as.numeric(V(G)$name == g$nodes[[1]])
  pr <- page_rank(G, directed = isTRUE(g$directed), damping = 1 - c,
                  personalized = reset, weights = E(G)$w)$vector
  refs$randomWalkWithRestart[[name]] <- list(seed = g$nodes[[1]],
                                             scoreRestart = fin(pr))
}

# -- clustering --------------------------------------------------------------------

pts <- do.call(rbind, lapply(fixture$points, unlist))
grid <- do.call(rbind, lapply(fixture$gridPoints, unlist))
index_sets <- function(labels) {
  s <- lapply(split(seq_along(labels) - 1, labels), I)
  unname(s[order(sapply(s, min))])
}

# hclust + cutree(h = t): a merge at exactly t is kept, as SciPy's and v4's
for (set in list(list("blobs", pts, c(1.5, 3.0, 6.0)), list("grid", grid, c(1.0, 2.0, 3.0)))) {
  for (link in list(c("single", "single"), c("complete", "complete"), c("mean", "average"))) {
    h <- hclust(dist(set[[2]]), method = link[[2]])
    for (t in set[[3]]) {
      refs$hierarchicalClustering[[sprintf("%s-%s-%.1f", set[[1]], link[[1]], t)]] <-
        index_sets(cutree(h, h = t))
    }
  }
}

C0 <- matrix(c(0, 0, 1, 1, 2, 2), ncol = 2, byrow = TRUE)
km <- kmeans(pts, centers = C0, iter.max = 100, algorithm = "Lloyd")
refs$kMeans$blobs <- list(initial = lapply(1:3, function(i) C0[i, ]),
                          clusters = lapply(1:3, function(k) I(which(km$cluster == k) - 1)))

# PAM: BUILD then SWAP from no seed; v4's kMedoids starts from PAM's
# medoids in the spec and must keep them
pm <- pam(pts, k = 3)
refs$kMedoids$blobs <- list(medoids = I(sort(pm$id.med - 1)),
                            clusters = index_sets(pm$clustering))

# fuzzy c-means from seeded centres, to its fixed point (the spec sorts
# centroids by x, as for scikit-fuzzy)
set.seed(150)
cm <- cmeans(pts, centers = pts[c(1, 7, 13), ], m = 2, iter.max = 10000,
             control = list(reltol = 1e-15))
order_x <- order(cm$centers[, 1])
refs$fuzzyCMeans$blobs <- list(
  centroids = lapply(order_x, function(k) fin(cm$centers[k, ])),
  membership = lapply(seq_len(nrow(pts)), function(i) fin(cm$membership[i, order_x])))

# MCL on the karate club and wu, self-loops added (v4's multFactor 1).
# allow1 = TRUE keeps one-node clusters apart, as v4 does; MCL's default
# (FALSE) lumps every singleton into one cluster labelled 0
for (name in c("karate", "wu")) {
  g <- graphs[[name]]
  A <- as_adjacency_matrix(ig(g, multi = FALSE), sparse = FALSE)
  res <- mcl(A, addLoops = TRUE, expansion = 2, inflation = 2, max.iter = 100,
             allow1 = TRUE)
  refs$markovClustering[[name]] <- list(
    iterations = res$n.iterations,
    clusters = unname(sets_of(res$Cluster, as.integer(rownames(A)))))
}

write_json(list(
  generator = "scripts/algorithm-references.R",
  versions = list(
    R = paste(R.version$major, R.version$minor, sep = "."),
    igraph = as.character(packageVersion("igraph")),
    cluster = as.character(packageVersion("cluster")),
    e1071 = as.character(packageVersion("e1071")),
    MCL = as.character(packageVersion("MCL")),
    jsonlite = as.character(packageVersion("jsonlite"))),
  references = refs),
  out_path, auto_unbox = TRUE, digits = NA, na = "null", null = "null", pretty = 1)
cat("wrote", sub(paste0(root, "/"), "", out_path), "\n")
