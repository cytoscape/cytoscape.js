// GraphStore's label sidecar (round 130 split).

import { GROUP_EDGES, GROUP_NODES } from '../../contract.mjs';
import type { LabelStream, GroupName, LabelEntry } from '../../contract.mjs';
import { estimateBlock, WRAP_NONE } from '../../label-wrap.mjs';
import { measureBlock } from '../../label-measure.mjs';
import type { GraphStore } from '../graph-store.mjs';

/**
 * Set the global label font — family, style and weight (round 13
 * D1); one font per glyph atlas.  Every labelled element, in all four
 * streams, re-lays-out against the new font's metrics via the
 * label-dirty channel; the renderer's atlas resets when it observes
 * the change.
 */
export function setLabelFont(
  gs: GraphStore,
  font: string,
  style: string = 'normal',
  weight: string = 'normal',
): void {
  if (
    font === gs.labelFont &&
    style === gs.labelFontStyle &&
    weight === gs.labelFontWeight
  ) {
    return;
  }

  gs.labelFont = font;
  gs.labelFontStyle = style;
  gs.labelFontWeight = weight;
  gs.markAllLabelsDirty();
}

/** Queue every labelled slot (both groups) for a glyph-run rebuild. */
export function markAllLabelsDirty(gs: GraphStore): void {
  for (const group of [
    GROUP_NODES,
    GROUP_EDGES,
    'edgeSource',
    'edgeTarget',
  ] as LabelStream[]) {
    const labels = gs.labels[group];
    const dirty = gs.labelDirty[group];

    for (let slot = 0; slot < labels.length; slot++) {
      if (labels[slot] != null) {
        dirty.add(slot);
      }
    }
  }

  gs.dirty.touch();
}

/** Set or clear (null) an element's label; no-ops when nothing changed. */
export function setLabel(
  gs: GraphStore,
  slot: number,
  entry: LabelEntry | null,
  group: LabelStream = GROUP_NODES,
): void {
  const labels = gs.labels[group];
  const prev = labels[slot];

  if (entry == null) {
    if (prev == null) {
      return;
    }

    labels[slot] = undefined;
  } else {
    if (
      prev != null &&
      prev.text === entry.text &&
      prev.fontSize === entry.fontSize &&
      prev.color === entry.color &&
      prev.anchorY === entry.anchorY &&
      prev.marginX === entry.marginX &&
      prev.marginY === entry.marginY &&
      prev.outlineWidth === entry.outlineWidth &&
      prev.outlineColor === entry.outlineColor &&
      prev.bgColor === entry.bgColor &&
      prev.bgPadding === entry.bgPadding &&
      prev.bgShape === entry.bgShape &&
      prev.bgBorderColor === entry.bgBorderColor &&
      prev.bgBorderWidth === entry.bgBorderWidth &&
      prev.minZoomedFontSize === entry.minZoomedFontSize &&
      prev.anchorX === entry.anchorX &&
      prev.halignShift === entry.halignShift &&
      prev.valignShift === entry.valignShift &&
      prev.endOffset === entry.endOffset &&
      prev.rotate === entry.rotate &&
      prev.wrap === entry.wrap &&
      prev.maxWidth === entry.maxWidth &&
      prev.lineHeight === entry.lineHeight &&
      prev.overflowWrap === entry.overflowWrap &&
      prev.justification === entry.justification
    ) {
      return;
    }

    labels[slot] = entry;
  }

  // label dims (16.2): estimate immediately — the headless bb term —
  // and let the renderer's glyph build upgrade to exact laid dims.
  if (entry == null) {
    gs.labelDims[group].delete(slot);
  } else {
    const prevDims = prev != null ? gs.labelDims[group].get(slot) : undefined;

    // 25.5: a pure font-size delta with unchanged breaking is
    // scale-linear — under wrap 'none' (the default, where maxWidth
    // is ignored) the laid block scales with the em, so patch the
    // dims by the ratio (exactness preserved) instead of re-running
    // the estimator.  The font-size tween's per-tick path.
    if (
      prevDims != null &&
      prev != null &&
      prev.fontSize > 0 &&
      entry.wrap === WRAP_NONE &&
      prev.wrap === WRAP_NONE &&
      entry.text === prev.text &&
      entry.lineHeight === prev.lineHeight &&
      entry.overflowWrap === prev.overflowWrap &&
      entry.justification === prev.justification
    ) {
      const ratio = entry.fontSize / prev.fontSize;

      gs.labelDims[group].set(slot, {
        w: prevDims.w * ratio,
        h: prevDims.h * ratio,
        exact: prevDims.exact,
      });
    } else {
      const wrapOpts = {
        wrap: entry.wrap,
        maxWidth: entry.maxWidth,
        overflowWrap: entry.overflowWrap,
        justification: entry.justification,
        lineHeight: entry.lineHeight,
      };
      // 125.1: measured where a canvas exists — the laid block's own
      // numbers, so a layout that runs before the first frame reads
      // the boxes the frame will draw; the flat estimate otherwise
      const measured = measureBlock(entry.text, entry.fontSize, wrapOpts, {
        family: gs.labelFont,
        style: gs.labelFontStyle,
        weight: gs.labelFontWeight,
      });
      const est =
        measured ?? estimateBlock(entry.text, entry.fontSize, wrapOpts);

      gs.labelDims[group].set(slot, {
        w: est.width,
        h: est.height,
        exact: measured != null,
      });
    }
  }

  // 25.5: no geoEpoch bump — its only consumer is the per-edge exact
  // curve-bb memo, which has no label terms; the label bb terms read
  // the dims maps live
  gs.labelDirty[group].add(slot);
  gs.dirty.touch();
}

/**
 * The font-size tween's per-tick write (round 25.5): patch the
 * sidecar entry's fontSize without an engine round trip (the
 * reanchorLabel pattern).  The edge streams' anchorY is
 * fontSize-derived (-fs/2 + marginY) and re-derives with it; node
 * anchors are size-derived, not font-derived.  One edge font-size
 * drives all three of its streams (mid + end labels).
 */
export function setLabelFontSize(
  gs: GraphStore,
  slot: number,
  group: GroupName,
  fontSize: number,
): void {
  const streams: LabelStream[] =
    group === GROUP_NODES
      ? [GROUP_NODES]
      : [GROUP_EDGES, 'edgeSource', 'edgeTarget'];

  for (const stream of streams) {
    const entry = gs.labels[stream][slot];

    if (entry == null || entry.fontSize === fontSize) {
      continue;
    }

    const anchorY =
      stream === GROUP_NODES ? entry.anchorY : -fontSize / 2 + entry.marginY;

    gs.setLabel(slot, { ...entry, fontSize, anchorY }, stream);
  }
}

/**
 * The renderer's exact-dims feedback (16.2): the glyph build lays the
 * block with real atlas advances and reports the true extent.  Never
 * marks label-dirty (no rebuild loop) — only the bb consumers wake.
 */
export function setLabelDims(
  gs: GraphStore,
  slot: number,
  group: LabelStream,
  w: number,
  h: number,
): void {
  const prev = gs.labelDims[group].get(slot);

  if (prev != null && prev.exact && prev.w === w && prev.h === h) {
    return;
  }

  gs.labelDims[group].set(slot, { w, h, exact: true });
  gs.dirty.touch(); // no geoEpoch bump (25.5) — see setLabel
}

/**
 * Drain one stream's queue of slots needing a glyph-run rebuild.
 * Destructive (the set is cleared), so exactly one consumer — the
 * renderer's label layer — may call it per stream.
 *
 * @returns the queued slots; an empty array when nothing is pending
 */
export function takeLabelDirty(
  gs: GraphStore,
  group: LabelStream = GROUP_NODES,
): number[] {
  const dirty = gs.labelDirty[group];

  if (dirty.size === 0) {
    return [];
  }

  const slots = [...dirty];

  dirty.clear();

  return slots;
}
