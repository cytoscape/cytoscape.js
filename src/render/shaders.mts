/*
All WGSL for the GPU prototype, as template-literal strings.

Pure vertex pulling: no vertex buffers; instance data is read from
read-only storage buffers indexed by @builtin(instance_index).  Dead or
hidden instances (and conservatively off-viewport ones) collapse to a
degenerate quad.  The SDF bodies are ported from the canvas renderer's
WebGL shaders (src/extensions/renderer/canvas/webgl/shader-sdf.mts).

Colour columns are RGBA bytes bound as array<u32> and expanded with
unpack4x8unorm — byte-identical to the CPU columns, zero conversion.
*/
export {
  FRAME_STRUCT,
  COMMON,
  GLYPH_STRUCT,
  BOUNDARY_WGSL,
  DASH_WGSL,
} from './shaders/common.mjs';
export { CURVE_WGSL, ROUTE_WGSL } from './shaders/curve.mjs';
export { NODE_SHADER, NODE_LAYER_SHADER } from './shaders/node.mjs';
export { EDGE_SHADER, CURVED_EDGE_SHADER } from './shaders/edge.mjs';
export { ARROW_SHADER, CURVED_ARROW_SHADER } from './shaders/arrow.mjs';
export { LABEL_SHADER, EDGE_LABEL_SHADER } from './shaders/label.mjs';
export { IMAGE_SHADER } from './shaders/image.mjs';
export { CHART_SHADER } from './shaders/chart.mjs';
