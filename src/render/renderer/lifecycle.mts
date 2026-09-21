// The renderer's lifecycle (round 130 split): stats, resize, the DPR
// listener and destroy.

import type { RendererStats } from '../../public-types.mjs';
import { GROUP_EDGES, GROUP_NODES } from '../../contract.mjs';
import type { Renderer } from '../renderer.mjs';

/**
 * Tear the renderer down: unsubscribe every listener and timer, reject
 * any pending image export, destroy every owned GPU object and finally
 * the device itself, and remove the canvas from the DOM.  Idempotent,
 * and safe to call before `ready` resolves — the in-flight init sees
 * the destroyed flag and abandons.
 *
 * The core is not destroyed, but it is left renderer-less: the
 * animation driver is detached and the image decoder is unset, so the
 * store goes headless again.  Everything after this is a no-op; a new
 * renderer must be mounted to draw again (which is how device-loss
 * recovery works).
 */
export function destroy(rd: Renderer): void {
  if (rd.destroyed) {
    return;
  }

  rd.destroyed = true;

  if (rd.settleTimer != null) {
    clearTimeout(rd.settleTimer);
    rd.settleTimer = null;
  }

  rd.resizeObserver?.disconnect();
  rd.offDprChange?.();
  rd.offInvalidate();
  rd.offViewport();

  if (rd.onFontsLoadingDone != null) {
    document.fonts.removeEventListener('loadingdone', rd.onFontsLoadingDone);
    rd.onFontsLoadingDone = null;
  }
  rd.picking?.destroy();
  rd.gpuTimer?.destroy();
  rd.labelLayer?.destroy();
  rd.imageArrays?.destroy();
  rd.imageArrays = null;
  rd.forceRuntime?.destroy();
  rd.forceRuntime = null;
  rd.store.images.setDecoder(null); // headless again on unmount

  if (rd.imagePromoteTimer != null) {
    clearTimeout(rd.imagePromoteTimer);
    rd.imagePromoteTimer = null;
  }
  rd.parentOrderBuf?.destroy();
  rd.parentOrderBuf = null;
  rd.parentOrderRef = null;

  for (const group of [
    ...Object.values(rd.sceneCull ?? {}),
    ...Object.values(rd.pickCull ?? {}),
    ...Object.values(rd.exportCull ?? {}),
  ]) {
    group.destroy();
  }

  for (const job of rd.pendingExports) {
    job.reject(
      new Error('The renderer was destroyed before the image export completed'),
    );
  }

  rd.pendingExports = [];

  rd.upscaler?.destroy();
  rd.sceneTarget?.destroy();
  rd.depthTarget?.destroy();
  rd.host.animations.detachDriver();
  rd.mapperRuntime?.destroy();
  rd.tweenRuntime?.destroy();
  rd.mirror?.destroy();
  rd.uniform?.destroy();
  rd.pickUniform?.destroy();
  rd.exportUniform?.destroy();
  rd.exportPacker = null; // its pipeline dies with the device below
  rd.device?.destroy();

  if (rd.canvas instanceof HTMLCanvasElement) {
    rd.canvas.remove(); // an OffscreenCanvas has no DOM presence
  }
}

/**
 * Watch for device-pixel-ratio changes (91.2): browser zoom or a move
 * to a different-density monitor changes `devicePixelRatio` without
 * changing `clientWidth` (CSS px), so the ResizeObserver never fires —
 * the standing hook is a matchMedia resolution query, re-armed per
 * change because a query only matches the ratio it was built with.
 * Armed only while the ratio is 'auto'; an explicit `pixelRatio`
 * number stays pinned, and a worker mount has no matchMedia (the main
 * thread re-resolves and setSize carries the ratio).  The change
 * handler re-measures through `resize()` (applySize re-reads the live
 * ratio) and emits `resize` on the core — v3's `cy.resize()`
 * semantics for a re-rasterizing viewport.
 */
export function armDprListener(rd: Renderer): void {
  if (
    !rd.autoDpr ||
    rd.container == null ||
    typeof matchMedia === 'undefined'
  ) {
    return;
  }

  const query = matchMedia(`(resolution: ${rd.dpr}dppx)`);
  const onChange = (): void => {
    if (rd.destroyed) {
      return;
    }

    rd.offDprChange?.(); // drop the stale-ratio query
    rd.resize(); // applySize re-reads devicePixelRatio
    rd.host.emitResize();
    rd.armDprListener(); // re-arm at the new ratio
  };

  query.addEventListener('change', onChange);
  rd.offDprChange = () => {
    query.removeEventListener('change', onChange);
    rd.offDprChange = null;
  };
}

/**
 * A snapshot of the frame counters and subsystem meters.  Cheap and
 * side-effect free, so it is safe to poll every frame; the counters
 * are cumulative and never reset, and everything device-dependent
 * reads 0 before `ready` resolves.  `gpuFrameMs` stays 0 on adapters
 * without 'timestamp-query'.
 */
export function stats(rd: Renderer): RendererStats {
  return {
    frames: rd.frameCount,
    cpuFrameMs: rd.cpuFrameMs,
    gpuFrameMs: rd.gpuTimer?.lastMs ?? 0,
    gpuFrameReadings: rd.gpuTimer?.readings ?? 0,
    renderScale: rd.scaleCtl.scale,
    uploadedBytes:
      (rd.mirror?.uploadedBytes ?? 0) + (rd.labelLayer?.uploadedBytes() ?? 0),
    nodes: rd.store.count(GROUP_NODES),
    edges: rd.store.count(GROUP_EDGES),
    glyphs: rd.labelLayer?.count() ?? 0,
    pickLatencyMs: rd.pickLatencyMs(),
    pickDeferrals: rd.picking?.deferrals ?? 0,
    mapperUploadedBytes: rd.mapperRuntime?.uploadedBytes ?? 0,
    mapperDispatches: rd.mapperRuntime?.dispatches ?? 0,
    // the shaping memo (16.5): shared texts shape once per face
    labelShapeHits: rd.labelLayer?.memoHits ?? 0,
    labelShapeMisses: rd.labelLayer?.memoMisses ?? 0,
    glyphAtlasTier: rd.labelLayer?.atlas.tier ?? 1,
  };
}

/**
 * Resize the canvas to the container and redraw — synchronously
 * (91.1).  Wired to a ResizeObserver on the container, so callers only
 * need this when the size changes without one firing (no
 * ResizeObserver, or a device-pixel ratio change).  The scene and
 * depth targets are not reallocated here — the frame notices the new
 * size and rebuilds them.
 *
 * The frame is drawn inside this call rather than scheduled because
 * ResizeObserver callbacks run *after* this rendering update's rAF and
 * *before* its paint: a `schedule()`d redraw lands a frame late, and
 * with any stale presentation the compositor scales old content to the
 * new layout — every step of a live window drag showed the graph
 * stretched.  Drawing here means the frame that composites the new
 * layout composites new content; the stretched frame never exists.
 * Before readiness, or re-entrantly from a 'render' handler, it falls
 * back to the scheduler.
 */
export function resize(rd: Renderer): void {
  if (rd.destroyed) {
    return;
  }

  rd.applySize();
  rd.needsRedraw = true;

  if (rd.isReady && !rd.inFrame) {
    rd.frame();
  } else {
    rd.schedule();
  }
}
