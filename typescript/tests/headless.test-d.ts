// Compile-only test for the slim entries' generated declarations (round
// 131): `cytoscape/headless` and `cytoscape/headless-gpu` take
// `HeadlessOptions` — `CytoscapeOptions` minus the renderer- and
// pointer-only fields — so what a build with no renderer cannot honour is
// a type error, and everything else types as it does on the full entry.
// Run via `npm run test:types`.

import headless from '../../build/dts/headless.js';
import headlessGpu from '../../build/dts/headless-gpu.js';
import type {
  AlgoRun,
  Core,
  HeadlessOptions,
  PatchDiff,
} from '../../build/dts/headless.js';
// each declaration stands alone (no shared chunk), so each entry's `Core`
// is its own type — a consumer imports the one from the entry it uses
import type {
  Core as GpuCore,
  PatchDiff as GpuPatchDiff,
} from '../../build/dts/headless-gpu.js';

const options: HeadlessOptions = {
  elements: [{ data: { id: 'a' } }, { data: { id: 'b' } }],
  style: { nodes: { width: 20 } },
  layout: { name: 'grid' },
  headlessWidth: 640,
  headlessHeight: 480,
  zoom: 2,
};

const cy: Core = headless(options);
const cyGpu: GpuCore = headlessGpu({ elements: [] });

const ranks: AlgoRun<unknown> = cy.elements().pageRank({ executor: 'cpu' });

void ranks;
void cyGpu;

// @ts-expect-error a build with no renderer takes no container
headless({ container: null });
// @ts-expect-error nor the renderer's options
headlessGpu({ renderer: {} });
// @ts-expect-error nor the pointer handler's
headless({ wheelSensitivity: 1 });
// @ts-expect-error nor box selection
headlessGpu({ boxSelectionEnabled: true });
// @ts-expect-error nor the pixel ratio
headless({ pixelRatio: 2 });

// the statics type as on the full entry
const buffer: ArrayBuffer = headless.serializeElements({ nodes: [] });

void headlessGpu.deserializeElements(buffer);

// round 107: patch ships on every entry, its types with it
const patched: PatchDiff = cy.patch(buffer, { mode: 'merge' });
const patchedGpu: GpuPatchDiff = cyGpu.patch(buffer);

void patched;
void patchedGpu;
