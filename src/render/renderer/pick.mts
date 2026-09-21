// The renderer's picking (round 130 split): the GPU pick passes and the
// CPU tiers.

import { pickNodeTierAt, type NodePickTier } from '../cpu-pick.mjs';
import { PICK_TILE } from '../picking.mjs';
import { GROUP_EDGES } from '../../contract.mjs';
import {
  DEFAULT_EDGE_WIDTH_FLOOR,
  DEFAULT_NODE_LOD_PX,
  DEFAULT_HIDE_PX,
  DEFAULT_LABEL_FADE_PX,
  DEFAULT_IMAGE_MIN_PX,
  DEFAULT_LABEL_MIN_PX,
} from '../renderer.mjs';
import type { Renderer } from '../renderer.mjs';
import { curvedEdgesImpl, curvedArrowsImpl } from './pipelines.mjs';

/**
 * Pick at a rendered (CSS px) position.  Resolves with the packed pick
 * id of the element under the point — a node's `slot + 1`, or an edge's
 * `slot + 1` with {@link EDGE_PICK_BIT} set — or null for
 * background/unknown.  Decoding an id to an element (and re-validating
 * it against the live model, since a GPU pick can be up to two frames
 * stale) is the core's job (`Core._decodePick`, round 86.2): the
 * renderer speaks slots and ids only, so a worker host can answer
 * picks over a message channel.  Three stages, cheapest first:
 *
 * 1. nodes: synchronous CPU pick — exact, zero GPU work, answers in the
 *    same microtask;
 * 2. the cached pick tile: while the cursor stays inside the last GPU
 *    tile and nothing invalidated it, edge/background answers are
 *    instant;
 * 3. GPU edge pick: draws only the cursor tile, submits ahead of scene
 *    work, so latency is ~one rAF plus bounded in-flight GPU work
 *    (latest-wins coalescing; requests never queue up — a saturated
 *    staging ring defers the coalesced request a frame, never drops it).
 *
 * **The tiers resolve leaf > edge > parent** (round 97.1), which is the
 * reverse of what v4 draws — every compound parent draws in one
 * *pre-edge* stream (`cull.mts`, `HierarchyIndex.parentOrder()`), then
 * edges, then leaves — so what you see is what you pick, the pick
 * pass's own contract.  A leaf hit therefore answers from stage 1 and
 * skips the GPU entirely; a *parent* hit is held while stages 2–3
 * answer and is returned only over background.  The cost lands where
 * the defect was: a click or hover inside a parent body now awaits the
 * edge tile once, where it used to answer synchronously.
 *
 * v3 resolves the same three by its own draw order, which interleaves
 * parents and edges by compound depth (`zsort.mts`, driven by `z-index`
 * / `z-compound-depth` — both dropped in v4, 2026-08-01), so a deeply
 * nested v3 parent can beat a shallower edge.  v4's flat tier is the
 * deviation that follows, recorded in `src/README.md`.
 */
export async function pick(
  rd: Renderer,
  x: number,
  y: number,
  pads?: { edgePadPx?: number; nodePadPx?: number },
): Promise<number | null> {
  if (rd.destroyed || !rd.isReady || rd.picking == null) {
    return null;
  }

  const xPx = x * rd.dpr;
  const yPx = y * rd.dpr;
  // hit halos in CSS px (57.9): the gesture layer passes v3's
  // findNearestElement thresholds; the default is exact, which is what
  // the public `cy.pick` promises
  const edgePadPx = (pads?.edgePadPx ?? 0) * rd.dpr;
  const nodePadPx = (pads?.nodePadPx ?? 0) * rd.dpr;

  const nodeHit = cpuPickNodeTier(rd, xPx, yPx, nodePadPx);

  if (nodeHit != null && !nodeHit.isParent) {
    // the node id namespace: slot + 1, high bit clear.  A leaf draws
    // over every edge, so nothing below it can win — no GPU work.
    return nodeHit.slot + 1;
  }

  // 97.1: a parent body draws *under* the edges crossing it, so its hit
  // is held while the edge tier answers, and spends only over background
  const parentSlot = nodeHit?.slot ?? null;
  const overParent = (): number | null =>
    parentSlot == null ? null : parentSlot + 1;

  const cached = rd.picking.cachedIdAt(xPx, yPx, edgePadPx);

  if (cached != null) {
    return cached === 0 ? overParent() : cached;
  }

  const epoch = rd.store.compactEpoch;
  const promise = rd.picking.request(xPx, yPx, edgePadPx);

  rd.schedule(); // the pick pass runs with the next frame

  const id = await promise;

  if (id != null && id !== 0) {
    return id;
  }

  if (parentSlot == null || rd.destroyed || !rd.isReady) {
    return null;
  }

  // slots move under compaction (19.4), so a held slot only survives an
  // await while the epoch does; otherwise the scan re-runs against the
  // current columns, which is cheap next to the roundtrip just paid
  if (rd.store.compactEpoch !== epoch) {
    return cpuPickNodeTier(rd, xPx, yPx, nodePadPx)?.slot ?? null;
  }

  return overParent();
}

/** The synchronous CPU node pick at a point, through the tiers `pickNodeSync` exposes. */
export function cpuPickNode(
  rd: Renderer,
  xPx: number,
  yPx: number,
  padPx: number = 0,
): number | null {
  return cpuPickNodeTier(rd, xPx, yPx, padPx)?.slot ?? null;
}

/** the same scan, carrying the draw tier the hit came from (97.1) */
export function cpuPickNodeTier(
  rd: Renderer,
  xPx: number,
  yPx: number,
  padPx: number = 0,
): NodePickTier | null {
  const viewport = rd.host.viewport;
  const pan = viewport.pan();
  const opts = rd.opts;

  rd.store.flushDerived(); // parent geometry is derived (round 14.9)

  // same view state as writePickUniform: native device px, no renderScale
  return pickNodeTierAt(
    rd.store,
    {
      panXPx: pan.x * rd.dpr,
      panYPx: pan.y * rd.dpr,
      zoomDpr: viewport.zoom() * rd.dpr,
      hidePx: opts.hidePx ?? DEFAULT_HIDE_PX,
      nodeLodPx: opts.nodeLodPx ?? DEFAULT_NODE_LOD_PX,
      padPx,
    },
    xPx,
    yPx,
  );
}

/** Encode the pick cull compute pass and the cursor-tile pick pass into their own command buffer, so the readback maps as soon as it executes. */
export function drawPickPasses(
  rd: Renderer,
  encoder: GPUCommandEncoder,
  targetView: GPUTextureView,
): void {
  const device = rd.device;
  const mirror = rd.mirror;
  const uniform = rd.pickUniform;
  const pickCull = rd.pickCull;

  if (device == null || mirror == null || uniform == null || pickCull == null) {
    return;
  }

  const pass = encoder.beginRenderPass({
    label: 'cy-gpu:pick-pass',
    colorAttachments: [
      {
        view: targetView,
        clearValue: { r: 0, g: 0, b: 0, a: 0 }, // 0 = background
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  });

  const store = rd.store;

  // edges and their arrowheads; node picks are answered synchronously
  // on the CPU.  Arrows (57.10) write the same id as their edge's
  // line, so the draw order within the tile cannot matter — what they
  // add is coverage: the head's area (hollow included), which since
  // round 56's trim is exactly where the line no longer reaches.
  rd.edgePipeline?.draw(
    pass,
    device,
    uniform,
    mirror,
    store.highWater(GROUP_EDGES),
    pickCull.edge,
    true,
  );
  rd.arrowPipeline?.draw(
    pass,
    device,
    uniform,
    mirror,
    store.highWater(GROUP_EDGES),
    pickCull.edge,
    rd.host.arrowEnds(),
    true,
  );

  if (store.hasCurvedEdges()) {
    curvedEdgesImpl(rd)?.draw(
      pass,
      device,
      uniform,
      mirror,
      store.highWater(GROUP_EDGES),
      pickCull.curved,
      true,
    );
    curvedArrowsImpl(rd)?.draw(
      pass,
      device,
      uniform,
      mirror,
      store.highWater(GROUP_EDGES),
      pickCull.curved,
      rd.host.arrowEnds(),
      true,
    );
  }

  if (store.midArrowCount() > 0) {
    rd.arrowPipeline?.drawMid(
      pass,
      device,
      uniform,
      mirror,
      store.highWater(GROUP_EDGES),
      pickCull.edge,
      rd.host.midArrowEnds(),
      true,
    );

    if (store.hasCurvedEdges()) {
      curvedArrowsImpl(rd)?.drawMid(
        pass,
        device,
        uniform,
        mirror,
        store.highWater(GROUP_EDGES),
        pickCull.curved,
        rd.host.midArrowEnds(),
        true,
      );
    }
  }
  pass.end();
}

/**
 * The pick pass reuses the render shaders with a Frame whose viewport is
 * the cursor-centered tile: pan is offset by the tile origin, so the
 * shaders' own conservative viewport culling collapses every instance
 * that doesn't overlap the cursor region — the pick pass costs
 * O(region), not O(scene).  LOD values match the render frame so what
 * you see is what you pick.
 */
export function writePickUniform(
  rd: Renderer,
  xPx: number,
  yPx: number,
  padPx: number,
): void {
  const viewport = rd.host.viewport;
  const zoom = viewport.zoom();
  const pan = viewport.pan();
  const f = rd.pickFrameData;
  const opts = rd.opts;

  // floor keeps the cursor inside the center texel [TILE/2, TILE/2 + 1)
  const tileX = Math.floor(xPx) - PICK_TILE / 2;
  const tileY = Math.floor(yPx) - PICK_TILE / 2;

  f[0] = PICK_TILE;
  f[1] = PICK_TILE;
  f[2] = pan.x * rd.dpr - tileX;
  f[3] = pan.y * rd.dpr - tileY;
  f[4] = zoom * rd.dpr;
  f[5] = opts.edgeWidthFloor ?? DEFAULT_EDGE_WIDTH_FLOOR;
  f[6] = opts.nodeLodPx ?? DEFAULT_NODE_LOD_PX;
  f[7] = opts.hidePx ?? DEFAULT_HIDE_PX;
  f[8] = 0; // edge dimming never affects pick coverage
  f[9] = opts.labelFadePx ?? DEFAULT_LABEL_FADE_PX; // labels aren't picked
  f[10] = opts.labelMinPx ?? DEFAULT_LABEL_MIN_PX;
  f[11] = rd.store.curveSlack();
  f[12] = rd.store.haystackSlack();
  f[13] = rd.store.outlineSlack();
  f[14] = rd.store.arrowScaleMax();
  f[17] = rd.store.arrowWidthMax(); // 56: hollow strokes reach outside the head
  f[15] = (opts.imageMinPx ?? DEFAULT_IMAGE_MIN_PX) * rd.scaleCtl.scale; // displayed px, like labelMinPx
  f[16] = 1; // pickMode (20.2): the edge cull kernels drop events:'no' edges here only
  // 57.9: v3's edgeThreshold — the edge pick quads, their fragment
  // test and the cull margins all grow by rd halo (device px)
  f[18] = padPx;

  (rd.device as GPUDevice).queue.writeBuffer(
    rd.pickUniform as GPUBuffer,
    0,
    f.buffer,
    f.byteOffset,
    f.byteLength,
  );
}
