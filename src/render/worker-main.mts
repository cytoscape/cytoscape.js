import { Renderer } from './renderer.mjs';
import { RemoteModelView } from './remote-view.mjs';
import type {
  MainMessage,
  WireViewport,
  WorkerMessage,
} from './worker-protocol.mjs';
import type { RenderHost } from './host.mjs';
import type { ForceInputs, GpuForceRuntime } from './gpu-force.mjs';

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
          gpuMappers: null,
          createImageDecoder: () => null,
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

      case 'destroy': {
        closeForce();
        engine?.destroy();
        engine = null;
        view = null;
        scope.close();
        break;
      }
    }
  };
}
