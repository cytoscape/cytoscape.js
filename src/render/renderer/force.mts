// The renderer's force-run driver and the LOD promotions (round 130
// split).

import { GpuForceRuntime } from '../gpu-force.mjs';
import type { ForceInputs } from '../gpu-force.mjs';
import { GROUP_NODES, COL } from '../../contract.mjs';
import type { Renderer } from '../renderer.mjs';

/**
 * Start the GPU force integrator (18.3): returns null when the device
 * isn't ready (the layout falls back to the CPU executor).  The frame
 * loop encodes the sim ahead of the cull pass either way; `present`
 * decides what the run publishes into (87.2).  Presenting —
 * `animate: true` — publishes into the mirror's position column, so
 * node.position is GPU-owned for the run (the tween lease machinery)
 * and the graph moves on screen.  A silent run publishes into a
 * runtime-owned scratch buffer instead: the mirror column is never
 * touched, no ownership is taken, and the screen holds the pre-run
 * frame until the settle readback lands the final positions through
 * the normal dirty-span upload.
 */
export function startForce(
  rd: Renderer,
  inputs: ForceInputs,
  stepsPerFrame: number,
  present: boolean = true,
): GpuForceRuntime | null {
  if (
    rd.destroyed ||
    !rd.isReady ||
    rd.device == null ||
    rd.forceRuntime != null
  ) {
    return null;
  }

  rd.forceRuntime = new GpuForceRuntime(rd.device, inputs);
  rd.forceStepsPerFrame = stepsPerFrame;
  rd.forceBatch = stepsPerFrame;
  rd.forceFrameSkipped = false;
  rd.forcePriceMs = 0;
  rd.forcePriceBatch = 0;
  rd.forceDoneAt = 0;
  rd.forcePresents = present;
  rd.needsRedraw = true;
  rd.schedule();

  return rd.forceRuntime;
}

/** Debounced zoom-promotion check: the svg re-raster meter (15.6)
 * and the label atlas tier meter (round 94) share one settle timer —
 * both run shortly after the viewport settles, never per wheel tick. */
export function schedulePromotionCheck(rd: Renderer): void {
  if (rd.store.imageCount() === 0 && !(rd.labelLayer?.canPromote() ?? false)) {
    return;
  }

  if (rd.imagePromoteTimer != null) {
    clearTimeout(rd.imagePromoteTimer);
  }

  rd.imagePromoteTimer = setTimeout(() => {
    rd.imagePromoteTimer = null;

    if (!rd.destroyed && rd.isReady) {
      promoteVectors(rd);
      promoteLabelTier(rd);
    }
  }, 250);
}

/** The label half of the settle meter (round 94): displayed device px
 * are zoom × dpr — deliberately render-scale-free, like the label LOD
 * thresholds, since readability is judged at native resolution.  The
 * label layer owns the threshold and the one-way tier policy. */
export function promoteLabelTier(rd: Renderer): void {
  const zoomDpr = rd.host.viewport.zoom() * rd.dpr;

  if (rd.labelLayer?.maybePromote(zoomDpr) ?? false) {
    rd.needsRedraw = true;
    rd.schedule();
  }
}

/**
 * The demand meter (15.6): per unique *vector* rgba entry, the max
 * on-screen device-px demand among its visible user nodes; entries
 * whose demand exceeds their raster by 1.5x re-raster at the covering
 * tier (registry.promote snaps and clamps; raster sources never
 * promote).  Runs on viewport settles, fresh uploads, and — with the
 * export scale and no viewport test — before image exports.
 */
export function promoteVectors(
  rd: Renderer,
  zoomDprOverride?: number,
  checkViewport: boolean = true,
): void {
  const store = rd.store;

  if (store.imageCount() === 0) {
    return;
  }

  const registry = store.images;
  const zoomDpr = zoomDprOverride ?? (rd.frameData[4] || 1);
  const refs = store.column(COL.NODE_IMAGE_REF) as Uint32Array;
  const sizes = store.column(COL.NODE_SIZE) as Float32Array;
  const positions = store.column(COL.NODE_POSITION) as Float32Array;
  const flags = store.column(COL.NODE_FLAGS) as Uint32Array;
  const high = store.highWater(GROUP_NODES);
  const panX = rd.frameData[2],
    panY = rd.frameData[3];
  const vw = rd.frameData[0],
    vh = rd.frameData[1];
  const demand = new Map<number, number>();

  for (let slot = 0; slot < high; slot++) {
    if (refs[slot] === 0) {
      continue;
    }
    if ((flags[slot] & 3) !== 3) {
      continue;
    } // SHOWN = ALIVE | VISIBLE

    const sizePx = Math.max(sizes[slot * 2], sizes[slot * 2 + 1]) * zoomDpr;

    if (checkViewport) {
      const x = positions[slot * 2] * zoomDpr + panX;
      const y = positions[slot * 2 + 1] * zoomDpr + panY;

      if (x < -sizePx || x > vw + sizePx || y < -sizePx || y > vh + sizePx) {
        continue;
      }
    }

    const recs = store.nodeImagesAt(slot);

    if (recs == null) {
      continue;
    }

    for (const rec of recs) {
      if (rec.sdf) {
        continue;
      } // icons re-threshold; no promotion

      const entry = registry.get(rec.entryId);

      if (entry == null || !entry.vector) {
        continue;
      }

      const prev = demand.get(rec.entryId);

      if (prev == null || sizePx > prev) {
        demand.set(rec.entryId, sizePx);
      }
    }
  }

  for (const [id, px] of demand) {
    const entry = registry.get(id);

    // 1.5x hysteresis: wheel jitter never thrashes re-rasters
    if (entry != null && px > entry.rasterPx * 1.5) {
      registry.promote(id, px);
    }
  }
}
