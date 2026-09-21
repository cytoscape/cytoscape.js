// The renderer's image-export view resolution (round 130 split): the
// scale rule and `resolveExportView`, shared with the worker renderer.

import { color2tuple } from '../../util/colors.mjs';
import type { ExportOptions } from '../../public-types.mjs';
import type { ExportView } from '../renderer.mjs';

/** v3 semantics: maxWidth/maxHeight override scale; else scale (default 1). */
const exportScale = (w: number, h: number, opts: ExportOptions): number => {
  const { maxWidth, maxHeight } = opts;
  let scale = opts.scale ?? 1;

  if (maxWidth != null || maxHeight != null) {
    const scaleW = maxWidth != null ? maxWidth / w : Infinity;
    const scaleH = maxHeight != null ? maxHeight / h : Infinity;

    scale = Math.min(scaleW, scaleH);
  }

  if (typeof scale !== 'number' || !isFinite(scale) || scale <= 0) {
    throw new Error(`Invalid image export scale ${String(scale)}`);
  }

  return scale;
};

/**
 * Resolve export options into an {@link ExportView} — output px
 * dimensions plus the Frame transform — against the container's CSS
 * size, the model bounds and the viewport.  Pure of the renderer so
 * the worker proxy (round 86.3) resolves views on the main thread,
 * where all three inputs live, and ships the result across.
 *
 * @param opts — the public export options
 * @param containerW — the container's CSS px width
 * @param containerH — the container's CSS px height
 * @param boundingBox — the model bounds provider (full-graph exports)
 * @param viewport — the current pan/zoom (viewport exports)
 * @returns the resolved view
 * @throws for an invalid bg colour, an empty full-graph export, or a
 *   zero-sized container
 */
export const resolveExportView = (
  opts: ExportOptions,
  containerW: number,
  containerH: number,
  boundingBox: () => {
    x1: number;
    y1: number;
    w: number;
    h: number;
  } | null,
  viewport: { pan(): { x: number; y: number }; zoom(): number },
): ExportView => {
  let bg: ExportView['bg'] = null;

  if (opts.bg != null) {
    const tuple = color2tuple(opts.bg);

    if (tuple == null) {
      throw new Error(
        `The value '${String(opts.bg)}' is not a valid colour for 'bg'`,
      );
    }

    bg = [tuple[0], tuple[1], tuple[2], tuple[3] ?? 1];
  }

  let w: number, h: number, panX: number, panY: number, zoom: number;

  if (opts.full === true) {
    const bb = boundingBox();

    if (bb == null) {
      throw new Error('Cannot export a full-graph image of an empty graph');
    }

    const scale = exportScale(bb.w, bb.h, opts);

    w = bb.w * scale;
    h = bb.h * scale;
    panX = -bb.x1 * scale;
    panY = -bb.y1 * scale;
    zoom = scale;
  } else {
    if (containerW === 0 || containerH === 0) {
      throw new Error('Cannot export the viewport of a zero-sized container');
    }

    const scale = exportScale(containerW, containerH, opts);
    const pan = viewport.pan();

    w = containerW * scale;
    h = containerH * scale;
    panX = pan.x * scale;
    panY = pan.y * scale;
    zoom = viewport.zoom() * scale;
  }

  const wPx = Math.max(1, Math.round(w));
  const hPx = Math.max(1, Math.round(h));

  return { wPx, hPx, panX, panY, zoom, bg };
};
