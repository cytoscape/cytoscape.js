// The renderer's emphasis tiers (round 102): while an emphasis is set,
// the frame culls the scene twice and draws it in two passes — the
// dimmed tier, then the veil, then the emphasized tier above it.

import { CulledGroup } from '../cull.mjs';
import type { CullKernels } from '../cull.mjs';
import { CURVE_SEGS } from '../../curve-geometry.mjs';
import { EmphasisVeil } from '../emphasis-veil.mjs';
import { BUFFER_USAGE } from '../../gpu/webgpu-constants.mjs';
import type { Renderer, SceneCullGroups } from '../renderer.mjs';
import { drawScene } from './scene.mjs';

/*
Why two tiers rather than a per-element dim.  Round 102 measured the
alternative: a dim that is a style — a state bit every non-emphasized
element carries, or one derived from "an emphasis is on" — rewrites
every element's record on the frame the emphasis turns on or off, 1.1 s
per hover change on ndex-x-large.  Here the per-element state is only
the emphasized set's own bit; the dim is one veil draw, and its cost is
a second cull over the same columns plus the set's own draws.

The partition is exact: every cull predicate asks `emphasisKeeps` of its
owner's flags, pass 1 admitting only elements without FLAG_EMPHASIZED
and pass 2 only elements with it, so nothing draws twice and nothing is
missed.  The second tier gets a fresh depth attachment, because the
first tier's node prepass would otherwise kill an emphasized edge under
a dimmed node — the emphasized set is raised above the rest, the one
boolean elevated tier src/README.md's z-index record logged as the only
stacking v4 would take.
*/

/** Whether this frame draws in two tiers. */
export function emphasisActive(rd: Renderer): boolean {
  return rd.store.emphasisDim() >= 0;
}

/** An emphasized tier's cull groups, built on its first use. */
function cullGroups(kernels: CullKernels, label: string): SceneCullGroups {
  return {
    node: new CulledGroup(kernels, 'node', `${label}-node`),
    parent: new CulledGroup(kernels, 'parentNode', `${label}-parent`),
    edge: new CulledGroup(kernels, 'edge', `${label}-edge`),
    curved: new CulledGroup(
      kernels,
      'curvedEdge',
      `${label}-curved-edge`,
      6 * CURVE_SEGS,
    ),
    glyph: new CulledGroup(kernels, 'glyph', `${label}-glyph`),
    edgeGlyph: new CulledGroup(kernels, 'edgeGlyph', `${label}-edge-glyph`),
    sourceGlyph: new CulledGroup(kernels, 'edgeGlyph', `${label}-source-glyph`),
    targetGlyph: new CulledGroup(kernels, 'edgeGlyph', `${label}-target-glyph`),
    ghost: new CulledGroup(kernels, 'ghost', `${label}-ghost`),
    overlay: new CulledGroup(kernels, 'nodeLayer', `${label}-overlay`),
    underlay: new CulledGroup(kernels, 'nodeLayer', `${label}-underlay`),
  };
}

/** One emphasized tier's GPU inputs: its Frame uniform and its culls. */
export interface EmphasisTier {
  uniform: GPUBuffer;
  cull: SceneCullGroups;
}

/**
 * Make the emphasized tier ready for a scene frame or an export — its
 * cull groups, its Frame uniform (the tier's base uniform, already
 * written with emphasisPass = 1, copied with 2) and the veil — and
 * return it, or null before the device is.  The screen and exports keep
 * separate groups and uniforms, as their dimmed tiers do.
 *
 * @param base — the dimmed tier's Frame data (`frameData` or `exportFrameData`)
 * @param which — whose tier: the on-screen frame's or an export's
 */
export function prepareEmphasis(
  rd: Renderer,
  base: Float32Array,
  which: 'scene' | 'export',
): EmphasisTier | null {
  const device = rd.device;
  const kernels = rd.cullKernels;
  const format = rd.format;

  if (device == null || kernels == null || format == null) {
    return null;
  }

  rd.emphasisVeil ??= new EmphasisVeil(device, format);

  const tier =
    which === 'scene'
      ? (rd.emphasisTier ??= makeTier(device, kernels, 'emphasis'))
      : (rd.exportEmphasisTier ??= makeTier(
          device,
          kernels,
          'export-emphasis',
        ));
  const f = rd.emphasisFrameData;

  // the scratch is copied at the call, so one serves both uniforms
  f.set(base);
  f[19] = 2;
  device.queue.writeBuffer(
    tier.uniform,
    0,
    f.buffer,
    f.byteOffset,
    f.byteLength,
  );

  return tier;
}

function makeTier(
  device: GPUDevice,
  kernels: CullKernels,
  label: string,
): EmphasisTier {
  return {
    uniform: device.createBuffer({
      label: `cy-gpu:${label}-frame-uniform`,
      size: 80,
      usage: BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST,
    }),
    cull: cullGroups(kernels, label),
  };
}

const TRANSPARENT = [0, 0, 0, 0] as const;

/**
 * The end of the first tier and the whole second one: composite what
 * the first pass drew at the dim opacity (the veil), end it, and draw
 * the emphasized tier in a pass of its own over the same colour target
 * with a cleared depth attachment.
 *
 * @param pass — the first tier's render pass, its scene already drawn
 * @param view — the colour target both tiers write
 * @param depthView — the depth target the tiers share
 * @param tier — what `prepareEmphasis` returned
 * @param under — the premultiplied colour the target was cleared to
 *   (transparent on screen; an export's `bg`)
 * @param timestampWrites — the frame timer's end-of-pass write, moved
 *   here from the first tier's pass so the reading spans both
 */
export function drawEmphasisTier(
  rd: Renderer,
  encoder: GPUCommandEncoder,
  pass: GPURenderPassEncoder,
  view: GPUTextureView,
  depthView: GPUTextureView,
  tier: EmphasisTier,
  under: readonly [number, number, number, number] = TRANSPARENT,
  timestampWrites?: GPURenderPassTimestampWrites,
): void {
  (rd.emphasisVeil as EmphasisVeil).draw(pass, rd.store.emphasisDim(), under);
  pass.end();

  const top = encoder.beginRenderPass({
    label: 'cy-gpu:emphasis-pass',
    colorAttachments: [{ view, loadOp: 'load', storeOp: 'store' }],
    depthStencilAttachment: {
      view: depthView,
      depthClearValue: 1.0,
      depthLoadOp: 'clear',
      depthStoreOp: 'discard',
    },
    ...(timestampWrites != null ? { timestampWrites } : {}),
  });

  drawScene(rd, top, tier.uniform, tier.cull);
  top.end();
}
