// Round 43.2: how `debug/network-ndex-x-large.json` was derived.
//
// The previous slim kept id/source/target/position only, which left the biggest
// fixture unlabellable *and* unstylable.  This one keeps the columns the
// harness's sheet maps, and is committed so the fixture is reproducible rather
// than a mystery blob.
//
// Run it against the full-fat original (250 MB, range-request capable):
//
//   curl -o ndex-full.json \
//     https://pub-835fc16db602427ba8b9a874e4754257.r2.dev/network-ndex-x-large.json
//   node --max-old-space-size=16384 debug/slim-ndex.mjs
//   mv ndex-slim.json debug/network-ndex-x-large.json
//
// The heap flag is not optional: JSON.parse of 250 MB needs well past the
// default old-space.
import { readFileSync, writeFileSync, statSync } from 'node:fs';

const src = JSON.parse(readFileSync('ndex-full.json', 'utf8'));
const { nodes, edges } = src.elements;

const r3 = (v) =>
  typeof v === 'number' ? Math.round(v * 1000) / 1000 : undefined;
const r2 = (v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v);

const outNodes = nodes.map((n) => {
  const d = n.data;
  const data = { id: String(d.id), name: d.name };

  if (d.Node_Type != null) {
    data.Node_Type = d.Node_Type;
  }

  return { data, position: { x: r2(n.position.x), y: r2(n.position.y) } };
});

// edge ids are dropped: v4 assigns one when absent, and 465k of them cost more
// than the two numeric channels that make the fixture worth styling
const outEdges = edges.map((e) => {
  const d = e.data;
  const data = { source: String(d.source), target: String(d.target) };
  // one numeric channel only: at 465k edges the *key name* is the cost
  // (~465k x 21 bytes), so a second channel would add ~11 MB to the checked-in
  // fixture.  Mechanism_of_Action (-1..1) is the one worth keeping — it drives
  // the diverging colour mapper, which is a paint channel and so the thing the
  // GPU eval kernel actually demonstrates at this scale.  Edge width is a
  // geometry channel (CPU-evaluated by design), so mapping it would show less
  // for more bytes.
  const moa = r3(d.Mechanism_of_Action);

  if (moa !== undefined) {
    data.Mechanism_of_Action = moa;
  }

  return { data };
});

writeFileSync(
  'ndex-slim.json',
  JSON.stringify({ elements: { nodes: outNodes, edges: outEdges } }),
);

const withName = outNodes.filter((n) => n.data.name).length;
const tf = outNodes.filter((n) => n.data.Node_Type === 'TF').length;
const withMoa = outEdges.filter(
  (e) => e.data.Mechanism_of_Action !== undefined,
).length;

console.log(
  `nodes ${outNodes.length} (name on ${withName}, Node_Type=TF on ${tf})`,
);
console.log(`edges ${outEdges.length} (Mechanism_of_Action on ${withMoa})`);
console.log(
  `slim size ${(statSync('ndex-slim.json').size / 1048576).toFixed(1)} MB`,
);
