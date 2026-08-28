import { pickNodeTierAt, type NodePickTier } from './cpu-pick.mjs';
import { EDGE_PICK_BIT } from './picking.mjs';
import { resolveExportView } from './renderer.mjs';
import type { ExportedImage } from './renderer.mjs';
import { buildBatch, collectTransfers } from './worker-protocol.mjs';
import type {
  BatchBuilderState,
  MainMessage,
  StoreBatch,
  WorkerMessage,
} from './worker-protocol.mjs';
import type { Core } from '../core.mjs';
import type {
  ExportOptions,
  RendererOptions,
  RendererStats,
} from '../public-types.mjs';

/*
The main-thread side of the worker-hosted renderer (round 86.3): a
proxy that satisfies everything the core and the pointer layer need
from a renderer — `RendererLike`, the gesture surface (canvas, sync
node pick, async pick), device-loss forwarding — while the real
`Renderer` runs in a worker against a `RemoteModelView`.

What stays on this thread, and why:

- **The canonical store, and every synchronous read.**  `pickNodeSync`
  (the pan-vs-grab decision on pointerdown) runs here over the
  canonical columns via `pickNodeAt` — current, never mirrored-stale.
- **The canvas element.**  It stays in the DOM receiving pointer
  events; only its rendering control transfers.
- **The animation clock.**  The manager keeps its own rAF loop (the
  sink-less path it always had); CPU tween writes cross as ordinary
  spans.  GPU tweens and the GPU force integrator are pass-1
  deferrals: `startForce` is absent here, so the force layout takes
  its CPU executor.
- **Export view resolution** (container CSS size + model bounds), via
  `resolveExportView`; the worker validates against the device and
  renders.

Per-batch traffic is `buildBatch`'s drain of the store's own delta —
priced by the 86.1 gate at 0.035 ms/frame for the worst case at
harness scale, buffers transferred.
*/

const DEFAULT_NODE_LOD_PX = 3;
const DEFAULT_HIDE_PX = 1;

/** Resolve the URL the current bundle was loaded from, if knowable. */
const selfUrl = (): { url: string; module: boolean } | null => {
  if (typeof document !== 'undefined') {
    const el = document.currentScript;

    if (el instanceof HTMLScriptElement && el.src !== '') {
      return { url: el.src, module: el.type === 'module' };
    }
  }

  try {
    if (typeof import.meta !== 'undefined' && import.meta.url != null) {
      return { url: import.meta.url, module: true };
    }
  } catch {
    // a classic-script transform may leave no import.meta at all
  }

  return null;
};

/** captured at evaluation time — currentScript is null after load */
const SELF = selfUrl();

/**
 * Spawn the render worker from this bundle's own URL: a classic worker
 * that `importScripts` the UMD bundle, or a module worker that imports
 * the ESM one, then calls `cytoscape.__runRenderWorker__`.  One build
 * artifact serves both threads.
 *
 * @returns the worker
 * @throws when the bundle's URL could not be captured at load time
 */
const spawnRenderWorker = (): Worker => {
  if (SELF == null) {
    throw new Error(
      'renderer.worker requires the cytoscape bundle to be loaded from a ' +
        'URL (a script tag or an ES module import), so the worker can ' +
        'load the same bundle',
    );
  }

  const url = JSON.stringify(SELF.url);

  if (SELF.module) {
    // buffer messages until the async import lands, then replay
    const src =
      'const q=[];self.onmessage=(e)=>q.push(e);' +
      `import(${url}).then((m)=>{` +
      '(m.default??m).__runRenderWorker__();' +
      'for(const e of q){self.onmessage(e);}' +
      '});';

    return new Worker(
      URL.createObjectURL(new Blob([src], { type: 'text/javascript' })),
      { type: 'module' },
    );
  }

  const src =
    `importScripts(${url});` + 'self.cytoscape.__runRenderWorker__();';

  return new Worker(
    URL.createObjectURL(new Blob([src], { type: 'text/javascript' })),
  );
};

/**
 * The worker-hosted renderer's main-thread proxy, mounted by the
 * factory under `renderer: { worker: true }`.  Implements the core's
 * `RendererLike` and the pointer layer's gesture surface.
 */
export class WorkerRenderer {
  /** resolves when the worker's device is acquired and the first frame
   * can draw; rejects when the worker has no WebGPU or no adapter */
  ready: Promise<void>;
  /** the DOM canvas (control transferred to the worker); pointer events
   * bind here exactly as on the same-thread path */
  canvas: HTMLCanvasElement;
  /** wired by the factory: an external device loss hands recovery to
   * the core, which re-mounts (respawning a fresh worker) */
  onDeviceLost: ((message: string) => void) | null = null;

  private cy: Core;
  private container: HTMLElement;
  private opts: RendererOptions;
  private worker: Worker;
  private dpr: number;
  private destroyed = false;
  private offInvalidate: () => void;
  private onViewport: () => void;
  private resizeObserver: ResizeObserver | null;
  private batchScheduled = false;
  private batchState: BatchBuilderState = { parentOrderRef: null };
  private lastStats: RendererStats;
  private nextRequestId = 1;
  private pendingPicks = new Map<number, (hit: number | null) => void>();
  private pendingExports = new Map<
    number,
    {
      resolve: (image: ExportedImage) => void;
      reject: (err: Error) => void;
    }
  >();
  private imagesWarned = false;

  /**
   * Create the canvas, transfer its control, spawn the worker from the
   * bundle's own URL and send the full-state init transfer.  Subscribes
   * to store invalidation (batch drains), viewport events and container
   * resizes, exactly where the same-thread renderer does.
   *
   * @param cy — the core; the canonical store stays here
   * @param container — the element the canvas is appended to
   * @param opts — renderer options (`worker` itself is ignored here)
   * @throws when OffscreenCanvas or Worker is unavailable, or the
   *   bundle URL could not be captured
   */
  constructor(
    cy: Core,
    container: HTMLElement,
    opts: RendererOptions & { pixelRatio?: number | 'auto' } = {},
  ) {
    if (
      typeof Worker === 'undefined' ||
      typeof OffscreenCanvas === 'undefined' ||
      typeof HTMLCanvasElement === 'undefined' ||
      HTMLCanvasElement.prototype.transferControlToOffscreen == null
    ) {
      throw new Error(
        'renderer.worker requires Worker and OffscreenCanvas support; ' +
          'omit the worker option to render on the main thread',
      );
    }

    this.cy = cy;
    this.container = container;
    this.opts = opts;
    this.dpr =
      opts.pixelRatio == null || opts.pixelRatio === 'auto'
        ? globalThis.devicePixelRatio || 1
        : opts.pixelRatio;
    this.lastStats = {
      frames: 0,
      cpuFrameMs: 0,
      gpuFrameMs: 0,
      gpuFrameReadings: 0,
      renderScale: 1,
      uploadedBytes: 0,
      nodes: 0,
      edges: 0,
      glyphs: 0,
      pickLatencyMs: 0,
      pickDeferrals: 0,
      mapperUploadedBytes: 0,
      mapperDispatches: 0,
      labelShapeHits: 0,
      labelShapeMisses: 0,
    };

    const doc = container.ownerDocument as Document;

    // fixed-px CSS rather than `100%`, as the same-thread renderer
    // (91.1): a worker frame is always at least a message late behind a
    // layout change, and a wrongly-*sized* canvas letterboxes where a
    // `100%` canvas stretches the stale presentation to the new box
    this.canvas = doc.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.display = 'block';

    if (
      doc.defaultView != null &&
      doc.defaultView.getComputedStyle(container).position === 'static'
    ) {
      container.style.position = 'relative';
    }

    container.appendChild(this.canvas);

    const cssW = container.clientWidth;
    const cssH = container.clientHeight;

    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;

    const width = Math.max(1, Math.round(cssW * this.dpr));
    const height = Math.max(1, Math.round(cssH * this.dpr));
    const offscreen = this.canvas.transferControlToOffscreen();

    this.worker = spawnRenderWorker();

    let readyResolve!: () => void;
    let readyReject!: (err: Error) => void;

    this.ready = new Promise<void>((resolve, reject) => {
      readyResolve = resolve;
      readyReject = reject;
    });

    this.worker.onmessage = (e: MessageEvent) => {
      this.onMessage(e.data as WorkerMessage, readyResolve, readyReject);
    };
    this.worker.onerror = (e: ErrorEvent) => {
      readyReject(new Error(`The render worker failed to start: ${e.message}`));
    };

    const batch = this.makeBatch(true);

    this.post(
      {
        kind: 'init',
        canvas: offscreen,
        width,
        height,
        dpr: this.dpr,
        opts: { ...opts, pixelRatio: this.dpr },
        batch,
      },
      [offscreen, ...collectTransfers(batch)],
    );

    this.offInvalidate = cy._store.onInvalidate(() => this.scheduleBatch());
    this.onViewport = () => {
      const pan = cy._viewport.pan();

      this.post({
        kind: 'viewport',
        viewport: { panX: pan.x, panY: pan.y, zoom: cy._viewport.zoom() },
      });
    };
    cy.on('viewport', this.onViewport);

    this.resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => this.resize())
        : null;
    this.resizeObserver?.observe(container);
  }

  /**
   * The latest frame's counters, mirrored from the worker: a snapshot
   * that trails the live values by up to a frame (`gpuFrameReadings`
   * transitions are the freshness signal, as its doc instructs).
   *
   * @returns the most recent stats snapshot
   */
  stats(): RendererStats {
    return this.lastStats;
  }

  /**
   * Post the container's current device-px size to the worker, and
   * re-fit the canvas CSS box in fixed px (91.1).
   */
  resize(): void {
    if (this.destroyed) {
      return;
    }

    const cssW = this.container.clientWidth;
    const cssH = this.container.clientHeight;

    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.post({
      kind: 'resize',
      width: Math.max(1, Math.round(cssW * this.dpr)),
      height: Math.max(1, Math.round(cssH * this.dpr)),
    });
  }

  /**
   * The GPU force integrator is a pass-1 deferral under the worker
   * host, so no run ever owns the position column here.
   *
   * @returns false always
   */
  forceActive(): boolean {
    return false;
  }

  /** Ask the worker for a redraw on its next frame. */
  requestRender(): void {
    this.post({ kind: 'render' });
  }

  /**
   * Async pick at a rendered (CSS px) position: nodes answer here,
   * synchronously current, over the canonical columns; edges cross to
   * the worker's GPU pick and come back as a packed id.
   *
   * The tiers are the same-thread renderer's — **leaf > edge > parent**
   * (round 97.1) — and they have to resolve here rather than in the
   * worker, because the worker only has the mirrored view while the node
   * columns are canonical on this thread: a leaf answers outright, a
   * parent is held while the worker's edge pick runs, and only an *edge*
   * id from the worker outranks it.
   *
   * @param x — rendered (CSS px) x
   * @param y — rendered (CSS px) y
   * @param pads — hit halos in CSS px (the gesture layer's thresholds)
   * @returns the packed pick id, or null for background
   */
  async pick(
    x: number,
    y: number,
    pads?: { edgePadPx?: number; nodePadPx?: number },
  ): Promise<number | null> {
    if (this.destroyed) {
      return null;
    }

    const nodeHit = this.pickNodeTierSync(x, y, pads?.nodePadPx ?? 0);

    if (nodeHit != null && !nodeHit.isParent) {
      return nodeHit.slot + 1;
    }

    const parentSlot = nodeHit?.slot ?? null;
    const epoch = this.cy._store.compactEpoch;
    const id = this.nextRequestId++;

    const answer = await new Promise<number | null>((resolve) => {
      this.pendingPicks.set(id, resolve);
      this.post({
        kind: 'pick',
        id,
        x,
        y,
        edgePadPx: pads?.edgePadPx ?? 0,
        nodePadPx: 0, // nodes already answered above
      });
    });

    if (answer != null && (answer & EDGE_PICK_BIT) !== 0) {
      return answer;
    }

    if (parentSlot == null || this.destroyed) {
      return null;
    }

    // slots move under compaction (19.4) — the held slot survives the
    // await only while the epoch does
    if (this.cy._store.compactEpoch !== epoch) {
      return this.pickNodeTierSync(x, y, pads?.nodePadPx ?? 0)?.slot ?? null;
    }

    return parentSlot + 1;
  }

  /**
   * Synchronous CPU node pick over the canonical columns — the same
   * math as the same-thread renderer's, never mirror-stale.
   *
   * @param x — rendered (CSS px) x
   * @param y — rendered (CSS px) y
   * @param padPx — hit halo in CSS px
   * @returns the node's slot, or null
   */
  pickNodeSync(x: number, y: number, padPx: number = 0): number | null {
    return this.pickNodeTierSync(x, y, padPx)?.slot ?? null;
  }

  /** the same scan, carrying the draw tier the hit came from (97.1) */
  private pickNodeTierSync(
    x: number,
    y: number,
    padPx: number = 0,
  ): NodePickTier | null {
    if (this.destroyed) {
      return null;
    }

    const cy = this.cy;
    const viewport = cy._viewport;
    const pan = viewport.pan();

    cy._store.flushDerived();

    return pickNodeTierAt(
      cy._store,
      {
        panXPx: pan.x * this.dpr,
        panYPx: pan.y * this.dpr,
        zoomDpr: viewport.zoom() * this.dpr,
        hidePx: this.opts.hidePx ?? DEFAULT_HIDE_PX,
        nodeLodPx: this.opts.nodeLodPx ?? DEFAULT_NODE_LOD_PX,
        padPx: padPx * this.dpr,
      },
      x * this.dpr,
      y * this.dpr,
    );
  }

  /**
   * Export an image: the view resolves here (container CSS size, model
   * bounds, viewport), the worker validates it against the device,
   * renders and transfers the pixels back.
   *
   * @param opts — the public export options
   * @returns straight-alpha RGBA pixels
   */
  async exportImage(opts: ExportOptions = {}): Promise<ExportedImage> {
    await this.ready;

    if (this.destroyed) {
      throw new Error('Cannot export an image: the renderer is destroyed');
    }

    this.cy._store.flushDerived();

    const view = resolveExportView(
      opts,
      this.container.clientWidth,
      this.container.clientHeight,
      () => this.cy._store.boundingBox(),
      this.cy._viewport,
    );
    const id = this.nextRequestId++;

    return new Promise<ExportedImage>((resolve, reject) => {
      this.pendingExports.set(id, { resolve, reject });
      this.post({ kind: 'export', id, view });
    });
  }

  /**
   * Tear the proxy down: unsubscribe, reject pending work, tell the
   * worker to destroy its engine, terminate it, and remove the canvas.
   * Idempotent, like the renderer it stands in for.
   */
  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.offInvalidate();
    this.cy.off('viewport', this.onViewport);
    this.cy._animations.detachDriver();

    for (const resolve of this.pendingPicks.values()) {
      resolve(null);
    }

    this.pendingPicks.clear();

    for (const { reject } of this.pendingExports.values()) {
      reject(
        new Error(
          'The renderer was destroyed before the image export completed',
        ),
      );
    }

    this.pendingExports.clear();
    this.worker.postMessage({ kind: 'destroy' } satisfies MainMessage);
    this.worker.terminate();
    this.canvas.remove();
  }

  private post(msg: MainMessage, transfer?: Transferable[]): void {
    if (!this.destroyed) {
      this.worker.postMessage(msg, transfer ?? []);
    }
  }

  private makeBatch(full: boolean): StoreBatch {
    const cy = this.cy;
    const pan = cy._viewport.pan();
    const batch = buildBatch(
      cy._store,
      {
        ends: cy._styleEngine.arrowEnds,
        mid: cy._styleEngine.midArrowEnds,
      },
      { panX: pan.x, panY: pan.y, zoom: cy._viewport.zoom() },
      this.batchState,
      full,
    );

    // pass-1 deferral, loud once: background images do not decode in
    // the worker, so their draw passes are gated off by a zero count
    if (batch.counts.images > 0) {
      batch.counts.images = 0;

      if (!this.imagesWarned) {
        this.imagesWarned = true;
        cy.emit({ type: 'error' }, [
          'renderer.worker does not support background images yet; ' +
            'they are not drawn (round 86.3 pass 1)',
        ]);
      }
    }

    return batch;
  }

  private scheduleBatch(): void {
    // the store's invalidation callback already coalesces to one call
    // per microtask burst; drain on a microtask so a burst of mutations
    // posts one batch
    if (this.batchScheduled || this.destroyed) {
      return;
    }

    this.batchScheduled = true;

    queueMicrotask(() => {
      this.batchScheduled = false;

      if (this.destroyed || !this.cy._store.hasDirty()) {
        return;
      }

      const batch = this.makeBatch(false);

      this.post({ kind: 'batch', batch }, collectTransfers(batch));
    });
  }

  private onMessage(
    msg: WorkerMessage,
    readyResolve: () => void,
    readyReject: (err: Error) => void,
  ): void {
    switch (msg.kind) {
      case 'ready': {
        readyResolve();
        break;
      }

      case 'initerror': {
        readyReject(new Error(msg.message));
        break;
      }

      case 'frame': {
        this.lastStats = msg.stats;
        this.cy.emit('render');
        break;
      }

      case 'pickresult': {
        const resolve = this.pendingPicks.get(msg.id);

        this.pendingPicks.delete(msg.id);
        resolve?.(msg.hit);
        break;
      }

      case 'exportresult': {
        const job = this.pendingExports.get(msg.id);

        this.pendingExports.delete(msg.id);

        if (job == null) {
          break;
        }

        if (msg.ok && msg.data != null) {
          job.resolve({
            data: new Uint8ClampedArray(msg.data),
            width: msg.width,
            height: msg.height,
          });
        } else {
          job.reject(new Error(msg.message ?? 'The image export failed'));
        }
        break;
      }

      case 'labeldims': {
        for (const [stream, slot, w, h] of msg.dims) {
          this.cy._store.setLabelDims(slot, stream, w, h);
        }
        break;
      }

      case 'devicelost': {
        if (this.onDeviceLost != null) {
          this.onDeviceLost(msg.message);
        } else {
          this.cy.emit({ type: 'error' }, [
            `WebGPU device lost: ${msg.message}`,
          ]);
        }
        break;
      }

      case 'error': {
        this.cy.emit({ type: 'error' }, [msg.message]);
        break;
      }
    }
  }
}
