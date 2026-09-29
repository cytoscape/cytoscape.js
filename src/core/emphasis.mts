// Core's transient emphasis (round 102): `emphasize()` / `unemphasize()`,
// the hover-highlight gesture as view state.  The emphasized set is the
// FLAG_EMPHASIZED bit; the dim of everything else is the renderer's
// two-tier composite, switched by one store scalar — so a change costs
// O(old set + new set), never O(graph).

import { FLAG_EMPHASIZED } from '../contract.mjs';
import type { Ref } from '../contract.mjs';
import type { Core } from '../core.mjs';
import type { Collection } from '../collection.mjs';
import { assertCollection, packRef, refIndex } from '../collection/shared.mjs';

/** Make `eles` exactly the emphasized set and turn the composite on; only the elements that enter or leave the set are written. */
export function emphasize(core: Core, eles: Collection): Core {
  assertCollection(eles, 'emphasize', core);

  const store = core._store;
  const prev = core._emphasis;
  const next: Ref[] = eles._refs.slice();

  if (prev != null && prev.length > 0) {
    // moving straight from one emphasis to another: clear only the
    // elements that leave, so one in both sets is not restyled twice
    const keep = refIndex(next);
    const leaving = prev.filter((ref) => !keep.has(packRef(ref)));

    store.flagRefs(leaving, FLAG_EMPHASIZED, false);
  }

  store.flagRefs(next, FLAG_EMPHASIZED, true);
  core._emphasis = next;
  store.setEmphasisOn(true);

  return core;
}

/** Clear the emphasized set and turn the composite off; a no-op when no emphasis is set. */
export function unemphasize(core: Core): Core {
  const prev = core._emphasis;

  if (prev == null) {
    return core;
  }

  core._store.flagRefs(prev, FLAG_EMPHASIZED, false);
  core._emphasis = null;
  core._store.setEmphasisOn(false);

  return core;
}
