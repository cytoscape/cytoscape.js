#!/usr/bin/env node
/*
Round 105: the two GeneMANIA fixtures — fetched from genemania.org and
converted here.

  node debug/genemania.mjs                    fetch both, write debug/
  node debug/genemania.mjs genemania-tp53     one of them
  node debug/genemania.mjs --accept-db        accept a newer GeneMANIA database

GeneMANIA's signature picture is tens of parallel edges per gene pair, one
per interaction network, coloured by network type.  The eleventh design
sitting chose two canonical queries, both human (organism 4) and both run
exactly as the genemania.org web app runs them:

  genemania-default  the site's own example query — the "e.g." link in the
                     search box, which fills in the organism's
                     `defaultGenes` (twelve DNA-repair genes for human)
  genemania-tp53     a one-gene query for p53

"Exactly as the web app" means the request its search box sends
(`POST https://genemania.org/json/search_results`): the automatically
selected weighting, 20 result genes, 10 result attributes, every network
the organism marks `defaultSelected` (read from `/json/resources`, as the
app reads it) and no attribute groups (none is selected by default).

**The fixtures are committed** (2026-10-05).  Round 105 kept them out of
the repo and fetched them per checkout, because GeneMANIA publishes no
licence for its data and its terms (https://pages.genemania.org/privacy/)
leave redistribution to the user.  The maintainer, a GeneMANIA coauthor,
approved including them, so `debug/network-genemania-*.json` is checked in
and hosted on the status site like any other real export.  This script is
how they are regenerated, not how a checkout gets them.

The database is pinned: the fixture is "these queries against GeneMANIA's
13 August 2021 database", so a run against a newer one refuses unless
`--accept-db` is passed (update DB_VERSION in the same commit and re-read
the record's numbers).

The conversion mirrors the web app's own `loadGraph` and result
post-processing, so the v4 sheet in debug/styles.js reads the same fields
the app's v3 sheet does:

  nodes  id and name = the symbol (or the typed name, for a query gene)
         score, and normScore = score / the best non-query score, capped
         at 1 (the app's node-size channel); query = 1 for a query gene;
         description = the gene's description
  edges  one per interaction per network — the parallel edges.  group is
         the network group's code (coexp, pi, gi, ...: the colour key, a
         string column the store dictionary-encodes); network is the
         network's name; weight is the interaction's own; absoluteWeight =
         weight x the network's weight, and absoluteWeightPercent = that
         over the result's largest (the app's edge-width channel)

No positions: GeneMANIA lays its result out in the browser, and so does the
harness (`networks.js` names the layout).
*/
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));

export const SERVICE = 'https://genemania.org/json/';

/** The database the fixtures are pinned to (`/json/resources` versions). */
export const DB_VERSION = '13 August 2021 00:00:00';

export const HUMAN = 4;

/** The two canonical queries (eleventh design sitting, 2026-09-28). */
export const QUERIES = {
  'genemania-default': {
    desc: "the genemania.org example query (human 'e.g.' genes)",
    organism: HUMAN,
    // the organism's `defaultGenes`, in the order the app joins them; the
    // fetch checks the site still offers this list
    genes: [
      'RAD51',
      'MLH1',
      'MSH2',
      'DMC1',
      'RAD51AP1',
      'RAD50',
      'MSH6',
      'XRCC3',
      'PCNA',
      'XRCC2',
      'RAD54B',
      'MRE11A',
    ],
    exampleGenes: true,
    file: 'network-genemania-default.json',
  },
  'genemania-tp53': {
    desc: 'a one-gene human query for p53',
    organism: HUMAN,
    genes: ['TP53'],
    exampleGenes: false,
    file: 'network-genemania-tp53.json',
  },
};

/** The web app's search defaults (its `config.defaultMaxGenes` and kin). */
export const SEARCH_DEFAULTS = {
  weighting: 'AUTOMATIC_SELECT',
  geneThreshold: 20,
  attrThreshold: 10,
};

/**
 * The networks the web app selects by default for an organism.
 *
 * @param resources the `/json/resources` payload
 * @param organism the organism id
 */
export function defaultNetworkIds(resources, organism) {
  const groups = resources.networkGroups[String(organism)] ?? [];
  const ids = [];

  for (const g of groups) {
    for (const n of g.interactionNetworks ?? []) {
      if (n.defaultSelected) {
        ids.push(n.id);
      }
    }
  }

  return ids;
}

/**
 * The request body the web app's search box posts.
 *
 * @param query one of QUERIES
 * @param networks the network ids to search (defaultNetworkIds)
 */
export function searchRequest(query, networks) {
  return {
    organism: query.organism,
    genes: query.genes.join('\n'),
    weighting: SEARCH_DEFAULTS.weighting,
    networks,
    attrGroups: [],
    geneThreshold: SEARCH_DEFAULTS.geneThreshold,
    attrThreshold: SEARCH_DEFAULTS.attrThreshold,
    sessionId: 'cytoscapejs-debug-fixture',
  };
}

const round = (v, digits) => {
  const k = 10 ** digits;

  return Math.round(v * k) / k;
};

/**
 * A `search_results` payload in the harness's `{ elements }` shape.
 *
 * @param response the parsed `search_results` payload
 * @returns `{ elements: { nodes, edges } }`
 */
export function convert(response) {
  if (response.error != null) {
    throw new Error(`GeneMANIA answered with an error: ${response.error}`);
  }

  const genes = response.resultGenes;
  const idOf = new Map(); // GeneMANIA gene id -> node id
  const nodes = [];
  let best = 0;

  for (const rg of genes) {
    if (!rg.queryGene && rg.score > best) {
      best = rg.score;
    }
  }

  for (const rg of genes) {
    const name = rg.typedName || rg.gene.symbol;

    if (idOf.has(rg.gene.id)) {
      throw new Error(`gene ${rg.gene.id} appears twice in the result`);
    }

    if (nodes.some((n) => n.data.id === name)) {
      throw new Error(`two result genes are both named ${name}`);
    }

    idOf.set(rg.gene.id, name);
    nodes.push({
      data: {
        id: name,
        name,
        score: round(rg.score, 6),
        normScore: best > 0 ? round(Math.min(rg.score / best, 1), 6) : 1,
        query: rg.queryGene ? 1 : 0,
        description: rg.gene.node?.geneData?.description ?? '',
      },
    });
  }

  const edges = [];
  let maxAbs = 0;

  for (const rng of response.resultNetworkGroups) {
    const group = rng.networkGroup.code;

    for (const rn of rng.resultNetworks) {
      for (const ri of rn.resultInteractions) {
        const source = idOf.get(ri.fromGene.gene.id);
        const target = idOf.get(ri.toGene.gene.id);

        if (source == null || target == null) {
          throw new Error(
            `an interaction in ${rn.network.name} names a gene not in the result`,
          );
        }

        const weight = ri.interaction.weight;
        const absoluteWeight = weight * rn.weight;

        maxAbs = Math.max(maxAbs, absoluteWeight);
        edges.push({
          data: {
            source,
            target,
            group,
            network: rn.network.name,
            weight: round(weight, 6),
            absoluteWeight,
          },
        });
      }
    }
  }

  for (const e of edges) {
    const abs = e.data.absoluteWeight;

    e.data.absoluteWeight = round(abs, 8);
    e.data.absoluteWeightPercent = maxAbs > 0 ? round(abs / maxAbs, 6) : 0;
  }

  return { elements: { nodes, edges } };
}

/**
 * Parallel-edge widths: member count per unordered gene pair.
 *
 * @param elements the converted `{ nodes, edges }`
 * @returns `{ pairs, max, histogram }`, histogram keyed by width
 */
export function bundleWidths(elements) {
  const byPair = new Map();

  for (const e of elements.edges) {
    const { source, target } = e.data;
    const key =
      source < target ? `${source}\t${target}` : `${target}\t${source}`;

    byPair.set(key, (byPair.get(key) ?? 0) + 1);
  }

  const histogram = {};
  let max = 0;

  for (const w of byPair.values()) {
    histogram[w] = (histogram[w] ?? 0) + 1;
    max = Math.max(max, w);
  }

  return { pairs: byPair.size, max, histogram };
}

async function getJson(url, init) {
  const res = await fetch(url, init);

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  }

  return res.json();
}

async function main(argv) {
  const acceptDb = argv.includes('--accept-db');
  const only = argv.filter((a) => !a.startsWith('--'));
  const ids = only.length > 0 ? only : Object.keys(QUERIES);

  for (const id of ids) {
    if (QUERIES[id] == null) {
      throw new Error(
        `no query named ${id}; known: ${Object.keys(QUERIES).join(', ')}`,
      );
    }
  }

  const resources = await getJson(
    `${SERVICE}resources?session_id=cytoscapejs-debug-fixture`,
  );
  const db = resources.versions?.dbVersion;

  if (db !== DB_VERSION && !acceptDb) {
    throw new Error(
      `GeneMANIA now serves database "${db}"; the fixtures are pinned to ` +
        `"${DB_VERSION}".  Re-run with --accept-db and update DB_VERSION.`,
    );
  }

  for (const id of ids) {
    const query = QUERIES[id];
    const organism = resources.organisms.find((o) => o.id === query.organism);

    if (query.exampleGenes) {
      const site = (organism?.defaultGenes ?? []).map((g) => g.symbol);

      if (site.join() !== query.genes.join()) {
        console.warn(
          `${id}: the site's example genes are now ${site.join(' ')} — ` +
            `the query still runs the pinned list`,
        );
      }
    }

    const networks = defaultNetworkIds(resources, query.organism);
    const response = await getJson(`${SERVICE}search_results`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(searchRequest(query, networks)),
    });
    const out = convert(response);
    const widths = bundleWidths(out.elements);

    out.genemania = {
      query: id,
      desc: query.desc,
      genes: query.genes,
      organism: query.organism,
      networks: networks.length,
      dbVersion: db,
      webappVersion: resources.versions?.webappVersion,
      fetched: new Date().toISOString().slice(0, 10),
      source: `${SERVICE}search_results`,
      terms:
        'https://pages.genemania.org/privacy/ — committed with the GeneMANIA authors’ approval',
    };
    writeFileSync(join(DIR, query.file), JSON.stringify(out));
    console.log(
      `${id}: ${out.elements.nodes.length} genes, ` +
        `${out.elements.edges.length} interactions over ${networks.length} ` +
        `default networks; ${widths.pairs} gene pairs, widest bundle ` +
        `${widths.max} -> debug/${query.file}`,
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
