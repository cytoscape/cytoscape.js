// The renderer's deferred pipelines (round 130 split): each builds on
// first use.

import { NodeLayerPipeline } from '../node-layer-pipeline.mjs';
import { CurvedEdgePipeline } from '../curved-edge-pipeline.mjs';
import { CurvedArrowPipeline } from '../curved-arrow-pipeline.mjs';
import { LabelPipeline } from '../label-pipeline.mjs';
import { ImagePipeline } from '../image-pipeline.mjs';
import { ChartPipeline } from '../chart-pipeline.mjs';
import { COL } from '../../contract.mjs';
import type { Renderer } from '../renderer.mjs';

/** The three inputs every deferred pipeline needs, or null before ready. */
export function pipelineInputs(
  rd: Renderer,
): [GPUDevice, GPUTextureFormat, GPUBindGroupLayout] | null {
  const device = rd.device;
  const format = rd.format;
  const kernels = rd.cullKernels;

  if (device == null || format == null || kernels == null) {
    return null;
  }

  return [device, format, kernels.visibleLayout];
}

/** Node background images (15.3), built on the first image draw. */
export function images(rd: Renderer): ImagePipeline | null {
  if (rd.imagePipeline == null) {
    const inputs = pipelineInputs(rd);

    if (inputs == null) {
      return null;
    }

    rd.imagePipeline = new ImagePipeline(...inputs);
  }

  return rd.imagePipeline;
}

/** Pie / donut charts (round 23), built on the first chart draw. */
export function charts(rd: Renderer): ChartPipeline | null {
  if (rd.chartPipeline == null) {
    const inputs = pipelineInputs(rd);

    if (inputs == null) {
      return null;
    }

    rd.chartPipeline = new ChartPipeline(...inputs);
  }

  return rd.chartPipeline;
}

/** Node overlay (13 A2), built on the first overlay draw. */
export function overlays(rd: Renderer): NodeLayerPipeline | null {
  if (rd.overlayPipeline == null) {
    const inputs = pipelineInputs(rd);

    if (inputs == null) {
      return null;
    }

    rd.overlayPipeline = new NodeLayerPipeline(...inputs, COL.NODE_OVERLAY);
  }

  return rd.overlayPipeline;
}

/** Node underlay (13 A2), built on the first underlay draw. */
export function underlays(rd: Renderer): NodeLayerPipeline | null {
  if (rd.underlayPipeline == null) {
    const inputs = pipelineInputs(rd);

    if (inputs == null) {
      return null;
    }

    rd.underlayPipeline = new NodeLayerPipeline(...inputs, COL.NODE_UNDERLAY);
  }

  return rd.underlayPipeline;
}

/** The curved-edge stream, built once the store has ever curved an edge. */
export function curvedEdgesImpl(rd: Renderer): CurvedEdgePipeline | null {
  if (rd.curvedEdgePipeline == null) {
    const inputs = pipelineInputs(rd);

    if (inputs == null) {
      return null;
    }

    rd.curvedEdgePipeline = new CurvedEdgePipeline(...inputs);
  }

  return rd.curvedEdgePipeline;
}

/** Arrows on the curved stream, built alongside the curved edges. */
export function curvedArrowsImpl(rd: Renderer): CurvedArrowPipeline | null {
  if (rd.curvedArrowPipeline == null) {
    const inputs = pipelineInputs(rd);

    if (inputs == null) {
      return null;
    }

    rd.curvedArrowPipeline = new CurvedArrowPipeline(...inputs);
  }

  return rd.curvedArrowPipeline;
}

/** Node labels, built on the first frame with a node glyph to draw. */
export function labelsImpl(rd: Renderer): LabelPipeline | null {
  if (rd.labelPipeline == null) {
    const inputs = pipelineInputs(rd);

    if (inputs == null) {
      return null;
    }

    rd.labelPipeline = new LabelPipeline(...inputs);
  }

  return rd.labelPipeline;
}

/** Edge labels — the mid, source and end streams share this one. */
export function edgeLabelsImpl(rd: Renderer): LabelPipeline | null {
  if (rd.edgeLabelPipeline == null) {
    const inputs = pipelineInputs(rd);

    if (inputs == null) {
      return null;
    }

    rd.edgeLabelPipeline = new LabelPipeline(...inputs, 'edge');
  }

  return rd.edgeLabelPipeline;
}
