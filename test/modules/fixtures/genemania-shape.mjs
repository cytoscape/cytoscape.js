// Round 105: the *shape* of a GeneMANIA `search_results` payload, for the
// converter's specs — not GeneMANIA data.  The committed fixtures are the
// converter's *output*, so the specs need a raw payload, and fetching one
// would put the network in the suite.  This one carries only the fields the
// converter reads, laid out as
// the service returns them (checked against a live response, 2026-09-29),
// with made-up genes and networks: three genes, two network groups, and one
// pair carrying three parallel edges.

/** A three-gene payload: GENE_A queried, GENE_B and GENE_C returned. */
export function shapeSample() {
  const gene = (id, symbol, score, queryGene, typedName) => ({
    gene: {
      id,
      symbol,
      node: { id: id + 1000, geneData: { description: `${symbol} (made up)` } },
    },
    score,
    queryGene,
    typedName: typedName ?? null,
  });
  const interaction = (from, to, weight) => ({
    interaction: { id: 0, weight },
    fromGene: { gene: { id: from } },
    toGene: { gene: { id: to } },
  });

  return {
    error: null,
    resultGenes: [
      // typed in lower case: the app names a query gene as typed
      gene(1, 'GENE_A', 0.9, true, 'gene_a'),
      gene(2, 'GENE_B', 0.5, false),
      gene(3, 'GENE_C', 0.25, false),
    ],
    resultNetworkGroups: [
      {
        networkGroup: { code: 'pi', name: 'Physical Interactions' },
        weight: 0.6,
        resultNetworks: [
          {
            network: { id: 10, name: 'Study-One-2001' },
            weight: 0.4,
            resultInteractions: [
              interaction(1, 2, 0.5),
              interaction(2, 3, 0.25),
            ],
          },
          {
            network: { id: 11, name: 'Study-Two-2002' },
            weight: 0.2,
            resultInteractions: [interaction(2, 1, 1)],
          },
        ],
      },
      {
        networkGroup: { code: 'coexp', name: 'Co-expression' },
        weight: 0.4,
        resultNetworks: [
          {
            network: { id: 20, name: 'Study-Three-2003' },
            weight: 0.1,
            resultInteractions: [interaction(1, 2, 0.8)],
          },
        ],
      },
    ],
  };
}
