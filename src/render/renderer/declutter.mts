// The renderer's label declutter (round 104): the per-frame pass over
// the node labels and the gate buffer the glyph cull and the node label
// shader read.  See src/render/label-declutter.mts for the pass itself.

import { BUFFER_USAGE } from '../../gpu/webgpu-constants.mjs';
import { COL, GROUP_NODES, LABEL_DECLUTTER_CULL } from '../../contract.mjs';
import type { StoreDelta } from '../../contract.mjs';
import { DECLUTTER_MARGIN_PX } from '../label-declutter.mjs';
import type { DeclutterView, LabelDeclutter } from '../label-declutter.mjs';
import { DEFAULT_LABEL_FADE_PX, DEFAULT_LABEL_MIN_PX } from '../renderer.mjs';
import type { ExportView, Renderer } from '../renderer.mjs';

/*
The gate is one f32 per node slot in a storage buffer (the pass's
output: 0 culled, else the label's fade scale).  It is always bound —
the glyph cull and the node label shader index it by the glyph's owner
— so it exists from the first frame, sized to the node capacity and
filled with 1: every label drawn on today's fade band, which is what a
graph with no priority and no declutter draws.  Only a pass writes
anything else into it, and only the changed span is uploaded.

When the pass runs.  Its inputs are the viewport, the node label runs,
node positions and flags, and the mode.  Under `none` the gate is the
fade order alone, so it re-runs only on a label or flag change (the
emphasized set fades last); under `cull` it re-runs on any of them —
every drawn frame of a gesture, which the round's measurement allows
(1.66 ms at 19,607 labels) and which the model-anchored grid makes
stable: a pan re-decides nothing.  Positions a GPU lease owns (a
position tween or a presenting force run) are stale on the CPU until
the lease returns them, so the pass holds its previous decision
through the run and re-decides on the frame the columns land.
*/

/** The gate buffer as bound: its buffer, and a version that bumps on a
 * reallocation so cached bind groups rebuild. */
export interface LabelGateBuffer {
  buffer: GPUBuffer;
  /** node slots the buffer holds */
  cap: number;
  version: number;
}

/** the columns whose change re-runs a `cull` pass */
const DECLUTTER_COLUMNS: ReadonlySet<string> = new Set([
  COL.NODE_POSITION,
  COL.NODE_FLAGS,
]);

/**
 * Note what a frame's delta means for the pass: node positions or flags
 * changed, or the node table grew.
 *
 * @param rd — the renderer
 * @param delta — the delta the frame just synced
 */
export function noteDeclutterDelta(rd: Renderer, delta: StoreDelta): void {
  for (const span of delta.spans) {
    if (DECLUTTER_COLUMNS.has(span.column)) {
      rd.declutterInputsDirty = true;

      if (span.column === COL.NODE_FLAGS) {
        rd.declutterFlagsDirty = true;
      }
    }
  }

  if (delta.resized.nodes) {
    rd.declutterInputsDirty = true;
    rd.declutterFlagsDirty = true;
  }
}

/**
 * The gate buffer, (re)allocated to the node capacity with the pass's
 * current gate, and any changed span uploaded.
 *
 * @param rd — the renderer (device ready)
 * @returns the buffer to bind
 */
export function labelGate(rd: Renderer): LabelGateBuffer {
  const device = rd.device as GPUDevice;
  const declutter = rd.labelLayer?.declutter ?? null;
  const cap = Math.max(1, rd.store.capacity(GROUP_NODES));
  let gate = rd.labelGate;

  declutter?.ensure(cap);

  if (gate == null || gate.cap < cap) {
    gate?.buffer.destroy();

    const next = Math.max(cap, (gate?.cap ?? 0) * 2);
    const buffer = device.createBuffer({
      label: 'cy-gpu:label-gate',
      size: next * 4,
      usage: BUFFER_USAGE.STORAGE | BUFFER_USAGE.COPY_DST,
      mappedAtCreation: true,
    });
    const init = new Float32Array(buffer.getMappedRange());

    init.fill(1);

    if (declutter != null) {
      init.set(
        declutter.gate.subarray(0, Math.min(next, declutter.capacity())),
      );
      declutter.takeGateSpan(); // the whole gate just landed
    }

    buffer.unmap();
    gate = { buffer, cap: next, version: (gate?.version ?? 0) + 1 };
    rd.labelGate = gate;

    return gate;
  }

  const span = declutter?.takeGateSpan() ?? null;

  if (declutter != null && span != null) {
    const hi = Math.min(span.hi, gate.cap - 1);

    if (hi >= span.lo) {
      device.queue.writeBuffer(
        gate.buffer,
        span.lo * 4,
        declutter.gate.buffer,
        declutter.gate.byteOffset + span.lo * 4,
        (hi - span.lo + 1) * 4,
      );
    }
  }

  return gate;
}

/** The label LOD terms, displayed px (as the frame's, before the
 * render scale folds in). */
function lodTerms(rd: Renderer): { fadePx: number; minPx: number } {
  return {
    fadePx: rd.opts.labelFadePx ?? DEFAULT_LABEL_FADE_PX,
    minPx: rd.opts.labelMinPx ?? DEFAULT_LABEL_MIN_PX,
  };
}

/**
 * The on-screen view the pass decides: the viewport grown by the
 * margin, in model px, with the LOD judged at the displayed zoom.
 *
 * @param rd — the renderer
 * @returns the pass's view
 */
export function screenView(rd: Renderer): DeclutterView {
  const viewport = rd.host.viewport;
  const zoom = viewport.zoom();
  const pan = viewport.pan();
  const cssW = rd.canvas.width / rd.dpr;
  const cssH = rd.canvas.height / rd.dpr;
  const m = DECLUTTER_MARGIN_PX / zoom;

  return {
    zoom,
    zoomDpr: zoom * rd.dpr,
    x1: -pan.x / zoom - m,
    y1: -pan.y / zoom - m,
    x2: (cssW - pan.x) / zoom + m,
    y2: (cssH - pan.y) / zoom + m,
    ...lodTerms(rd),
  };
}

/**
 * Run the pass when its inputs changed (see the header), before the
 * frame's culls read the gate.
 *
 * @param rd — the renderer (device ready)
 */
export function updateDeclutter(rd: Renderer): void {
  const layer = rd.labelLayer;

  if (layer == null) {
    return;
  }

  const declutter = layer.declutter;
  const mode = rd.store.labelDeclutter();
  const labels = layer.takeNodeLabelsTouched();
  const changed = labels || mode !== rd.declutterMode;
  // under `cull` any input re-decides; under `none` only the flags do
  // (the emphasized set's fade), never a position
  let run =
    changed ||
    (mode === LABEL_DECLUTTER_CULL
      ? rd.declutterInputsDirty
      : rd.declutterFlagsDirty);

  rd.declutterInputsDirty = false;
  rd.declutterFlagsDirty = false;

  if (mode === LABEL_DECLUTTER_CULL) {
    const view = screenView(rd);
    const key = `${view.zoom}|${view.x1}|${view.y1}|${view.x2}|${view.y2}|${view.zoomDpr}`;

    if (key !== rd.declutterViewKey) {
      rd.declutterViewKey = key;
      run = true;
    }

    if (run && declutter.count() > 0) {
      runPass(rd, declutter, mode, view);
    }
  } else {
    rd.declutterViewKey = '';

    if (run && declutter.count() > 0) {
      runPass(rd, declutter, mode, screenView(rd));
    }
  }

  rd.declutterMode = mode;
}

function runPass(
  rd: Renderer,
  declutter: LabelDeclutter,
  mode: number,
  view: DeclutterView,
): void {
  declutter.ensure(Math.max(1, rd.store.capacity(GROUP_NODES)));
  declutter.run(
    mode,
    view,
    rd.store.column(COL.NODE_POSITION) as Float32Array,
    rd.store.column(COL.NODE_FLAGS) as Uint32Array,
  );
}

/**
 * An export declutters its own view (round 104): the figure's region
 * at the figure's LOD scale, on the screen's grid (the model cell size
 * the on-screen zoom gives) and seeded with the screen's winners — so a
 * png() of the viewport shows the labels the screen shows, and a full
 * export extends that decision to the rest of the graph.  The screen's
 * own state is untouched.  Writes the figure's gate into the bound
 * buffer and returns the call that puts the screen's back, queued
 * after the export's submit (queue order keeps the two apart).
 *
 * @param rd — the renderer (device ready)
 * @param view — the export's resolved view
 * @returns the restore, or null when the screen's gate serves as is
 */
export function applyExportGate(
  rd: Renderer,
  view: ExportView,
): (() => void) | null {
  const layer = rd.labelLayer;

  if (
    layer == null ||
    rd.store.labelDeclutter() !== LABEL_DECLUTTER_CULL ||
    layer.declutter.count() === 0
  ) {
    return null; // under `none` the gate is view-independent
  }

  const device = rd.device as GPUDevice;
  const gate = labelGate(rd);
  const figure = layer.declutter.runDetached(
    LABEL_DECLUTTER_CULL,
    {
      zoom: rd.host.viewport.zoom(),
      zoomDpr: view.zoom,
      x1: -view.panX / view.zoom,
      y1: -view.panY / view.zoom,
      x2: (view.wPx - view.panX) / view.zoom,
      y2: (view.hPx - view.panY) / view.zoom,
      ...lodTerms(rd),
    },
    rd.store.column(COL.NODE_POSITION) as Float32Array,
    rd.store.column(COL.NODE_FLAGS) as Uint32Array,
  );
  const n = Math.min(gate.cap, figure.length);

  device.queue.writeBuffer(gate.buffer, 0, figure.buffer, 0, n * 4);

  return () => {
    const screen = layer.declutter.gate;

    device.queue.writeBuffer(
      gate.buffer,
      0,
      screen.buffer,
      screen.byteOffset,
      Math.min(gate.cap, screen.length) * 4,
    );
  };
}
