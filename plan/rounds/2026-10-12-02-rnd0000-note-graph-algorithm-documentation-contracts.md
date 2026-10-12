## Graph algorithm documentation contracts

**Depends on:** 46, 2026-10-12-01

The scoped round-46 prose/API audit found twelve graph-algorithm method
comments too terse for their reference pages. Their JSDoc now explains the
implemented traversal, callback, option, result and failure contracts, using
the current algorithms and public types rather than inheriting v3 behavior.

The methods are breadthFirstSearch, depthFirstSearch, dijkstra, aStar,
bellmanFord, kruskal, tarjanStronglyConnected, hopcroftTarjanBiconnected,
hierholzer, kargerStein, degreeCentrality and degreeCentralityNormalized.
Review corrected assumptions about BFS root/callback versus discovery order,
early stopping, Dijkstra's singleton path for an unreachable target,
Bellman-Ford's empty unreachable path, A* cost/heuristic assumptions,
parallel parent edges in biconnected components, contraction failure and
unvalidated numeric weights. No runtime behavior was changed to match prose.

The three shipped declarations were regenerated from the source. A
TypeScript scanner comparison against HEAD found identical non-trivia token
sequences in the source (10,811 tokens) and declarations (19,104 / 19,099 /
19,099 tokens), confirming that the edit changes comments only.

### Verification at the isolated documentation commit

The documentation agent ran verify and test:throws:quiet successfully, then
regenerated the public declarations with build:types. docs:api and the
round-46 inventory regeneration succeeded: 352 documented entries in 48
sections and seven namespaces. Representative headless prose examples were
also executed and corrected to use the supported data(label) string mapping.

The full Node gate is **not recorded green here**. Its module tier exposed
in-progress Deno/Bun script and documentation-link integration failures, plus
subprocess/reporting failures under investigation in round 99. Final Node/Bun
integration checks follow once the independently owned changes settle. This
note records the source-comment improvement, not completion of round 46 or
the full prose/site pass.
