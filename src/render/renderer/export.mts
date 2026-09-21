// The renderer's image export (round 130 split).

import { CulledGroup, CullKernels } from '../cull.mjs';
import { DEPTH_FORMAT } from '../node-pipeline.mjs';
import { CURVE_SEGS } from '../../curve-geometry.mjs';
import { ExportPacker } from '../export-pack.mjs';
import type { PackedExport } from '../export-pack.mjs';
import { BUFFER_USAGE, MAP_MODE, TEXTURE_USAGE } from '../webgpu-constants.mjs';
import type { ExportOptions } from '../../public-types.mjs';
import { resolveExportView } from './export-view.mjs';
import {
  DEFAULT_EDGE_WIDTH_FLOOR,
  DEFAULT_NODE_LOD_PX,
  DEFAULT_HIDE_PX,
  DEFAULT_LABEL_FADE_PX,
  DEFAULT_IMAGE_MIN_PX,
  DEFAULT_LABEL_MIN_PX,
} from '../renderer.mjs';
import type {
  ExportedImage,
  ExportView,
  ExportJob,
  Renderer,
} from '../renderer.mjs';
import { drawScene, encodeCulls } from './scene.mjs';
import { promoteVectors } from './force.mjs';

/**
 * Render the scene into an offscreen texture at the requested viewport
 * (the on-screen one, or the whole graph with `full`) and read the
 * pixels back.  Resolves with straight-alpha RGBA rows (no padding).
 *
 * The export is encoded inside the frame loop, after any pending scene
 * work for that frame, so it sees exactly the state the screen shows —
 * including GPU-owned columns mid-animation.  It always renders at
 * native resolution (the adaptive render scale never applies) and label
 * LOD thresholds evaluate at the *export* scale, so a full/high-scale
 * export is a self-consistent figure rather than a copy of the screen's
 * label culling.
 */
export async function exportImage(
  rd: Renderer,
  opts: ExportOptions = {},
): Promise<ExportedImage> {
  await rd.ready;

  if (rd.destroyed || rd.device == null) {
    throw new Error('Cannot export an image: the renderer is destroyed');
  }

  const view = computeExportView(rd, opts);

  // 15.6: a high-scale export can demand resolution the screen never
  // did — re-raster vector images at the export scale and wait for
  // the decodes (bounded), so the WYSIWYG figure is crisp
  if (rd.store.imageCount() > 0) {
    promoteVectors(rd, view.zoom, false);

    if (rd.store.images.busy()) {
      await Promise.race([
        rd.store.images.whenSettled(),
        new Promise<void>((resolve) => setTimeout(resolve, 2000)),
      ]);
      // let the fresh rasters upload before the export frame encodes
      rd.imageArrays?.sync(rd.store.images);
    }
  }

  return rd.exportFromView(view);
}

/**
 * Queue an export of a pre-resolved view (round 86.3): the worker
 * proxy computes the view on the main thread — where the container's
 * CSS size and the model bounding box live — and the engine validates
 * it against the device and renders it.  The same-thread
 * `exportImage` funnels through here too.
 *
 * @param view — output px dimensions + the Frame transform
 * @returns straight-alpha RGBA pixels, as `exportImage`
 */
export async function exportFromView(
  rd: Renderer,
  view: ExportView,
): Promise<ExportedImage> {
  await rd.ready;

  if (rd.destroyed || rd.device == null) {
    throw new Error('Cannot export an image: the renderer is destroyed');
  }

  const limit = rd.device.limits.maxTextureDimension2D;

  if (view.wPx > limit || view.hPx > limit) {
    throw new Error(
      `The export dimensions ${view.wPx}×${view.hPx} exceed the device's ${limit}px texture limit; ` +
        `use maxWidth/maxHeight or a smaller scale`,
    );
  }

  // a high-scale export can demand label resolution the screen never
  // did (round 94, the 15.6 image rule applied to text): promote the
  // atlas tier at the export scale so the WYSIWYG figure is crisp.
  // Safe here because the export encodes inside the frame loop after
  // labelLayer.process() rebuilds the freshly-dirtied runs.
  rd.labelLayer?.maybePromote(view.zoom);

  return new Promise((resolve, reject) => {
    rd.pendingExports.push({ view, resolve, reject });
    rd.schedule();
  });
}

/** Resolve the export options to output dimensions + Frame transform. */
export function computeExportView(
  rd: Renderer,
  opts: ExportOptions,
): ExportView {
  // same-thread only: a worker engine has no container, and its proxy
  // resolves views on the main thread (exportFromView)
  const container = rd.container as HTMLElement;

  return resolveExportView(
    opts,
    container.clientWidth,
    container.clientHeight,
    () => rd.store.boundingBox(),
    rd.host.viewport,
  );
}

/** The export Frame uniform: output px viewport, dpr-free transform,
 * LOD thresholds in export px (see exportImage). */
export function writeExportUniform(rd: Renderer, view: ExportView): void {
  const device = rd.device as GPUDevice;
  const opts = rd.opts;
  const f = rd.exportFrameData;

  if (rd.exportUniform == null) {
    rd.exportUniform = device.createBuffer({
      label: 'cy-gpu:export-frame-uniform',
      size: f.byteLength,
      usage: BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST,
    });
  }

  f[0] = view.wPx;
  f[1] = view.hPx;
  f[2] = view.panX;
  f[3] = view.panY;
  f[4] = view.zoom;
  f[5] = opts.edgeWidthFloor ?? DEFAULT_EDGE_WIDTH_FLOOR;
  f[6] = opts.nodeLodPx ?? DEFAULT_NODE_LOD_PX;
  f[7] = opts.hidePx ?? DEFAULT_HIDE_PX;
  f[8] = opts.edgeDimming
    ? Math.min(0.85, Math.max(0, 1 - view.zoom) * 0.85)
    : 0;
  f[9] = opts.labelFadePx ?? DEFAULT_LABEL_FADE_PX;
  f[10] = opts.labelMinPx ?? DEFAULT_LABEL_MIN_PX;
  f[11] = rd.store.curveSlack();
  f[12] = rd.store.haystackSlack();
  f[13] = rd.store.outlineSlack();
  f[14] = rd.store.arrowScaleMax();
  f[17] = rd.store.arrowWidthMax(); // 56: hollow strokes reach outside the head
  f[15] = opts.imageMinPx ?? DEFAULT_IMAGE_MIN_PX; // export scale is the figure's own resolution

  device.queue.writeBuffer(
    rd.exportUniform,
    0,
    f.buffer,
    f.byteOffset,
    f.byteLength,
  );
}

/**
 * Encode + submit one export: cull against the export uniform, draw the
 * scene into a transient offscreen target, copy to a staging buffer.
 * Synchronous up to the submit (so per-job uniform writes order
 * correctly against per-job submits); the readback resolves async.
 */
export function renderExport(rd: Renderer, job: ExportJob): void {
  const device = rd.device as GPUDevice;
  const { wPx, hPx, bg } = job.view;

  try {
    writeExportUniform(rd, job.view);

    if (rd.exportCull == null) {
      const kernels = rd.cullKernels as CullKernels;

      rd.exportCull = {
        node: new CulledGroup(kernels, 'node', 'export-node'),
        parent: new CulledGroup(kernels, 'parentNode', 'export-parent'),
        edge: new CulledGroup(kernels, 'edge', 'export-edge'),
        curved: new CulledGroup(
          kernels,
          'curvedEdge',
          'export-curved-edge',
          6 * CURVE_SEGS,
        ),
        glyph: new CulledGroup(kernels, 'glyph', 'export-glyph'),
        edgeGlyph: new CulledGroup(kernels, 'edgeGlyph', 'export-edge-glyph'),
        sourceGlyph: new CulledGroup(
          kernels,
          'edgeGlyph',
          'export-source-glyph',
        ),
        targetGlyph: new CulledGroup(
          kernels,
          'edgeGlyph',
          'export-target-glyph',
        ),
        ghost: new CulledGroup(kernels, 'ghost', 'export-ghost'),
        overlay: new CulledGroup(kernels, 'nodeLayer', 'export-overlay'),
        underlay: new CulledGroup(kernels, 'nodeLayer', 'export-underlay'),
      };
    }

    const format = rd.format as GPUTextureFormat;
    // the pack pass reads the target back through a texture binding
    // (110.4), so no COPY_SRC and no padded row copy
    const texture = device.createTexture({
      label: 'cy-gpu:export-target',
      size: { width: wPx, height: hPx },
      format,
      usage: TEXTURE_USAGE.RENDER_ATTACHMENT | TEXTURE_USAGE.TEXTURE_BINDING,
    });
    const depth = device.createTexture({
      label: 'cy-gpu:export-depth',
      size: { width: wPx, height: hPx },
      format: DEPTH_FORMAT,
      usage: TEXTURE_USAGE.RENDER_ATTACHMENT,
    });

    const encoder = device.createCommandEncoder({ label: 'cy-gpu:export' });

    encodeCulls(
      rd,
      encoder,
      rd.exportUniform as GPUBuffer,
      rd.exportCull,
      false,
    );

    // the clear color is premultiplied, like everything the pipelines blend
    const a = bg == null ? 0 : bg[3];
    const pass = encoder.beginRenderPass({
      label: 'cy-gpu:export-pass',
      colorAttachments: [
        {
          view: texture.createView(),
          clearValue:
            bg == null
              ? { r: 0, g: 0, b: 0, a: 0 }
              : {
                  r: (bg[0] / 255) * a,
                  g: (bg[1] / 255) * a,
                  b: (bg[2] / 255) * a,
                  a,
                },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: depth.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'discard',
      },
    });

    drawScene(rd, pass, rd.exportUniform as GPUBuffer, rd.exportCull);
    pass.end();

    // the device converts the premultiplied target into final
    // straight-alpha RGBA bytes (110.4); the readback only maps them
    rd.exportPacker ??= new ExportPacker(device);

    const packed = rd.exportPacker.encode(encoder, texture, wPx, hPx);

    device.queue.submit([encoder.finish()]);

    void readbackExport(rd, job, packed, texture, depth);
  } catch (err) {
    job.reject(err as Error);
  }
}

/**
 * Map the packed staging buffer and hand its bytes over.  The one copy
 * left is the `slice()` out of the mapped range, which dies at
 * `unmap()`; the census priced it at the memcpy floor (110.4).
 */
export async function readbackExport(
  rd: Renderer,
  job: ExportJob,
  packed: PackedExport,
  texture: GPUTexture,
  depth: GPUTexture,
): Promise<void> {
  const { wPx, hPx } = job.view;
  const { staging, scratch } = packed;

  try {
    await staging.mapAsync(MAP_MODE.READ);

    const data = new Uint8ClampedArray(staging.getMappedRange().slice(0));

    staging.unmap();
    job.resolve({ data, width: wPx, height: hPx });
  } catch (err) {
    job.reject(err as Error); // device lost or destroyed mid-flight
  } finally {
    staging.destroy();

    for (const buffer of scratch) {
      buffer.destroy();
    }

    texture.destroy();
    depth.destroy();
  }
}
