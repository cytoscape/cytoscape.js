import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generatedPath = path.join(root, 'build/docs/api.json');
const v3Path = path.join(root, 'v3/documentation/docmaker.json');
const outputPath = path.join(root, 'documentation/api-inventory.json');

if (!fs.existsSync(generatedPath)) {
  throw new Error('Run `npm run -s docs:api` before building the inventory.');
}

const generated = JSON.parse(fs.readFileSync(generatedPath, 'utf8'));
const v3 = JSON.parse(fs.readFileSync(v3Path, 'utf8'));

function flatten(sections, out = []) {
  for (const section of sections ?? []) {
    for (const fn of section.fns ?? []) {
      out.push({ fn, section: section.name ?? '' });
    }
    flatten(section.sections, out);
  }

  return out;
}

function words(text) {
  return (text?.match(/[A-Za-z0-9_]+/g) ?? []).length;
}

function normalizeV3Name(name) {
  return name.replace(/^(ele|node|nodes|edge|edges)\./, 'eles.');
}

const generatedFns = flatten(generated.sections).map(({ fn, section }) => ({
  name: fn.name,
  namespace: fn.name.split('.')[0],
  section,
  source: fn.src,
  summary: fn.descr ?? '',
  summaryWords: words(fn.descr),
  formats: (fn.formats ?? []).map((format) => ({
    descriptionWords: words(format.descr),
    argumentCount: (format.args ?? []).length,
    arguments: (format.args ?? []).map((arg) => ({
      name: arg.name ?? '',
      descriptionWords: words(arg.descr),
    })),
  })),
  returnWords: words(fn.returns),
  throwCount: (fn.throws ?? []).length,
}));

const generatedByName = new Map(generatedFns.map((fn) => [fn.name, fn]));

// Source aliases are public type/runtime names whose documentation is carried
// by their canonical implementation member, rather than a second API entry.
const aliases = {
  'cy.$': { canonical: 'cy.filter', source: 'src/core.mts' },
  'cy.removeListener': { canonical: 'cy.off', source: 'src/core.mts' },
  'eles.once': { canonical: 'eles.one', source: 'src/collection.mts' },
  'eles.removeListener': { canonical: 'eles.off', source: 'src/collection.mts' },
  'eles.merge': { canonical: 'eles.union', source: 'src/collection.mts' },
  'eles.unmerge': { canonical: 'eles.difference', source: 'src/collection.mts' },
  'nodes.ancestors': { canonical: 'eles.parents', source: 'src/collection.mts' },
};

const decidedRemovals = {
  'cy.clearQueue': 'round 21 removes queued animations; a queue cannot be cleared.',
  'eles.clearQueue': 'round 21 removes queued animations; a queue cannot be cleared.',
  'eles.restore': 'Removed element references are terminal; there is no restore path.',
  'eles.clone': 'Element-level cloning is absent; graph-level cy.clone() has separate semantics.',
  'eles.addClass': 'v4 has no class state or selector language.',
  'eles.removeClass': 'v4 has no class state or selector language.',
  'eles.toggleClass': 'v4 has no class state or selector language.',
  'eles.classes': 'v4 has no class state or selector language.',
  'eles.flashClass': 'v4 has no class state or selector language.',
  'ele.hasClass': 'v4 has no class state or selector language.',
  'layout.on': 'Layout instances are not event emitters; lifecycle events are emitted by the core.',
  'layout.promiseOn': 'Layout instances are not event emitters; lifecycle events are emitted by the core.',
  'layout.one': 'Layout instances are not event emitters; lifecycle events are emitted by the core.',
  'layout.removeListener': 'Layout instances are not event emitters; lifecycle events are emitted by the core.',
  'layout.removeAllListeners': 'Layout instances are not event emitters; lifecycle events are emitted by the core.',
  'layout.emit': 'Layout instances are not event emitters; lifecycle events are emitted by the core.',
  'ani.apply': 'Animation progress is read-only; v4 handles do not support scrubbing.',
  'ani.applying': 'Animation progress is read-only; v4 handles do not support scrubbing.',
};

const openQuestions = {
  'cy.delay': 'Round 21 says delay remains after removing the queue, but current v4 only has collection delay methods.',
  'cy.delayAnimation': 'There is no dedicated no-op viewport delay handle; a delayed viewport animation is not established as equivalent.',
  'eles.removeAllListeners': 'Collection off(events, handler?) requires event names and cannot remove every event type.',
  'ele.numericStyleUnits': 'v4 has numericStyle() and renderedStyle(), but no unit-query member.',
  'ani.completed': 'v4 promise() resolves on completion or stop and is not a boolean completion-state getter.',
};

function mapV3Entry({ fn, section }) {
  const normalized = normalizeV3Name(fn.name);
  const alias = aliases[fn.name];
  const resolved = alias?.canonical ?? normalized;
  const isGenerated = generatedByName.has(resolved);
  const disposition = isGenerated
    ? alias
      ? 'source-alias'
      : 'generated-entry'
    : decidedRemovals[fn.name]
      ? 'decided-removal'
      : openQuestions[fn.name]
        ? 'open-question'
        : 'unclassified-gap';

  return {
    v3Name: fn.name,
    v3Section: section,
    v3Markdown: fn.md ? `v3/documentation/md/${fn.md}.md` : null,
    normalizedV4Candidate: normalized,
    resolvedV4Name: isGenerated ? resolved : null,
    disposition,
    evidence: decidedRemovals[fn.name] ?? openQuestions[fn.name] ?? null,
    aliasSource: alias?.source ?? null,
    v3Summary: fn.descr ?? '',
  };
}

const v3Entries = flatten(v3.sections.filter((section) => section.name !== 'Demos'))
  .map(mapV3Entry);
const v3ApiNames = new Set(v3Entries.map((entry) => entry.v3Name));
const mappedToV4 = new Map();
for (const entry of v3Entries) {
  if (entry.resolvedV4Name) {
    const previous = mappedToV4.get(entry.resolvedV4Name) ?? [];
    previous.push(entry.v3Name);
    mappedToV4.set(entry.resolvedV4Name, previous);
  }
}

for (const fn of generatedFns) {
  fn.v3Names = mappedToV4.get(fn.name) ?? [];
}

const proseSections = v3.sections
  .filter((section) => section.name && section.name !== 'Demos')
  .map((section) => ({
    name: section.name,
    markdown: section.md ?? section.mdTemplate ?? null,
    functionCount: flatten(section.sections ?? []).length + (section.fns?.length ?? 0),
  }));

const shortSummaryThreshold = 18;
const result = {
  inventoryVersion: 1,
  generatedFrom: [
    'build/docs/api.json (npm run -s docs:api)',
    'v3/documentation/docmaker.json (read-only baseline)',
    'documentation/build-api-inventory.mjs',
  ],
  comparisonRules: {
    ownerNormalization: 'ele/node/nodes/edge/edges → eles; other namespaces retain their prefix',
    sourceAliases: aliases,
    v3ProseSectionsExcludingDemos: proseSections,
    decisions: {
      decidedRemovals,
      openQuestions,
      unclassified: 'Any row with disposition=unclassified-gap is a failure requiring review.',
    },
  },
  counts: {
    v3UniqueApiNames: v3ApiNames.size,
    v3LongFormMemberPages: v3Entries.filter((entry) => entry.v3Markdown).length,
    v3ProseSections: proseSections.length,
    v4GeneratedApiEntries: generatedFns.length,
    v4Namespaces: [...new Set(generatedFns.map((entry) => entry.namespace))].sort(),
    v4GeneratedGroups: generated.sections.reduce((sum, group) => {
      function countSections(sections) {
        return (sections ?? []).reduce((total, section) => 1 + total + countSections(section.sections), 0);
      }
      return sum + countSections(group.sections);
    }, 0),
    mappedV3Names: v3Entries.filter((entry) => entry.resolvedV4Name).length,
    decidedRemovalNames: v3Entries.filter((entry) => entry.disposition === 'decided-removal').length,
    openQuestionNames: v3Entries.filter((entry) => entry.disposition === 'open-question').length,
    unclassifiedNames: v3Entries.filter((entry) => entry.disposition === 'unclassified-gap').length,
    shortSummaryThresholdWords: shortSummaryThreshold,
    v4ShortSummaryEntries: generatedFns.filter((entry) => entry.summaryWords < shortSummaryThreshold).length,
  },
  substanceReview: {
    machineChecks: [
      'Every generated v4 entry records its namespace, source, summary word count, overload count, per-format argument count and description lengths, return description length, and throw count.',
      'Every v3 name records its original section/page, normalized candidate, resolved v4 member or explicit disposition, and v3 summary.',
      'Short summaries are surfaced for review; a short comment is not automatically deficient when the member is a simple read-only accessor.',
    ],
    manualReviewRubric: [
      'Read the implementation and public types, then check the comment against the actual inputs, defaults, effects, result shape and errors.',
      'For async or lifecycle APIs, check timing, cancellation, completion and event ownership.',
      'For aliases and migrations, check that a similar spelling is an actual runtime/type alias and that any claimed replacement is decided in source records.',
      'Use the v3 page only to establish v3 behavior; never inherit its contract without confirming v4 source.',
    ],
    deepReads: [
      { api: 'cytoscape', source: 'src/index.mts', finding: 'Factory docs distinguish rendered versus headless construction, readiness failure, initial bulk load/layout, entry tiers, unknown-option behavior and typed data.' },
      { api: 'cy.load', source: 'src/core.mts and src/core/load.mts', finding: 'Loading docs distinguish initial and populated loads, first-chunk readiness/fit, progress payloads, single-load guard, cancellation, partial preservation and chunk failure.' },
      { api: 'cy.png/cy.jpg', source: 'src/core.mts and src/render/renderer/export-view.mts', finding: 'Export docs cover async GPU readback, rendered-only availability, output encodings, full versus viewport units, max-dimension precedence, defaults and concrete rejection conditions.' },
      { api: 'cy.style', source: 'src/core.mts', finding: 'Read/write overloads cover sheet replacement and stored style reads; the v4 sheet shape and lack of selector blocks are explained in prose.' },
      { api: 'cy.on', source: 'src/core.mts', finding: 'Overloads identify core handlers, delegated query/predicate handlers and their event context; v4 uses literal event names.' },
      { api: 'cy.fit', source: 'src/core.mts', finding: 'Viewport fit docs are checked against label-inclusive bounds and the actual pan/zoom update.' },
      { api: 'eles.map', source: 'src/collection.mts', finding: 'Collection mapping returns a plain array in collection order; callbacks receive length-one element collections.' },
      { api: 'eles.position', source: 'src/collection.mts', finding: 'Model-space access, node-only writes and coordinate validation are stated at the public member.' },
      { api: 'eles.animate', source: 'src/collection.mts', finding: 'Target channels, defaults, time/easing and latest-wins behavior are checked against the animation manager.' },
      { api: 'eles.boundingBox', source: 'src/collection.mts', finding: 'Bounds options and included geometry are checked against the renderer-independent store geometry.' },
      { api: 'eles.breadthFirstSearch/depthFirstSearch', source: 'src/collection.mts and src/algorithms/search.mts', finding: 'The callback argument order, root queue order, BFS discovery-path behavior, early-stop results, selector-string error and subgraph scope were checked against implementation.' },
      { api: 'eles.dijkstra/bellmanFord/aStar', source: 'src/collection.mts and src/algorithms/{dijkstra,bellman-ford,a-star}.mts', finding: 'Root checks, direction, weight defaults, negative-cycle behavior, path results and the implemented Dijkstra unreachable-target singleton path were checked against result construction.' },
      { api: 'eles.tarjanStronglyConnected/hopcroftTarjanBiconnected', source: 'src/collection.mts and src/algorithms/{tarjan-strongly-connected,hopcroft-tarjan-biconnected}.mts', finding: 'Component/cut collection contents, direction, iterative versus recursive implementation and the parallel-parent-edge quirk were compared with source.' },
      { api: 'eles.kargerStein', source: 'src/collection.mts and src/algorithms/karger-stein.mts', finding: 'Randomness, connected-input assumption, result partitions and actual contraction error guards were checked; no upfront connectivity validation is claimed.' },
      { api: 'eles.degreeCentrality/degreeCentralityNormalized', source: 'src/collection.mts and src/algorithms/degree-centrality.mts', finding: 'The Opsahl formula, alpha defaults, directed accessors, per-direction normalization and unvalidated numeric assumptions were checked.' },
      { api: 'layout.run', source: 'src/layout/contract.mts', finding: 'The extension contract documents scope, options, promise/lifecycle, stop/cancel and the core-owned event surface.' },
      { api: 'eles.floydWarshall', source: 'src/collection.mts', finding: 'Async execution tiers, result accessors, cancellation and executor failures are described.' },
      { api: 'eles.pageRank', source: 'src/collection.mts', finding: 'Async result, option surface, executor choice, cancellation and unavailable GPU failures are described.' },
    ],
    algorithmCommentsTargetedForExpansion: [
      'eles.breadthFirstSearch', 'eles.depthFirstSearch', 'eles.dijkstra', 'eles.aStar',
      'eles.bellmanFord', 'eles.kruskal', 'eles.tarjanStronglyConnected',
      'eles.hopcroftTarjanBiconnected', 'eles.hierholzer', 'eles.kargerStein',
      'eles.degreeCentrality', 'eles.degreeCentralityNormalized',
    ],
  },
  v3ApiEntries: v3Entries,
  v4ApiEntries: generatedFns,
};

if (result.counts.unclassifiedNames !== 0) {
  throw new Error(`Inventory has ${result.counts.unclassifiedNames} unclassified v3 API names.`);
}

fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Wrote ${path.relative(root, outputPath)} (${v3Entries.length} v3 names, ${generatedFns.length} v4 entries).`);
