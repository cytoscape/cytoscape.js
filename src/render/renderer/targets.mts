// The renderer's sizing, render targets and the frame uniform (round 130
// split).

import { DEPTH_FORMAT } from '../node-pipeline.mjs';
import { TEXTURE_USAGE } from '../webgpu-constants.mjs';
import {
  DEFAULT_EDGE_WIDTH_FLOOR,
  DEFAULT_NODE_LOD_PX,
  DEFAULT_HIDE_PX,
  DEFAULT_LABEL_FADE_PX,
  DEFAULT_IMAGE_MIN_PX,
  DEFAULT_LABEL_MIN_PX,
} from '../renderer.mjs';
import type { Renderer } from '../renderer.mjs';

/**
 * Measure the container and size both halves of the canvas from it:
 * the backing store in device px (clientWidth × dpr) and the CSS box
 * in fixed px (91.1).  Fixed px rather than `100%` is v3's shape:
 * whenever a redraw is late behind a layout change, a wrongly-*sized*
 * canvas letterboxes where a `100%` canvas stretches whatever was last
 * presented — stale coverage reads as lag; stale stretch reads as the
 * graph deforming.  It also covers the no-ResizeObserver path, where
 * nothing re-measures until `cy.resize()`.
 *
 * With `pixelRatio: 'auto'` the device-pixel ratio is re-read per
 * measure (91.2), so a browser-zoom or monitor-density change
 * re-rasterizes rather than blurring at the construction-time ratio; a
 * ratio change drops the cached pick tile (device px).
 */
export function applySize(rd: Renderer): void {
  const container = rd.container;

  if (container == null) {
    return; // worker mount: sizes arrive via setSize()
  }

  if (rd.autoDpr) {
    const live = globalThis.devicePixelRatio || 1;

    if (live !== rd.dpr) {
      rd.dpr = live;
      rd.picking?.invalidateCache(); // cached pick tile is device px
    }
  }

  const cssW = container.clientWidth;
  const cssH = container.clientHeight;
  const w = Math.max(1, Math.round(cssW * rd.dpr));
  const h = Math.max(1, Math.round(cssH * rd.dpr));

  if (rd.canvas.width !== w || rd.canvas.height !== h) {
    rd.canvas.width = w;
    rd.canvas.height = h;
  }

  const style = (rd.canvas as HTMLCanvasElement).style;
  const wPx = `${cssW}px`;
  const hPx = `${cssH}px`;

  if (style.width !== wPx || style.height !== hPx) {
    style.width = wPx;
    style.height = hPx;
  }
}

/**
 * Explicit device-px resize for the worker mount (round 86.3), where
 * the main thread observes the container and messages the new size.
 * The same-thread path keeps its ResizeObserver + applySize.
 *
 * @param wPx — canvas width in device px (floored to 1)
 * @param hPx — canvas height in device px (floored to 1)
 * @param dpr — the main thread's re-resolved device-pixel ratio
 *   (91.2); omitted, the current ratio stands
 */
export function setSize(
  rd: Renderer,
  wPx: number,
  hPx: number,
  dpr?: number,
): void {
  if (rd.destroyed) {
    return;
  }

  if (dpr != null && dpr !== rd.dpr) {
    rd.dpr = dpr;
    rd.picking?.invalidateCache(); // cached pick tile is device px
  }

  const w = Math.max(1, Math.round(wPx));
  const h = Math.max(1, Math.round(hPx));

  if (rd.canvas.width !== w || rd.canvas.height !== h) {
    rd.canvas.width = w;
    rd.canvas.height = h;
  }

  rd.needsRedraw = true;
  rd.schedule();
}

/** The scene colour target at the current scaled size, (re)created when the size changed. */
export function ensureSceneTarget(rd: Renderer): GPUTexture {
  const device = rd.device as GPUDevice;
  const { w, h } = rd.scaledSize();
  let target = rd.sceneTarget;

  if (target == null || target.width !== w || target.height !== h) {
    const old = target;

    target = device.createTexture({
      label: 'cy-gpu:scene-target',
      size: { width: w, height: h },
      format: rd.format as GPUTextureFormat,
      usage: TEXTURE_USAGE.RENDER_ATTACHMENT | TEXTURE_USAGE.TEXTURE_BINDING,
    });
    rd.sceneTarget = target;

    if (old != null) {
      // may still be referenced by in-flight frames
      void device.queue.onSubmittedWorkDone().then(() => old.destroy());
    }
  }

  return target;
}

/** The depth target at the current scaled size, (re)created when the size changed. */
export function ensureDepthTarget(rd: Renderer): GPUTexture {
  const device = rd.device as GPUDevice;
  const { w, h } = rd.scaledSize(); // matches the scene color target
  let target = rd.depthTarget;

  if (target == null || target.width !== w || target.height !== h) {
    const old = target;

    target = device.createTexture({
      label: 'cy-gpu:depth-target',
      size: { width: w, height: h },
      format: DEPTH_FORMAT,
      usage: TEXTURE_USAGE.RENDER_ATTACHMENT,
    });
    rd.depthTarget = target;

    if (old != null) {
      // may still be referenced by in-flight frames
      void device.queue.onSubmittedWorkDone().then(() => old.destroy());
    }
  }

  return target;
}

/** Write the per-frame uniform block: viewport, pan, zoom×DPR, the LOD thresholds and the slack terms, from the host's view and the store's maxima. */
export function writeFrameUniform(rd: Renderer): void {
  const viewport = rd.host.viewport;
  const zoom = viewport.zoom();
  const pan = viewport.pan();
  const f = rd.frameData;
  const opts = rd.opts;

  // with render scale < 1 the scene renders in scaled device px; LOD
  // thresholds stay in render px (a floored 1px edge is 1 low-res px)
  const { w, h } = rd.scaledSize();
  const dprScale = rd.dpr * rd.scaleCtl.scale;

  f[0] = w;
  f[1] = h;
  f[2] = pan.x * dprScale;
  f[3] = pan.y * dprScale;
  f[4] = zoom * dprScale;
  f[5] = opts.edgeWidthFloor ?? DEFAULT_EDGE_WIDTH_FLOOR;
  f[6] = opts.nodeLodPx ?? DEFAULT_NODE_LOD_PX;
  f[7] = opts.hidePx ?? DEFAULT_HIDE_PX;
  f[8] = opts.edgeDimming ? Math.min(0.85, Math.max(0, 1 - zoom) * 0.85) : 0;
  // label thresholds are readability criteria, so they live in *displayed*
  // px regardless of the adaptive render scale: scaling them into render
  // px here makes the shader/cull comparisons (which are in render px)
  // equivalent to native-px ones.  The node/edge raster floors above stay
  // in render px on purpose — sub-render-pixel geometry can't rasterize.
  f[9] = (opts.labelFadePx ?? DEFAULT_LABEL_FADE_PX) * rd.scaleCtl.scale;
  f[10] = (opts.labelMinPx ?? DEFAULT_LABEL_MIN_PX) * rd.scaleCtl.scale;
  f[11] = rd.store.curveSlack(); // model px; shaders scale by zoomDpr
  f[12] = rd.store.haystackSlack();
  f[13] = rd.store.outlineSlack();
  f[14] = rd.store.arrowScaleMax();
  f[17] = rd.store.arrowWidthMax(); // 56: hollow strokes reach outside the head
  f[15] = (opts.imageMinPx ?? DEFAULT_IMAGE_MIN_PX) * rd.scaleCtl.scale; // displayed px, like labelMinPx

  (rd.device as GPUDevice).queue.writeBuffer(
    rd.uniform as GPUBuffer,
    0,
    f.buffer,
    f.byteOffset,
    f.byteLength,
  );
}
