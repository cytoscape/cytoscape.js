// The renderer's frame (round 130 split): device init, the frame body
// and the settle timer, as functions over the renderer.  See `Renderer`
// in ../renderer.mts for the surface.

import { initGpuContext } from '../../gpu-context.mjs';
import { ColumnMirror } from '../column-mirror.mjs';
import { CulledGroup, CullKernels } from '../cull.mjs';
import { NodePipeline } from '../node-pipeline.mjs';
import { EdgePipeline } from '../edge-pipeline.mjs';
import { CURVE_SEGS } from '../../curve-geometry.mjs';
import { ArrowPipeline } from '../arrow-pipeline.mjs';
import { Picking } from '../picking.mjs';
import { GpuTimer } from '../gpu-timer.mjs';
import { LabelLayer } from '../label-layer.mjs';
import { MapperRuntime } from '../mapper-runtime.mjs';
import { ImageArrays } from '../image-arrays.mjs';
import { GpuTweenRuntime } from '../gpu-tween.mjs';
import { nextBatch } from '../gpu-force.mjs';
import { Upscaler } from '../upscale.mjs';
import { BUFFER_USAGE } from '../webgpu-constants.mjs';
import { COL } from '../../contract.mjs';
import {
  SETTLE_TO_MAX_MS,
  EMPTY_DELTA,
  PICK_NEUTRAL_COLUMNS,
  MAX_IN_FLIGHT_FRAMES,
} from '../renderer.mjs';
import type { Renderer } from '../renderer.mjs';
import { drawScene, encodeCulls } from './scene.mjs';
import { drawPickPasses, writePickUniform } from './pick.mjs';
import { renderExport } from './export.mjs';
import {
  ensureSceneTarget,
  ensureDepthTarget,
  writeFrameUniform,
} from './targets.mjs';

/** Acquire the device and build the pipelines, the mirror, the cull kernels and the label layer; resolves `ready`, or rejects when no adapter is reachable. */
export async function init(rd: Renderer): Promise<void> {
  const { device, context, format } = await initGpuContext(
    rd.canvas,
    (info) => {
      // our own teardown destroys the device after flagging `destroyed`;
      // anything else is a real external loss
      if (rd.destroyed) {
        return;
      }

      rd.isReady = false;

      if (rd.onDeviceLost != null) {
        rd.onDeviceLost(info.message);
      } else {
        rd.host.emitError(`WebGPU device lost: ${info.message}`);
      }
    },
  );

  if (rd.destroyed) {
    device.destroy();

    return;
  }

  rd.device = device;
  rd.context = context;
  rd.uniform = device.createBuffer({
    label: 'cy-gpu:frame-uniform',
    size: rd.frameData.byteLength,
    usage: BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST,
  });

  // the mirror constructor uploads the full backing arrays, so any delta
  // accumulated before readiness is already covered — pending derived
  // geometry (parent auto-bounds, curve params) must land in the
  // backing arrays first, though: their usual flush point is takeDelta,
  // whose result is discarded here (the 12a init-order lesson, which
  // round 14.9 re-hit for the hierarchy flush)
  rd.store.flushDerived();
  rd.mirror = new ColumnMirror(device, rd.store);
  rd.store.takeDelta();

  // the CPU-applied base is current at init, so pre-ready data spans are
  // covered too; the runtime's first update() configures + fully
  // evaluates.  No mapper seam (a worker host, 86.2) means no runtime:
  // the CPU-applied style columns stay canonical and nothing is ever
  // marked GPU-owned, so correctness is unchanged — data-driven style
  // updates just cost their CPU apply.
  const mappers = rd.host.gpuMappers;

  rd.mapperRuntime =
    mappers == null
      ? null
      : new MapperRuntime(
          device,
          mappers.store,
          mappers.styleEngine,
          rd.mirror,
        );

  // GPU tweens: any mirrored column + the mirror version (rebinds on
  // realloc).  Attaching makes the animation manager route position and
  // paint animations here and cede its clock to rd frame loop.
  rd.tweenRuntime = new GpuTweenRuntime(
    device,
    (id) => (rd.mirror as ColumnMirror).buffer(id),
    () => (rd.mirror as ColumnMirror).version,
  );
  rd.host.animations.attachDriver(rd.tweenRuntime);
  rd.store.takeMapperSpans();

  rd.pickUniform = device.createBuffer({
    label: 'cy-gpu:pick-frame-uniform',
    size: rd.pickFrameData.byteLength,
    usage: BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST,
  });

  const kernels = new CullKernels(device);

  rd.cullKernels = kernels;
  rd.sceneCull = {
    node: new CulledGroup(kernels, 'node', 'scene-node'),
    parent: new CulledGroup(kernels, 'parentNode', 'scene-parent'),
    edge: new CulledGroup(kernels, 'edge', 'scene-edge'),
    curved: new CulledGroup(
      kernels,
      'curvedEdge',
      'scene-curved-edge',
      6 * CURVE_SEGS,
    ),
    glyph: new CulledGroup(kernels, 'glyph', 'scene-glyph'),
    edgeGlyph: new CulledGroup(kernels, 'edgeGlyph', 'scene-edge-glyph'),
    sourceGlyph: new CulledGroup(kernels, 'edgeGlyph', 'scene-source-glyph'),
    targetGlyph: new CulledGroup(kernels, 'edgeGlyph', 'scene-target-glyph'),
    ghost: new CulledGroup(kernels, 'ghost', 'scene-ghost'),
    overlay: new CulledGroup(kernels, 'nodeLayer', 'scene-overlay'),
    underlay: new CulledGroup(kernels, 'nodeLayer', 'scene-underlay'),
  };
  rd.pickCull = {
    // nodes pick synchronously on the CPU; only edges need the GPU pass
    edge: new CulledGroup(kernels, 'edge', 'pick-edge'),
    curved: new CulledGroup(
      kernels,
      'curvedEdge',
      'pick-curved-edge',
      6 * CURVE_SEGS,
    ),
  };

  rd.format = format;
  // Every graph draws nodes and straight edges, so those pipelines are
  // built here.  The feature pipelines are not — see the "deferred
  // pipelines" section: each is built the first time its own draw runs.
  rd.nodePipeline = new NodePipeline(device, format, kernels.visibleLayout);
  rd.imageArrays = new ImageArrays(device);
  // the environment's rasterizer: entries acquired while headless kick
  // now (null where the host cannot decode — the worker host, pass 1)
  const decoder = rd.host.createImageDecoder();

  if (decoder != null) {
    rd.store.images.setDecoder(decoder);
  }
  rd.edgePipeline = new EdgePipeline(device, format, kernels.visibleLayout);
  rd.arrowPipeline = new ArrowPipeline(device, format, kernels.visibleLayout);
  rd.labelLayer = new LabelLayer(device, rd.store);
  rd.picking = new Picking(device);
  rd.upscaler = rd.scaleCtl.min < 1 ? new Upscaler(device, format) : null;
  rd.gpuTimer = GpuTimer.isSupported(device) ? new GpuTimer(device) : null;

  rd.isReady = true;
  rd.needsRedraw = true;
  rd.schedule(); // first frame
}

/** One frame: sync the dirty spans to the mirror, run the pending pick, then cull, draw and present when anything changed — the order the file header describes. */
export function frameBody(rd: Renderer): void {
  const device = rd.device;
  const context = rd.context;
  const mirror = rd.mirror;

  if (
    rd.destroyed ||
    !rd.isReady ||
    device == null ||
    context == null ||
    mirror == null
  ) {
    return;
  }
  if (rd.canvas.width === 0 || rd.canvas.height === 0) {
    return;
  }

  const t0 = performance.now();
  const store = rd.store;
  let delta: ReturnType<typeof store.takeDelta> | null = null;

  // advance animations on our frame clock (CPU tweens write columns →
  // dirty; GPU tweens register/settle here).  A tweened column is
  // GPU-owned while its batch runs so the mirror won't clobber it; the
  // settle in tick() releases ownership before setTweenOwned below, so
  // the settled values upload on rd same frame
  rd.host.animations.tick(t0);

  // a live *presenting* force run owns node.position like a tween
  // lease (18.3); a silent run (87.2) publishes into its own scratch
  // buffer and leaves the mirror column alone
  const forceOwned =
    rd.forceRuntime != null && rd.forcePresents && !rd.forceRuntime.converged()
      ? rd.forceRuntime.ownedColumns()
      : [];

  mirror.setTweenOwned([
    ...(rd.tweenRuntime?.ownedColumns() ?? []),
    ...forceOwned,
  ] as Parameters<ColumnMirror['setTweenOwned']>[0]);

  if (rd.forceRuntime != null) {
    // a non-presenting run batches by what the device kept up with
    // (119): read before the poll, which is what clears the pending
    // readback rd frame's batch is judged by
    if (!rd.forcePresents) {
      rd.forceBatch = nextBatch(
        rd.forceBatch,
        rd.forceStepsPerFrame,
        rd.forceFrameSkipped,
        rd.forcePriceMs,
        rd.forcePriceBatch,
      );
      rd.forceFrameSkipped = false;
    }

    rd.forceRuntime.pollConvergence();

    // the sim advances every frame — unless an infinite run is at
    // rest (118.3), when the frame is the last until a wake
    if (!rd.forceRuntime.idle() || rd.forceRuntime.converged()) {
      rd.needsRedraw = true;
    }
  }

  if (rd.host.animations.active()) {
    rd.needsRedraw = true;
  }

  if (store.hasDirty()) {
    rd.needsRedraw = true;

    delta = store.takeDelta();

    // color/opacity-only changes can't alter pick coverage; anything
    // else (geometry, flags, growth) drops the cached pick tile
    if (
      delta.resized.nodes ||
      delta.resized.edges ||
      delta.spans.some((span) => !PICK_NEUTRAL_COLUMNS.has(span.column))
    ) {
      rd.picking?.invalidateCache();
    }

    mirror.sync(delta);
  }

  // unconditional: a sheet change reconfigures on the next frame even
  // when the store itself is clean
  rd.mapperRuntime?.update(delta ?? EMPTY_DELTA);

  // slot compaction (19.4): glyph owner words are stale wholesale —
  // drop every run before the rebuild pass below (the store marked all
  // labels dirty at compaction); the column mirror handles its own
  // capacity change, and `resized` already invalidated the pick cache
  if (store.compactEpoch !== rd.seenCompactEpoch) {
    rd.seenCompactEpoch = store.compactEpoch;
    rd.labelLayer?.onCompacted();
  }

  rd.labelLayer?.process(); // rebuild glyph runs for label-dirty nodes

  // a graph built while already zoomed in promotes its labels on
  // arrival (round 94, the 15.6 fresh-upload rule): construction sets
  // the viewport without firing a viewport event, so a larger label
  // landing re-arms the debounced meter here
  if (rd.labelLayer?.takeMaxFontRose() ?? false) {
    rd.schedulePromotionCheck();
  }

  // background images (15.3): reclaim freed layers, upload rasters that
  // landed since the last frame (+ their mip chains, own submits).
  // Fresh uploads re-check the promotion meter — a graph built while
  // already zoomed in promotes its vectors on arrival (15.6).
  if (rd.imageArrays != null && rd.imageArrays.sync(store.images) > 0) {
    rd.schedulePromotionCheck();
  }

  // pick pass first, in its own submit: a tiny cursor-centered tile whose
  // readback maps as soon as it executes, never queued behind a scene draw.
  // A full staging ring defers the request — no encode, no drop; the
  // pending check in the reschedule tail below retries it next frame,
  // and a slot frees as soon as the oldest readback maps
  const picking = rd.picking;
  const pending = picking?.peekPending() ?? null;

  if (picking != null && pending != null && rd.pickCull != null) {
    if (picking.hasFreeSlot()) {
      writePickUniform(rd, pending.xPx, pending.yPx, pending.padPx);

      const pickEncoder = device.createCommandEncoder({
        label: 'cy-gpu:pick',
      });

      // the pick-tile Frame uniform turns the cull predicates' viewport
      // test into cursor-region culling: the pick draw stays O(region)
      encodeCulls(
        rd,
        pickEncoder,
        rd.pickUniform as GPUBuffer,
        rd.pickCull,
        false,
      );
      drawPickPasses(rd, pickEncoder, picking.targetView());

      const copy = picking.encodeCopy(pickEncoder);

      device.queue.submit([pickEncoder.finish()]);

      if (copy != null) {
        void picking.finish(copy);
      }
    } else {
      picking.deferrals++; // observable saturation (stats().pickDeferrals)
    }
  }

  // scene pass only when something actually changed: render-on-dirty is
  // preserved while hover picking runs over a static graph.  When the GPU
  // is behind, keep needsRedraw and retry next rAF rather than queueing
  // deeper (state coalesces; latency stays bounded).
  if (
    rd.needsRedraw &&
    rd.inFlightFrames >= MAX_IN_FLIGHT_FRAMES &&
    rd.forceRuntime != null
  ) {
    rd.forceFrameSkipped = true;
  }

  if (
    rd.needsRedraw &&
    rd.inFlightFrames < MAX_IN_FLIGHT_FRAMES &&
    rd.sceneCull != null
  ) {
    rd.needsRedraw = false;
    writeFrameUniform(rd);

    const encoder = device.createCommandEncoder({ label: 'cy-gpu:frame' });
    // the non-presenting force batch rd frame carries, for its
    // price (121.5)
    let encodedBatch = 0;

    // GPU position tweens: their own compute pass, before cull — the
    // pass boundary is the barrier so cull (and the edge shaders) read
    // the freshly-tweened node.position.  Paint tweens don't need it and
    // ride the cull pass instead (see encodeCulls).
    if (rd.tweenRuntime != null && rd.tweenRuntime.hasPositions()) {
      const tweenPass = encoder.beginComputePass({
        label: 'cy-gpu:tween-pass',
      });

      rd.tweenRuntime.encode(tweenPass, t0, 'position');
      tweenPass.end();
    }

    // the GPU force integrator (18.3): its iterations advance the
    // sim and publish into the mirror's position buffer before the
    // cull pass reads it — edges and labels follow for free.  A
    // silent run (87.2) publishes into the runtime's own scratch
    // buffer instead, so the draw keeps reading the pre-run column
    if (
      rd.forceRuntime != null &&
      !rd.forceRuntime.converged() &&
      !rd.forceRuntime.idle()
    ) {
      rd.forceRuntime.encode(
        encoder,
        rd.forcePresents
          ? mirror.buffer(COL.NODE_POSITION)
          : rd.forceRuntime.silentTarget(),
        rd.forcePresents ? rd.forceStepsPerFrame : rd.forceBatch,
      );
      encodedBatch = rd.forcePresents ? 0 : rd.forceBatch;
    }

    // compact each group's visible slots + indirect args before drawing
    encodeCulls(rd, encoder, rd.uniform as GPUBuffer, rd.sceneCull, true, t0);

    // render scale < 1: draw into a low-res offscreen target, then a
    // Catmull-Rom upscale pass resamples it to the swapchain
    const scaled = rd.upscaler != null && rd.scaleCtl.scale < 1;
    const view = scaled
      ? (ensureSceneTarget(rd) as GPUTexture).createView()
      : context.getCurrentTexture().createView();
    const pass = encoder.beginRenderPass({
      label: 'cy-gpu:render-pass',
      colorAttachments: [
        {
          view,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: ensureDepthTarget(rd).createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'discard', // only consumed within rd pass
      },
      ...(rd.gpuTimer != null
        ? { timestampWrites: rd.gpuTimer.timestampWrites() }
        : {}),
    });

    drawScene(rd, pass, rd.uniform as GPUBuffer, rd.sceneCull);
    pass.end();

    if (scaled) {
      const upscalePass = encoder.beginRenderPass({
        label: 'cy-gpu:upscale-pass',
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
        ...(rd.gpuTimer != null
          ? { timestampWrites: rd.gpuTimer.postTimestampWrites() }
          : {}),
      });

      (rd.upscaler as Upscaler).draw(
        upscalePass,
        device,
        rd.sceneTarget as GPUTexture,
      );
      upscalePass.end();
    }

    const finishTiming = rd.gpuTimer?.encodeResolve(encoder, scaled) ?? null;

    device.queue.submit([encoder.finish()]);
    finishTiming?.();

    rd.inFlightFrames++;

    const submittedAt = performance.now();

    device.queue.onSubmittedWorkDone().then(
      () => {
        rd.inFlightFrames--;

        // the batch's price (121.5): the device's time on rd frame
        // is from the later of its submit and the previous frame's
        // completion — the queue runs frames back to back — to now
        if (encodedBatch > 0) {
          const now = performance.now();

          rd.forcePriceMs = now - Math.max(submittedAt, rd.forceDoneAt);
          rd.forcePriceBatch = encodedBatch;
          rd.forceDoneAt = now;
        }
      },
      () => {
        rd.inFlightFrames--;
      },
    );

    rd.frameCount++;
    rd.host.emitRender();

    // adaptive resolution: feed the drawn frame's GPU cost to the
    // controller and rearm the idle settle-to-max timer
    if (rd.scaleCtl.frameDrawn(t0, rd.gpuTimer?.lastMs ?? 0) != null) {
      rd.needsRedraw = true;
    }

    armSettleTimer(rd);
  } else if (rd.needsRedraw) {
    // wanted to draw but the GPU is behind: a stall tick is the
    // adaptive-scale fallback signal when GPU timing is unavailable
    if (rd.scaleCtl.frameStalled(t0) != null) {
      rd.needsRedraw = true;
    }
  }

  // exports see exactly rd frame's state: when the scene drew, the
  // mapper/tween dispatches above are already encoded ahead of the
  // export submit; when nothing was dirty, the buffers were already
  // current.  A skipped scene pass (backpressure) leaves needsRedraw
  // set, deferring the export to a coherent later frame.
  if (rd.pendingExports.length > 0 && !rd.needsRedraw) {
    const jobs = rd.pendingExports;

    rd.pendingExports = [];

    for (const job of jobs) {
      renderExport(rd, job);
    }
  }

  rd.cpuFrameMs = performance.now() - t0;

  if (
    store.hasDirty() ||
    rd.needsRedraw ||
    rd.host.animations.active() ||
    (rd.forceRuntime != null && !rd.forceRuntime.idle()) || // a live force run drives the clock (18.3); an idle infinite run does not (118.3)
    (picking?.hasPending() ?? false) ||
    rd.pendingExports.length > 0
  ) {
    rd.schedule();
  }
}

/** Shortly after drawing stops, re-render one frame at max scale so
 * the still image the user actually inspects is full-resolution. */
export function armSettleTimer(rd: Renderer): void {
  if (rd.settleTimer != null) {
    clearTimeout(rd.settleTimer);
  }

  rd.settleTimer = setTimeout(() => {
    rd.settleTimer = null;

    if (rd.destroyed || !rd.isReady || rd.needsRedraw) {
      return;
    }

    if (rd.scaleCtl.settleToMax() != null) {
      rd.needsRedraw = true;
      rd.schedule();
    }
  }, SETTLE_TO_MAX_MS);
}
