// GraphStore's module helpers (round 130 split): the compaction rekey and
// the initial flag word of a new element.

import {
  FLAG_ALIVE,
  FLAG_GRABBABLE,
  FLAG_LOCKED,
  FLAG_DRAWN,
  FLAG_PANNABLE,
  FLAG_SELECTABLE,
  FLAG_SELECTED,
  FLAG_SELF_HIDDEN,
  FLAG_VISIBLE,
  NO_SLOT,
} from '../../contract.mjs';
import type { AddElementOpts } from '../graph-store.mjs';

/** Rebuild a slot-keyed map through a compaction remap (19.2). */
export const rekeyMap = <V,>(
  map: Map<number, V>,
  remap: Uint32Array,
): Map<number, V> => {
  const next = new Map<number, V>();

  for (const [slot, value] of map) {
    const d = slot < remap.length ? remap[slot] : NO_SLOT;

    if (d !== NO_SLOT) {
      next.set(d, value);
    }
  }

  return next;
};

/** The flag word a new element starts with, from its `AddElementOpts` (alive, visible and drawn, selectable, grabbable, pannable per the group default). */
export const initialFlags = (
  opts: AddElementOpts,
  pannableDefault: boolean,
): number => {
  let flags = FLAG_ALIVE;

  if (opts.visible !== false) {
    flags |= FLAG_VISIBLE | FLAG_DRAWN;
  } else {
    flags |= FLAG_SELF_HIDDEN;
  }
  if (opts.selectable !== false) {
    flags |= FLAG_SELECTABLE;
  }
  if (opts.selected === true) {
    flags |= FLAG_SELECTED;
  }
  if (opts.grabbable !== false) {
    flags |= FLAG_GRABBABLE;
  }
  if (opts.locked === true) {
    flags |= FLAG_LOCKED;
  }
  if (opts.pannable ?? pannableDefault) {
    flags |= FLAG_PANNABLE;
  }

  return flags;
};
