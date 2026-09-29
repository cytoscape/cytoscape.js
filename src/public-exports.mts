/*
The typed surface every entry ships (round 131.3): the type re-exports
that were `index.mts`'s, in one place so the full entry and the two slim
ones (`headless.mts`, `headless-gpu.mts`) declare the same names.  Types
only — an entry's values are its factory and the statics assigned in the
entry file itself, where `scripts/docs-generate.mjs` reads them.
*/

export type * from './public-types.mjs';
export type { Core } from './core.mjs';
export type { Collection } from './collection.mjs';
// round 107: `cy.patch()`'s option and result shapes
export type { PatchDiff, PatchMode, PatchOptions } from './core/patch.mjs';
// round 106: `cy.clone()`'s options, and how a following clone keeps up
export type { CloneOptions, FollowOptions } from './core/clone.mjs';
// round 103: the converter's option (node references for chunks)
export type { ToColumnarOptions } from './columnar.mjs';
// round 41: v4's own event object, so a handler's parameter has a real type
// and `event.target` is no longer `unknown`
export type { Event, EventProps, EventTarget } from './event.mjs';
export type { EventHandler } from './emitter.mjs';
// round 128: the cancellation contract's types — the handle every async
// algorithm returns, and the rejection a cancelled run or layout carries
export type { AlgoRun } from './algorithms/cancel.mjs';
// round 45: the layout-extension contract, for the same reason.  Round 17
// made `cy.layout({ impl })` the whole extension story — no registry, an
// import passed straight in — but only `CustomLayoutOptions` reached the
// declaration, so an external author writing `run( ctx )` got `ctx: any` and
// the one surface the contract exists to make obvious was the one with no
// types.  `LayoutContext` was in no declaration at all (round 34.6 recorded
// it appearing only inside a doc comment).
export type {
  LayoutContext,
  LayoutImpl,
  CustomLayout,
} from './layout/contract.mjs';
