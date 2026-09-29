// An animation's apply and finish (round 130 split): one interpolated
// write of every captured channel, and the completion.

import { GROUP_EDGES, GROUP_NODES, COL, FLAG_PARENT } from '../contract.mjs';
import type { ColumnId } from '../contract.mjs';
import { TWEEN_COL, lerp, clampTo, STRIDE, mixOklab } from './channels.mjs';
import type { ChannelWrite } from './channels.mjs';
import type { Animation } from './animation.mjs';

/**
 * Mark the groups whose style channels this animation writes as holding
 * stored truth the sheet did not derive (round 133: the sheet diff takes
 * the full pass for such a group, as a whole-sheet re-apply always did).
 * Per write, not per element — a flag store per column per tick.
 */
export function markStyleTouched(anim: Animation): void {
  const touched = anim.store.styleTouched;

  for (const w of anim.writes) {
    if (w.kind !== 'position' && w.refs.length > 0) {
      touched[w.refs[0].group] = true;
    }
  }
}

/** Write every captured channel at the eased progress `t` (and the viewport, when the animation pans or zooms). */
export function apply(anim: Animation, e: number): void {
  const store = anim.store;

  markStyleTouched(anim);

  for (const w of anim.writes) {
    const off = w.off;

    // the layout tween's one write (round 144) runs this loop over every
    // node of the scope each CPU tick, so position keeps a tight loop
    if (w.kind === 'position') {
      const d = w.data;

      for (let i = 0; i < w.refs.length; i++) {
        if ((off != null && off[i] !== 0) || !store.isCurrent(w.refs[i])) {
          continue;
        }

        const j = i * 4;

        store.setPosition(
          w.slots[i],
          d[j] + (d[j + 2] - d[j]) * e,
          d[j + 1] + (d[j + 3] - d[j + 1]) * e,
        );
      }

      continue;
    }

    for (let i = 0; i < w.refs.length; i++) {
      // a detached entry (round 144) holds where it was left
      if (off != null && off[i] !== 0) {
        continue;
      }

      writeEntry(anim, w, i, e);
    }
  }

  if (anim.viewport != null) {
    if (anim.pan != null && anim.fromPan != null) {
      anim.viewport.setPan({
        x: lerp(anim.fromPan.x, anim.pan.x, e),
        y: lerp(anim.fromPan.y, anim.pan.y, e),
      });
    }

    if (anim.zoom != null && anim.fromZoom != null) {
      anim.viewport.setZoom(lerp(anim.fromZoom, anim.zoom, e));
    }
  }
}

/**
 * Write one entry of one captured channel at the eased progress `e` —
 * the body of `apply`, and how a detached entry (round 144) is frozen
 * at the value it reached.
 */
export function writeEntry(
  anim: Animation,
  w: ChannelWrite,
  i: number,
  e: number,
): void {
  const store = anim.store;
  const slot = w.slots[i];

  if (!store.isCurrent(w.refs[i])) {
    return;
  }

  switch (w.kind) {
    case 'position':
      store.setPosition(
        slot,
        lerp(w.data[i * 4], w.data[i * 4 + 2], e),
        lerp(w.data[i * 4 + 1], w.data[i * 4 + 3], e),
      );
      break;
    case 'scalar':
      store.setScalar(
        w.column as ColumnId,
        slot,
        clampTo(lerp(w.data[i * 2], w.data[i * 2 + 1], e), w.min, w.max),
      );
      break;
    case 'color': {
      const [r, g, b, a] = mixOklab(w.data, i * 8, e);

      store.setColor(w.column as ColumnId, slot, r, g, b, a);
      break;
    }
    case 'lane':
      // a mid-tween leaf→parent flip hands the slot to auto-bounds
      // rather than fighting the derivation (round 25.1)
      if (
        w.column === COL.NODE_SIZE &&
        (store.flags(GROUP_NODES, slot) & FLAG_PARENT) !== 0
      ) {
        break;
      }

      store.setLane(
        w.column as ColumnId,
        slot,
        w.lane as number,
        clampTo(lerp(w.data[i * 2], w.data[i * 2 + 1], e), w.min, w.max),
      );
      break;
    case 'padding':
      // parents only — a mid-tween parent→leaf flip drops the slot
      if ((store.flags(GROUP_NODES, slot) & FLAG_PARENT) === 0) {
        break;
      }

      store.updateCompoundStyle(slot, {
        padding: clampTo(
          lerp(w.data[i * 2], w.data[i * 2 + 1], e),
          w.min,
          w.max,
        ),
      });
      break;
    case 'fontSize':
      store.setLabelFontSize(
        slot,
        w.column === TWEEN_COL.NODE_FONT_SIZE ? GROUP_NODES : GROUP_EDGES,
        clampTo(lerp(w.data[i * 2], w.data[i * 2 + 1], e), w.min, w.max),
      );
      break;
  }
}

/** Complete the animation: the final write at `t = 1`, the completion callback, the promise resolvers. */
export function finish(anim: Animation): void {
  anim._done = true;
  anim.onComplete?.();

  for (const resolve of anim.resolvers) {
    resolve();
  }

  anim.resolvers.length = 0;
}

/** Swap every write's from/to halves (and the viewport targets). */
export function swapEnds(anim: Animation): void {
  for (const w of anim.writes) {
    const stride = STRIDE[w.kind];
    const half = stride / 2;
    const data = w.data;

    for (let i = 0; i < w.refs.length; i++) {
      const base = i * stride;

      for (let j = 0; j < half; j++) {
        const a = data[base + j];

        data[base + j] = data[base + half + j];
        data[base + half + j] = a;
      }
    }
  }

  if (anim.pan != null && anim.fromPan != null) {
    const p = anim.pan;

    anim.pan = anim.fromPan;
    anim.fromPan = p;
  }

  if (anim.zoom != null && anim.fromZoom != null) {
    const z = anim.zoom;

    anim.zoom = anim.fromZoom;
    anim.fromZoom = z;
  }
}
