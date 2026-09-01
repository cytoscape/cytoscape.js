#!/usr/bin/env node
/*
Round 112: the Reactome fixture — a real biological DAG for the flow
layout, in both the quality-harness shape and the debug-page shape.

  node benchmark/fixtures/dag/derive-reactome.mjs   fetch + regenerate

Source: Reactome's pathway hierarchy (https://reactome.org, data
released under CC0), from the current-release exports:

  https://reactome.org/download/current/ReactomePathwaysRelation.txt
  https://reactome.org/download/current/ReactomePathways.txt

The fixture is the **human Immune System subtree** (R-HSA-168256):
~227 pathways over ~245 hasEvent relations — a true DAG, not a tree
(about 19 pathways have multiple parents), at reading size.  Nodes
carry the pathway `name` for labels and `band` = hierarchy depth % 5,
so the debug scene's colour restates what the layered drawing claims.

Unlike the other fixtures this derivation fetches the network — the
checked-in JSONs are the artifact; rerun this script to refresh them
against a newer Reactome release (record the release in the commit).
*/
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, '..', '..', '..');
const BASE = 'https://reactome.org/download/current';
const ROOT_PATHWAY = 'R-HSA-168256'; // Immune System

const fetchText = async (name) => {
  const res = await fetch(`${BASE}/${name}`);

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${name}`);
  }

  return res.text();
};

const [relText, nameText] = await Promise.all([
  fetchText('ReactomePathwaysRelation.txt'),
  fetchText('ReactomePathways.txt'),
]);

const nameOf = new Map(
  nameText
    .split('\n')
    .filter((l) => l.startsWith('R-HSA'))
    .map((l) => l.split('\t'))
    .map(([id, name]) => [id, name]),
);

const kids = new Map();

for (const line of relText.split('\n')) {
  if (!line.startsWith('R-HSA')) {
    continue;
  }

  const [parent, child] = line.split('\t');

  if (!kids.has(parent)) {
    kids.set(parent, []);
  }

  kids.get(parent).push(child);
}

// the subtree, breadth-first so depth is the shortest hop count
const depthOf = new Map([[ROOT_PATHWAY, 0]]);
const order = [ROOT_PATHWAY];
const edges = [];

for (let i = 0; i < order.length; i++) {
  const v = order[i];

  for (const c of kids.get(v) ?? []) {
    edges.push([v, c]);

    if (!depthOf.has(c)) {
      depthOf.set(c, depthOf.get(v) + 1);
      order.push(c);
    }
  }
}

// harness shape (benchmark/fixtures/dag) — uniform bodies; the metric
// suite reads w/h
const harness = {
  nodes: order.map((id) => ({ id, name: nameOf.get(id) ?? id, w: 30, h: 30 })),
  edges: edges.map(([source, target], i) => ({ id: `e${i}`, source, target })),
};

writeFileSync(join(DIR, 'reactome.json'), JSON.stringify(harness));

// debug shape (v3 elements JSON, what the harness page's url: path eats)
const debug = {
  elements: {
    nodes: order.map((id) => ({
      data: {
        id,
        name: nameOf.get(id) ?? id,
        band: depthOf.get(id) % 5,
      },
    })),
    edges: edges.map(([source, target], i) => ({
      data: { id: `e${i}`, source, target },
    })),
  },
};

writeFileSync(
  join(ROOT, 'debug', 'network-reactome.json'),
  JSON.stringify(debug),
);

const joins = order.filter(
  (id) => edges.filter(([, c]) => c === id).length > 1,
).length;

console.log(
  `reactome (${ROOT_PATHWAY} ${nameOf.get(ROOT_PATHWAY)}): ` +
    `${order.length} pathways, ${edges.length} relations, ` +
    `${joins} multi-parent joins, depth ${Math.max(...depthOf.values())}`,
);
