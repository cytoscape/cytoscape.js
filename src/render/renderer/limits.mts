// The renderer's side of round 138 (PLAN.md items 35–36): the device
// pre-flight at init, the fit it reports to the model, and the
// degradation order — what the renderer stops drawing when a buffer
// does not fit the device or the device refuses it.

import { GpuUnfitError } from '../../algorithms/gpu-registry.mjs';
import { GROUP_EDGES, GROUP_NODES } from '../../contract.mjs';
import type { GroupName } from '../../contract.mjs';
import {
  bindableBytes,
  dispatchableSlots,
  groupUnfit,
  readLimits,
} from '../../device-fit.mjs';
import type { DeviceFit, DeviceLimits } from '../../device-fit.mjs';
import type { GpuErrorInfo } from '../../public-types.mjs';
import { essentialWidest } from '../column-mirror.mjs';
import { GLYPH_BYTES } from '../glyph-buffer.mjs';
import type { Renderer } from '../renderer.mjs';
import { destroyCounts } from './counts.mjs';

/**
 * The fit the renderer reports to the model: the device's limits and,
 * per group, the widest column it cannot draw without.
 *
 * @param device — the renderer's device
 * @returns the fit
 */
export function deviceFit(device: { limits: DeviceLimits }): DeviceFit {
  return {
    limits: readLimits(device),
    nodes: essentialWidest(GROUP_NODES),
    edges: essentialWidest(GROUP_EDGES),
  };
}

/**
 * The init pre-flight: a graph built (or grown) while headless reaches
 * the device only at mount, so the check `cy.add()` makes runs here
 * against what the store already holds.
 *
 * @param rd — the renderer, its store populated
 * @param fit — the device's fit
 * @throws GpuUnfitError when either group already outgrows the device
 *   (`cy.ready` rejects with it)
 */
export function preflight(rd: Renderer, fit: DeviceFit): void {
  for (const group of [GROUP_NODES, GROUP_EDGES] as GroupName[]) {
    const reason = groupUnfit(
      group,
      rd.store.highWater(group),
      rd.store.capacity(group),
      fit[group],
      fit.limits,
    );

    if (reason != null) {
      throw new GpuUnfitError(
        `mounting: this graph does not fit the device — its ${group} ` +
          `would ${reason}`,
      );
    }
  }
}

/**
 * The most glyph instances one label stream may hold on this device:
 * its bindable size over the 64-byte glyph, and the cull's reach.
 *
 * @param limits — the device's limits
 * @returns glyph slots
 */
export function maxGlyphs(limits: DeviceLimits): number {
  return Math.min(
    Math.floor(bindableBytes(limits) / GLYPH_BYTES),
    dispatchableSlots(limits),
  );
}

/**
 * The feature a buffer belongs to, when the renderer can stop drawing
 * that feature and go on — the degradation order, labels first, then
 * charts and images, then the curve routes and gradients.  A core
 * mirror column has no such feature: the scene holds its last frame
 * (`'frames'`).
 *
 * @param label — the buffer's (or texture's) label
 * @returns the feature, or null for a buffer nothing degrades around
 */
export function featureOf(label: string): string | null {
  if (label === 'cy-gpu:glyphs' || label === 'cy-gpu:glyph-atlas') {
    return 'labels';
  }

  if (label === 'cy-gpu:chart-blob') {
    return 'charts';
  }

  if (label === 'cy-gpu:image-blob' || label.startsWith('cy-gpu:image-')) {
    return 'images';
  }

  if (label === 'cy-gpu:curve-blob') {
    return 'curves';
  }

  if (/^cy-gpu:(node|edge)\.gradient$/.test(label)) {
    return 'gradients';
  }

  if (/^cy-gpu:(node|edge)\./.test(label)) {
    return 'frames';
  }

  return null;
}

/**
 * Stop drawing a feature, once, and say so: a `gpuerror` carrying
 * `degraded`.  A later failure in a feature already degraded is not
 * re-announced.
 *
 * @param rd — the renderer
 * @param feature — what stops drawing
 * @param info — the failure that caused it
 */
export function degrade(
  rd: Renderer,
  feature: string,
  info: GpuErrorInfo,
): void {
  if (rd.degraded.has(feature)) {
    return;
  }

  rd.degraded.add(feature);

  if (feature === 'labels') {
    rd.labelLayer?.disable();
  }

  if (feature === 'frames') {
    // nothing will draw: a pick or a count waiting on a frame answers
    // null now rather than never
    rd.picking?.destroy();
    rd.picking = null;
    destroyCounts(rd);
  }

  rd.needsRedraw = true;
  rd.schedule();
  rd.host.emitGpuError({ ...info, degraded: feature });
}

/**
 * The ledger's report of a refused allocation or an uncaptured error.
 * An allocation in a degradable feature degrades it — its buffer is
 * swapped for a valid placeholder where one is bound, so the frame
 * stays valid — and anything else is passed on as it came.
 *
 * @param rd — the renderer
 * @param info — the ledger's report
 */
export function onGpuError(rd: Renderer, info: GpuErrorInfo): void {
  if (rd.destroyed) {
    return;
  }

  const feature = info.label != null ? featureOf(info.label) : null;

  if (feature == null) {
    rd.host.emitGpuError(info);

    return;
  }

  rd.mirror?.dropFailed(info.label as string);
  degrade(rd, feature, info);
}

/**
 * The mirror declined a blob or a gradient column as larger than the
 * device can bind: degrade its feature.
 *
 * @param rd — the renderer
 * @param label — the declined buffer's label
 * @param bytes — what it would have needed
 */
export function onMirrorUnfit(
  rd: Renderer,
  label: string,
  bytes: number,
): void {
  const limit = rd.device == null ? 0 : bindableBytes(readLimits(rd.device));

  degrade(rd, featureOf(label) ?? 'frames', {
    kind: 'unfit',
    label,
    bytes,
    message:
      `${label}: a ${bytes}-byte buffer would exceed this device's ` +
      `${limit}-byte binding limit`,
  });
}

/**
 * After the label pass: a glyph stream that outgrew the device stops
 * the label draw (the degradation order's first step) rather than
 * invalidating the frame.
 *
 * @param rd — the renderer
 */
export function checkLabelFit(rd: Renderer): void {
  const over = rd.labelLayer?.unfitBytes() ?? 0;

  if (over > 0 && !rd.degraded.has('labels')) {
    const max = rd.device == null ? 0 : maxGlyphs(readLimits(rd.device));

    degrade(rd, 'labels', {
      kind: 'unfit',
      label: 'cy-gpu:glyphs',
      bytes: over,
      message:
        `cy-gpu:glyphs: a ${over}-byte glyph buffer (${over / GLYPH_BYTES} ` +
        `glyphs) is past the ${max} one label stream can bind and cull ` +
        `on this device`,
    });
  }
}
