#!/usr/bin/env node
/*
Round 124.1: the Greek-gods genealogy fixture — the data behind Matteo
Abrate's tangled-tree visualisation (Observable, @nitaku/tangled-tree-
visualization-ii; GeneaQuilts with curved links), the reference picture
for the taxi-track round.  67 nodes over 7 generations, 92 parent →
child edges; 20 nodes have two parents, so `taxi-track: family`
(the notebook's bundle key) draws one trunk per parent pair.

  node benchmark/fixtures/dag/derive-greek-gods.mjs   # rewrites greek-gods.json

Sizes stand in for the labels the picture draws (7 px per character,
24 px tall) so the harness's overlap and area columns see something
label-shaped rather than a point.
*/
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LEVELS = [
  [{ id: 'Chaos' }],
  [{ id: 'Gaea', parents: ['Chaos'] }, { id: 'Uranus' }],
  [
    { id: 'Oceanus', parents: ['Gaea', 'Uranus'] },
    { id: 'Thethys', parents: ['Gaea', 'Uranus'] },
    { id: 'Pontus' },
    { id: 'Rhea', parents: ['Gaea', 'Uranus'] },
    { id: 'Cronus', parents: ['Gaea', 'Uranus'] },
    { id: 'Coeus', parents: ['Gaea', 'Uranus'] },
    { id: 'Phoebe', parents: ['Gaea', 'Uranus'] },
    { id: 'Crius', parents: ['Gaea', 'Uranus'] },
    { id: 'Hyperion', parents: ['Gaea', 'Uranus'] },
    { id: 'Iapetus', parents: ['Gaea', 'Uranus'] },
    { id: 'Thea', parents: ['Gaea', 'Uranus'] },
    { id: 'Themis', parents: ['Gaea', 'Uranus'] },
    { id: 'Mnemosyne', parents: ['Gaea', 'Uranus'] },
  ],
  [
    { id: 'Doris', parents: ['Oceanus', 'Thethys'] },
    { id: 'Neures', parents: ['Pontus', 'Gaea'] },
    { id: 'Dionne' },
    { id: 'Demeter', parents: ['Rhea', 'Cronus'] },
    { id: 'Hades', parents: ['Rhea', 'Cronus'] },
    { id: 'Hera', parents: ['Rhea', 'Cronus'] },
    { id: 'Alcmene' },
    { id: 'Zeus', parents: ['Rhea', 'Cronus'] },
    { id: 'Eris' },
    { id: 'Leto', parents: ['Coeus', 'Phoebe'] },
    { id: 'Amphitrite' },
    { id: 'Medusa' },
    { id: 'Poseidon', parents: ['Rhea', 'Cronus'] },
    { id: 'Hestia', parents: ['Rhea', 'Cronus'] },
  ],
  [
    { id: 'Thetis', parents: ['Doris', 'Neures'] },
    { id: 'Peleus' },
    { id: 'Anchises' },
    { id: 'Adonis' },
    { id: 'Aphrodite', parents: ['Zeus', 'Dionne'] },
    { id: 'Persephone', parents: ['Zeus', 'Demeter'] },
    { id: 'Ares', parents: ['Zeus', 'Hera'] },
    { id: 'Hephaestus', parents: ['Zeus', 'Hera'] },
    { id: 'Hebe', parents: ['Zeus', 'Hera'] },
    { id: 'Hercules', parents: ['Zeus', 'Alcmene'] },
    { id: 'Megara' },
    { id: 'Deianira' },
    { id: 'Eileithya', parents: ['Zeus', 'Hera'] },
    { id: 'Ate', parents: ['Zeus', 'Eris'] },
    { id: 'Leda' },
    { id: 'Athena', parents: ['Zeus'] },
    { id: 'Apollo', parents: ['Zeus', 'Leto'] },
    { id: 'Artemis', parents: ['Zeus', 'Leto'] },
    { id: 'Triton', parents: ['Poseidon', 'Amphitrite'] },
    { id: 'Pegasus', parents: ['Poseidon', 'Medusa'] },
    { id: 'Orion', parents: ['Poseidon'] },
    { id: 'Polyphemus', parents: ['Poseidon'] },
  ],
  [
    { id: 'Deidamia' },
    { id: 'Achilles', parents: ['Peleus', 'Thetis'] },
    { id: 'Creusa' },
    { id: 'Aeneas', parents: ['Anchises', 'Aphrodite'] },
    { id: 'Lavinia' },
    { id: 'Eros', parents: ['Hephaestus', 'Aphrodite'] },
    { id: 'Helen', parents: ['Leda', 'Zeus'] },
    { id: 'Menelaus' },
    { id: 'Polydueces', parents: ['Leda', 'Zeus'] },
  ],
  [
    { id: 'Andromache' },
    { id: 'Neoptolemus', parents: ['Deidamia', 'Achilles'] },
    { id: 'Aeneas(2)', parents: ['Creusa', 'Aeneas'] },
    { id: 'Pompilius', parents: ['Creusa', 'Aeneas'] },
    { id: 'Iulus', parents: ['Lavinia', 'Aeneas'] },
    { id: 'Hermione', parents: ['Helen', 'Menelaus'] },
  ],
];

/** The fixture in the harness's shape. */
export const greekGods = () => {
  const nodes = [];
  const edges = [];

  LEVELS.forEach((level, generation) => {
    for (const n of level) {
      nodes.push({
        id: n.id,
        w: Math.max(30, n.id.length * 7),
        h: 24,
        generation,
      });

      for (const p of n.parents ?? []) {
        edges.push({ id: `${p}->${n.id}`, source: p, target: n.id });
      }
    }
  });

  return { nodes, edges };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = join(dirname(fileURLToPath(import.meta.url)), 'greek-gods.json');
  const fx = greekGods();

  writeFileSync(out, JSON.stringify(fx));
  console.log(`${out}: ${fx.nodes.length} nodes, ${fx.edges.length} edges`);
}
