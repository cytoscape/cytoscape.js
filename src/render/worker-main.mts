import { Renderer } from './renderer.mjs';
import { RemoteModelView } from './remote-view.mjs';
import type {
  MainMessage,
  WireViewport,
  WorkerMessage,
} from './worker-protocol.mjs';
import type { RenderHost } from './host.mjs';
import type { GpuForceRuntime } from '../gpu/gpu-force.mjs';
import type { ForceInputs } from '../layout/force-host.mjs';
import { createBrowserImageDecoder } from './image-decoder.mjs';
import type { VectorRasterizer } from './image-decoder.mjs';
import type { DecodedImage } from '../image-registry.mjs';
import { registerWorkerFonts } from './worker-fonts.mjs';

/*
The worker-side entry (round 86.3): the real `Renderer` running against
a `RemoteModelView`, in a worker, drawing to the transferred
OffscreenCanvas.  The bundle exposes this as
`cytoscape.__runRenderWorker__`, and the proxy's spawn bootstrap calls
it after loading the bundle inside the worker — so exactly one build
artifact serves both threads.
*/

interface WorkerScope {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage(msg: WorkerMessage, transfer?: Transferable[]): void;
  close(): void;
}

/**
 * Run the render worker's message loop on a worker global scope.  The
 * first message must be `init`; everything before ready is queued by
 * the platform's own worker message queue.
 *
 * @param scope — the worker global (defaults to `globalThis`)
 * @internal the spawn bootstrap's entry, never consumer API — kept out
 *   of the shipped declaration like the other underscore machinery
 */
export function runRenderWorker(
  scope: WorkerScope = globalThis as unknown as WorkerScope,
): void {
  let engine: Renderer | null = null;
  let view: RemoteModelView | null = null;
  // the force run open here (129.2), its id and the state poll that
  // posts `forcestate` when converged / idle flip
  let force: {
    id: number;
    runtime: GpuForceRuntime;
    timer: ReturnType<typeof setInterval>;
    last: { converged: boolean; idle: boolean };
  } | null = null;

  const closeForce = (): void => {
    if (force != null) {
      clearInterval(force.timer);
      force = null;
    }
  };

  const postForceState = (id: number, runtime: GpuForceRuntime): void => {
    const converged = runtime.converged();
    const idle = runtime.idle();

    if (
      force != null &&
      force.id === id &&
      (force.last.converged !== converged || force.last.idle !== idle)
    ) {
      force.last = { converged, idle };
      post({ kind: 'forcestate', id, started: true, converged, idle });
    }
  };
  const viewport: WireViewport = { panX: 0, panY: 0, zoom: 1 };
  const viewportCbs: (() => void)[] = [];
  let arrows = {
    ends: { source: false, target: false },
    mid: { source: false, target: false },
  };

  const post = (msg: WorkerMessage, transfer?: Transferable[]): void => {
    scope.postMessage(msg, transfer);
  };

  // vector rasters the main thread does for us (round 141): SVG needs an
  // <img>, which a worker lacks; the fetched blob crosses, the raster
  // comes back transferred
  let nextRasterId = 1;
  const pendingRasters = new Map<
    number,
    { resolve: (image: DecodedImage) => void; reject: (err: Error) => void }
  >();
  const rasterViaMain: VectorRasterizer = (blob, targetPx, sdf) =>
    new Promise<DecodedImage>((resolve, reject) => {
      const id = nextRasterId++;

      pendingRasters.set(id, { resolve, reject });
      post({ kind: 'raster', request: { id, blob, targetPx, sdf } });
    });

  scope.onmessage = (e: MessageEvent) => {
    const msg = e.data as MainMessage;

    switch (msg.kind) {
      case 'init': {
        view = new RemoteModelView((dims) => {
          post({ kind: 'labeldims', dims });
        });
        arrows = msg.batch.arrows;
        viewport.panX = msg.batch.viewport.panX;
        viewport.panY = msg.batch.viewport.panY;
        viewport.zoom = msg.batch.viewport.zoom;
        view.applyBatch(msg.batch);

        const host: RenderHost = {
          store: view,
          viewport: {
            pan: () => ({ x: viewport.panX, y: viewport.panY }),
            zoom: () => viewport.zoom,
          },
          animations: {
            // the animation manager keeps its own main-side clock: CPU
            // tween writes cross as ordinary spans, and no GPU sink
            // exists on this side (the recorded pass-1 deferral)
            tick: () => {},
            active: () => false,
            attachDriver: () => {},
            detachDriver: () => {},
          },
          arrowEnds: () => arrows.ends,
          midArrowEnds: () => arrows.mid,
          onViewportChange: (cb) => {
            viewportCbs.push(cb);

            return () => {
              const i = viewportCbs.indexOf(cb);

              if (i >= 0) {
                viewportCbs.splice(i, 1);
              }
            };
          },
          emitRender: () => {
            post({
              kind: 'frame',
              stats: (engine as Renderer).stats(),
            });
          },
          // never fires here: the dpr listener arms only on a container
          // mount, and a worker has no matchMedia — the main thread
          // re-resolves the ratio and emits on the core itself (91.2)
          emitResize: () => {},
          emitError: (message) => post({ kind: 'error', message }),
          emitGpuError: (info) => post({ kind: 'gpuerror', info }),
          reportDeviceFit: (fit) => post({ kind: 'devicefit', fit }),
          gpuMappers: null,
          // round 141: raster sources fetch and decode here, off the
          // main thread; vectors raster main-side (rasterViaMain)
          createImageDecoder: () =>
            createBrowserImageDecoder(undefined, rasterViaMain),
        };

        engine = new Renderer(
          host,
          {
            canvas: msg.canvas,
            width: msg.width,
            height: msg.height,
            dpr: msg.dpr,
          },
          msg.opts,
        );
        engine.onDeviceLost = (message) =>
          post({ kind: 'devicelost', message });

        // the app's label fonts (round 141): registered from their bytes
        // in this worker's FontFaceSet, the labels re-rastering as each
        // face the atlas names lands
        if (msg.fonts.length > 0) {
          void registerWorkerFonts(
            msg.fonts,
            (face) => engine?.fontFacesLanded([face]),
            (message) => post({ kind: 'error', message }),
          ).then(({ loaded, failed }) =>
            post({ kind: 'fonts', loaded, failed }),
          );
        }
        engine.ready.then(
          () => post({ kind: 'ready' }),
          (err: Error) => post({ kind: 'initerror', message: err.message }),
        );
        break;
      }

      case 'batch': {
        arrows = msg.batch.arrows;
        viewport.panX = msg.batch.viewport.panX;
        viewport.panY = msg.batch.viewport.panY;
        viewport.zoom = msg.batch.viewport.zoom;
        view?.applyBatch(msg.batch);
        break;
      }

      case 'viewport': {
        viewport.panX = msg.viewport.panX;
        viewport.panY = msg.viewport.panY;
        viewport.zoom = msg.viewport.zoom;

        for (const cb of viewportCbs.slice()) {
          cb();
        }
        break;
      }

      case 'resize': {
        engine?.setSize(msg.width, msg.height, msg.dpr);
        break;
      }

      case 'pick': {
        const id = msg.id;

        if (engine == null) {
          post({ kind: 'pickresult', id, hit: null });
          break;
        }

        engine
          .pick(msg.x, msg.y, {
            edgePadPx: msg.edgePadPx,
            nodePadPx: msg.nodePadPx,
          })
          .then(
            (hit) => post({ kind: 'pickresult', id, hit }),
            () => post({ kind: 'pickresult', id, hit: null }),
          );
        break;
      }

      case 'counts': {
        const id = msg.id;

        if (engine == null) {
          post({ kind: 'countsresult', id, counts: null });
          break;
        }

        engine.viewportCounts().then(
          (counts) => post({ kind: 'countsresult', id, counts }),
          () => post({ kind: 'countsresult', id, counts: null }),
        );
        break;
      }

      case 'export': {
        const id = msg.id;

        if (engine == null) {
          post({
            kind: 'exportresult',
            id,
            ok: false,
            width: 0,
            height: 0,
            data: null,
            message: 'The worker renderer is not initialized',
          });
          break;
        }

        engine.exportFromView(msg.view).then(
          (image) =>
            post(
              {
                kind: 'exportresult',
                id,
                ok: true,
                width: image.width,
                height: image.height,
                data: image.data.buffer as ArrayBuffer,
                message: null,
              },
              [image.data.buffer as ArrayBuffer],
            ),
          (err: Error) =>
            post({
              kind: 'exportresult',
              id,
              ok: false,
              width: 0,
              height: 0,
              data: null,
              message: err.message,
            }),
        );
        break;
      }

      case 'render': {
        engine?.requestRender();
        break;
      }

      case 'forcestart': {
        const id = msg.id;
        const w = msg.inputs;
        const inputs: ForceInputs = {
          n: w.n,
          edges: w.edges,
          edgeLength: w.edgeLength,
          positions: w.positions,
          pinned: w.pinned,
          anchors: w.anchors,
          extents: w.extents,
          slots: Array.from(w.slots),
          params: w.params,
          cutoff: w.cutoff,
          frame: w.frame,
          infinite: w.infinite,
        };
        const runtime =
          engine == null
            ? null
            : engine.startForce(inputs, msg.stepsPerFrame, msg.present);

        if (runtime == null) {
          post({
            kind: 'forcestate',
            id,
            started: false,
            converged: true,
            idle: true,
          });
          break;
        }

        closeForce();
        force = {
          id,
          runtime,
          // the state poll: the layout polls its mirror every 60 ms,
          // so a 30 ms cadence keeps the mirror at most one poll behind
          timer: setInterval(() => postForceState(id, runtime), 30),
          last: { converged: false, idle: false },
        };
        postForceState(id, runtime);
        break;
      }

      case 'forceupdate': {
        if (force == null || force.id !== msg.id) {
          break;
        }

        const u = msg.update;

        if (u.op === 'position') {
          force.runtime.setPosition(u.i, u.x, u.y);
        } else if (u.op === 'pinned') {
          force.runtime.setPinned(u.i, u.pinned);
        } else {
          force.runtime.reheat(u.alpha);
        }
        break;
      }

      case 'forcewake': {
        engine?.wakeForce();
        break;
      }

      case 'forceread': {
        const id = msg.id;

        if (force == null || force.id !== id) {
          post({ kind: 'forcepositions', id, positions: null });
          break;
        }

        force.runtime.readPositions().then(
          (positions) =>
            post(
              {
                kind: 'forcepositions',
                id,
                positions: positions.buffer as ArrayBuffer,
              },
              [positions.buffer as ArrayBuffer],
            ),
          () => post({ kind: 'forcepositions', id, positions: null }),
        );
        break;
      }

      case 'forcefinish': {
        if (force != null && force.id === msg.id) {
          closeForce();
          engine?.finishForce();
        }
        break;
      }

      case 'rasterresult': {
        const job = pendingRasters.get(msg.id);

        pendingRasters.delete(msg.id);

        if (job != null) {
          if (msg.image != null) {
            job.resolve(msg.image);
          } else {
            job.reject(new Error(msg.message ?? 'The vector raster failed'));
          }
        }
        break;
      }

      case 'destroy': {
        closeForce();

        for (const job of pendingRasters.values()) {
          job.reject(new Error('The renderer was destroyed'));
        }

        pendingRasters.clear();
        engine?.destroy();
        engine = null;
        view = null;
        scope.close();
        break;
      }
    }
  };
}
