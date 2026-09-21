// The renderer's scene pass (round 130 split): the cull encodes and the
// draw order.

import { ColumnMirror } from '../column-mirror.mjs';
import { CulledGroup } from '../cull.mjs';
import { GLYPH_BYTES } from '../glyph-buffer.mjs';
import type { GlyphBuffer } from '../glyph-buffer.mjs';
import { BUFFER_USAGE } from '../webgpu-constants.mjs';
import { GROUP_EDGES, GROUP_NODES, COL } from '../../contract.mjs';
import type { SceneCullGroups, Renderer } from '../renderer.mjs';
import {
  images,
  charts,
  overlays,
  underlays,
  curvedEdgesImpl,
  curvedArrowsImpl,
  labelsImpl,
  edgeLabelsImpl,
} from './pipelines.mjs';

/**
 * The scene draw sequence against a Frame uniform + culled groups —
 * shared by the on-screen frame and image export.  Z-order: edges under
 * arrows under nodes under labels, slot order within each group (the
 * cull compaction preserves slot order).  The node depth prepass runs
 * first so edge fragments under opaque node interiors are killed by
 * early-z before blending; arrow draws are skipped per end when no
 * style block enables that end.
 */
export function drawScene(
  rd: Renderer,
  pass: GPURenderPassEncoder,
  uniform: GPUBuffer,
  cull: SceneCullGroups,
): void {
  const device = rd.device as GPUDevice;
  const mirror = rd.mirror as ColumnMirror;
  const store = rd.store;
  // the curved stream draws nothing until some edge has curved, so its
  // two pipelines stay uncompiled until then (see "deferred pipelines")
  const curved = store.hasCurvedEdges();
  const curvedEdges = curved ? curvedEdgesImpl(rd) : null;
  const curvedArrows = curved ? curvedArrowsImpl(rd) : null;

  rd.nodePipeline?.drawDepthPrepass(
    pass,
    device,
    uniform,
    mirror,
    store.highWater(GROUP_NODES),
    cull.node,
  );

  // compound parent bodies draw under everything (round 14.9): the
  // permuted stream is already shallow-under-deep, and parents are
  // excluded from the prepass so edges/children still draw over them
  if (store.parentCount() > 0) {
    rd.nodePipeline?.draw(
      pass,
      device,
      uniform,
      mirror,
      store.highWater(GROUP_NODES),
      cull.parent,
    );

    // parent background images ride their bodies' tier (v3's layering)
    if (store.imageCount() > 0 && rd.imageArrays != null) {
      images(rd)?.draw(
        pass,
        device,
        uniform,
        mirror,
        rd.imageArrays,
        store.highWater(GROUP_NODES),
        cull.parent,
      );
    }

    // parent charts over their images (round 23; v3's pie order)
    if (store.chartCount() > 0) {
      charts(rd)?.draw(
        pass,
        device,
        uniform,
        mirror,
        store.highWater(GROUP_NODES),
        cull.parent,
      );
    }
  }

  if (store.edgeUnderlayCount() > 0) {
    rd.edgePipeline?.drawLayer(
      pass,
      device,
      uniform,
      mirror,
      store.highWater(GROUP_EDGES),
      cull.edge,
      COL.EDGE_UNDERLAY,
    );
    curvedEdges?.drawLayer(
      pass,
      device,
      uniform,
      mirror,
      store.highWater(GROUP_EDGES),
      cull.curved,
      COL.EDGE_UNDERLAY,
    );
  }

  // Round 124.4: with any casing on, each stream draws casing-then-
  // line *per edge* (two instances per edge), so a later edge's
  // casing gaps an earlier edge's line where they cross — v3's order;
  // the pre-124 global casing pass haloed against nodes only.
  const cased = store.casingCount() > 0;

  if (cased) {
    rd.edgePipeline?.drawCased(
      pass,
      device,
      uniform,
      mirror,
      store.highWater(GROUP_EDGES),
      cull.edge,
    );
  } else {
    rd.edgePipeline?.draw(
      pass,
      device,
      uniform,
      mirror,
      store.highWater(GROUP_EDGES),
      cull.edge,
    );
  }
  // curved edges draw after straight ones (two streams; within each,
  // slot order — a recorded z-order deviation)
  if (cased) {
    curvedEdges?.drawCased(
      pass,
      device,
      uniform,
      mirror,
      store.highWater(GROUP_EDGES),
      cull.curved,
    );
  } else {
    curvedEdges?.draw(
      pass,
      device,
      uniform,
      mirror,
      store.highWater(GROUP_EDGES),
      cull.curved,
    );
  }
  rd.arrowPipeline?.draw(
    pass,
    device,
    uniform,
    mirror,
    store.highWater(GROUP_EDGES),
    cull.edge,
    rd.host.arrowEnds(),
  );
  curvedArrows?.draw(
    pass,
    device,
    uniform,
    mirror,
    store.highWater(GROUP_EDGES),
    cull.curved,
    rd.host.arrowEnds(),
  );

  if (store.midArrowCount() > 0) {
    // C1: mid arrows on both streams
    rd.arrowPipeline?.drawMid(
      pass,
      device,
      uniform,
      mirror,
      store.highWater(GROUP_EDGES),
      cull.edge,
      rd.host.midArrowEnds(),
    );
    curvedArrows?.drawMid(
      pass,
      device,
      uniform,
      mirror,
      store.highWater(GROUP_EDGES),
      cull.curved,
      rd.host.midArrowEnds(),
    );
  }
  if (store.edgeOverlayCount() > 0) {
    rd.edgePipeline?.drawLayer(
      pass,
      device,
      uniform,
      mirror,
      store.highWater(GROUP_EDGES),
      cull.edge,
      COL.EDGE_OVERLAY,
    );
    curvedEdges?.drawLayer(
      pass,
      device,
      uniform,
      mirror,
      store.highWater(GROUP_EDGES),
      cull.curved,
      COL.EDGE_OVERLAY,
    );
  }

  if (store.ghostCount() > 0 && cull.ghost != null) {
    rd.nodePipeline?.drawGhost(
      pass,
      device,
      uniform,
      mirror,
      store.highWater(GROUP_NODES),
      cull.ghost,
    );
  }

  if (store.underlayCount() > 0 && cull.underlay != null) {
    underlays(rd)?.draw(
      pass,
      device,
      uniform,
      mirror,
      store.highWater(GROUP_NODES),
      cull.underlay,
      true,
    );
  }

  rd.nodePipeline?.draw(
    pass,
    device,
    uniform,
    mirror,
    store.highWater(GROUP_NODES),
    cull.node,
  );

  // leaf background images composite right over their bodies (15.3),
  // under overlays and labels; zero-cost while no node styles one
  if (store.imageCount() > 0 && rd.imageArrays != null) {
    images(rd)?.draw(
      pass,
      device,
      uniform,
      mirror,
      rd.imageArrays,
      store.highWater(GROUP_NODES),
      cull.node,
    );
  }

  // leaf charts over their images (round 23), under overlays/labels
  if (store.chartCount() > 0) {
    charts(rd)?.draw(
      pass,
      device,
      uniform,
      mirror,
      store.highWater(GROUP_NODES),
      cull.node,
    );
  }

  if (store.overlayCount() > 0 && cull.overlay != null) {
    overlays(rd)?.draw(
      pass,
      device,
      uniform,
      mirror,
      store.highWater(GROUP_NODES),
      cull.overlay,
      false,
    );
  }

  // an unlabelled graph rasters no glyph, so neither label pipeline is
  // built until some stream has one (see "deferred pipelines")
  const labels = rd.labelLayer;

  if (labels == null) {
    return;
  }

  const nodeStream = labels.glyphs.highWater > 0;
  const edgeStreams =
    labels.edgeGlyphs.highWater > 0 ||
    labels.sourceGlyphs.highWater > 0 ||
    labels.targetGlyphs.highWater > 0;
  const nodeLabels = nodeStream ? labelsImpl(rd) : null;
  const edgeLabels = edgeStreams ? edgeLabelsImpl(rd) : null;

  // round 95: the outline goes under the ink.  Glyph quads overlap by
  // construction, so a one-pass draw composites glyph N's outline
  // ring over glyph N-1's fill — white notches in every outlined
  // word.  Encode every stream's outline coverage first, then every
  // fill over it (v3 strokes the line, then fills; here the split is
  // global across streams — a recorded deviation where two *distinct*
  // labels overlap).  Streams without an outlined glyph skip the
  // extra pass before any GPU work, so the outline-free path encodes
  // exactly what it did before.
  const drawPhase = (phase: 'fill' | 'outline'): void => {
    if (nodeStream && (phase === 'fill' || labels.glyphs.hasOutline())) {
      nodeLabels?.draw(
        pass,
        device,
        uniform,
        labels.glyphs,
        mirror,
        labels.atlas,
        cull.glyph,
        phase,
      );
    }

    if (!edgeStreams) {
      return;
    }

    // the end-label streams (D4) share the pipeline; their glyphs
    // carry the endParam re-anchor
    const streams = [
      [labels.edgeGlyphs, cull.edgeGlyph],
      [labels.sourceGlyphs, cull.sourceGlyph],
      [labels.targetGlyphs, cull.targetGlyph],
    ] as const;

    for (const [glyphs, culled] of streams) {
      if (phase === 'fill' || glyphs.hasOutline()) {
        edgeLabels?.draw(
          pass,
          device,
          uniform,
          glyphs,
          mirror,
          labels.atlas,
          culled,
          phase,
        );
      }
    }
  };

  drawPhase('outline');
  drawPhase('fill');
}

/**
 * Ensure + encode the cull compaction for a set of groups against a
 * Frame uniform (the scene frame or the pick tile).  The compute pass is
 * always opened when it may be timed — timestamp queries persist, so a
 * skipped pass would leave stale values in the frame timing sum.
 */
export function encodeCulls(
  rd: Renderer,
  encoder: GPUCommandEncoder,
  uniform: GPUBuffer,
  groups: {
    node?: CulledGroup;
    parent?: CulledGroup;
    edge: CulledGroup;
    curved: CulledGroup;
    glyph?: CulledGroup;
    edgeGlyph?: CulledGroup;
    sourceGlyph?: CulledGroup;
    targetGlyph?: CulledGroup;
    ghost?: CulledGroup;
    overlay?: CulledGroup;
    underlay?: CulledGroup;
  },
  timed: boolean,
  now: number = 0,
): void {
  const mirror = rd.mirror as ColumnMirror;
  const store = rd.store;
  const labelLayer = rd.labelLayer;
  const mv = `${mirror.version}`;

  groups.node?.ensure(
    uniform,
    Math.max(1, store.capacity(GROUP_NODES)),
    [
      mirror.buffer(COL.NODE_POSITION),
      mirror.buffer(COL.NODE_SIZE),
      mirror.buffer(COL.NODE_FLAGS),
      mirror.buffer(COL.NODE_BORDER_WIDTH),
      mirror.buffer(COL.NODE_BORDER_GEOM),
    ],
    mv,
  );

  // compound parents (round 14.9): their stream iterates the CPU-built
  // (depth, slot) permutation, uploaded only when the hierarchy changes
  const anyParents = store.parentCount() > 0;
  let parentOrderLen = 0;

  if (anyParents && groups.parent != null) {
    const device = rd.device as GPUDevice;
    const order = store.parentOrder();

    parentOrderLen = order.length;

    if (order !== rd.parentOrderRef) {
      rd.parentOrderRef = order;
      rd.parentOrderVersion++;

      if (
        rd.parentOrderBuf == null ||
        rd.parentOrderBuf.size < order.byteLength
      ) {
        rd.parentOrderBuf?.destroy();
        rd.parentOrderBuf = device.createBuffer({
          label: 'cy-gpu:parent-order',
          size: Math.max(4, order.byteLength),
          usage: BUFFER_USAGE.STORAGE | BUFFER_USAGE.COPY_DST,
        });
      }

      device.queue.writeBuffer(
        rd.parentOrderBuf,
        0,
        order.buffer,
        order.byteOffset,
        order.byteLength,
      );
    }

    groups.parent.ensure(
      uniform,
      Math.max(1, parentOrderLen),
      [
        mirror.buffer(COL.NODE_POSITION),
        mirror.buffer(COL.NODE_SIZE),
        mirror.buffer(COL.NODE_FLAGS),
        mirror.buffer(COL.NODE_BORDER_WIDTH),
        rd.parentOrderBuf as GPUBuffer,
      ],
      `${mv}:po${rd.parentOrderVersion}`,
    );
  }

  // ghosts (round 13 A1): zero-cost until some node styles a ghost
  const anyGhosts = store.ghostCount() > 0;

  if (anyGhosts && groups.ghost != null) {
    groups.ghost.ensure(
      uniform,
      Math.max(1, store.capacity(GROUP_NODES)),
      [
        mirror.buffer(COL.NODE_POSITION),
        mirror.buffer(COL.NODE_SIZE),
        mirror.buffer(COL.NODE_FLAGS),
        mirror.buffer(COL.NODE_GHOST),
        mirror.buffer(COL.NODE_BORDER_WIDTH),
      ],
      mv,
    );
  }

  // overlay/underlay (round 13 A2): same gating, one kind, two groups.
  // Round 57.1c widened the overlay's gate: v3's `:active` is drawn as
  // an overlay, so a pressed element with no *styled* overlay still
  // needs the pass — otherwise the affordance would appear only in
  // graphs that happened to style one.
  const layerInputs = (
    id: typeof COL.NODE_OVERLAY | typeof COL.NODE_UNDERLAY,
  ): GPUBuffer[] => [
    mirror.buffer(COL.NODE_POSITION),
    mirror.buffer(COL.NODE_SIZE),
    mirror.buffer(COL.NODE_FLAGS),
    mirror.buffer(id),
  ];

  if (store.overlayCount() > 0 && groups.overlay != null) {
    groups.overlay.ensure(
      uniform,
      Math.max(1, store.capacity(GROUP_NODES)),
      layerInputs(COL.NODE_OVERLAY),
      mv,
    );
  }

  if (store.underlayCount() > 0 && groups.underlay != null) {
    groups.underlay.ensure(
      uniform,
      Math.max(1, store.capacity(GROUP_NODES)),
      layerInputs(COL.NODE_UNDERLAY),
      mv,
    );
  }
  const edgeCullInputs = [
    mirror.buffer(COL.EDGE_ENDPOINTS),
    mirror.buffer(COL.EDGE_WIDTH),
    mirror.buffer(COL.EDGE_FLAGS),
    mirror.buffer(COL.NODE_POSITION),
    mirror.buffer(COL.NODE_FLAGS),
  ];

  groups.edge.ensure(
    uniform,
    Math.max(1, store.capacity(GROUP_EDGES)),
    edgeCullInputs,
    mv,
  );
  // the curved stream culls over the same inputs; FLAG_CURVED splits them
  groups.curved.ensure(
    uniform,
    Math.max(1, store.capacity(GROUP_EDGES)),
    edgeCullInputs,
    mv,
  );

  if (groups.glyph != null && labelLayer != null) {
    const glyphs = labelLayer.glyphs;

    groups.glyph.ensure(
      uniform,
      Math.max(1, glyphs.buffer().size / GLYPH_BYTES),
      [
        glyphs.buffer(),
        mirror.buffer(COL.NODE_POSITION),
        mirror.buffer(COL.NODE_FLAGS),
      ],
      `${mv}:${glyphs.version}`,
    );
  }

  const edgeGlyphStreams: [CulledGroup | undefined, GlyphBuffer][] =
    labelLayer == null
      ? []
      : [
          [groups.edgeGlyph, labelLayer.edgeGlyphs],
          [groups.sourceGlyph, labelLayer.sourceGlyphs], // end labels (D4)
          [groups.targetGlyph, labelLayer.targetGlyphs],
        ];

  for (const [cullGroup, glyphs] of edgeGlyphStreams) {
    if (cullGroup == null) {
      continue;
    }

    cullGroup.ensure(
      uniform,
      Math.max(1, glyphs.buffer().size / GLYPH_BYTES),
      [
        glyphs.buffer(),
        mirror.buffer(COL.EDGE_ENDPOINTS),
        mirror.buffer(COL.NODE_POSITION),
        mirror.buffer(COL.EDGE_FLAGS),
        mirror.buffer(COL.NODE_FLAGS),
      ],
      `${mv}:${glyphs.version}`,
    );
  }

  const pass = encoder.beginComputePass({
    label: 'cy-gpu:cull-pass',
    ...(timed && rd.gpuTimer != null
      ? { timestampWrites: rd.gpuTimer.computeTimestampWrites() }
      : {}),
  });

  // mapper eval first (scene invocation only): paint channels must be
  // evaluated before the render pass reads them; pick frames skip it
  // (paint never affects pick coverage).  Paint tweens dispatch straight
  // after, in the same pass — dispatches within a pass see each other's
  // writes, so an animation's slots outrank a mapper writing the same
  // channel for as long as it holds the lease
  if (timed) {
    rd.mapperRuntime?.encode(pass);
    rd.tweenRuntime?.encode(pass, now, 'paint');
  }

  groups.node?.encode(pass, store.highWater(GROUP_NODES));

  if (anyParents && groups.parent != null) {
    groups.parent.encode(pass, parentOrderLen);
  }

  groups.edge.encode(pass, store.highWater(GROUP_EDGES));
  groups.curved.encode(pass, store.highWater(GROUP_EDGES));

  if (anyGhosts && groups.ghost != null) {
    groups.ghost.encode(pass, store.highWater(GROUP_NODES));
  }

  if (store.overlayCount() > 0 && groups.overlay != null) {
    groups.overlay.encode(pass, store.highWater(GROUP_NODES));
  }

  if (store.underlayCount() > 0 && groups.underlay != null) {
    groups.underlay.encode(pass, store.highWater(GROUP_NODES));
  }

  if (groups.glyph != null && labelLayer != null) {
    groups.glyph.encode(pass, labelLayer.glyphs.highWater);
  }

  if (groups.edgeGlyph != null && labelLayer != null) {
    groups.edgeGlyph.encode(pass, labelLayer.edgeGlyphs.highWater);
  }

  if (labelLayer != null) {
    groups.sourceGlyph?.encode(pass, labelLayer.sourceGlyphs.highWater);
    groups.targetGlyph?.encode(pass, labelLayer.targetGlyphs.highWater);
  }

  pass.end();
}
