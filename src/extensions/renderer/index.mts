import nullRenderer from './null/index.mjs';
import baseRenderer from './base/index.mjs';
import canvasRenderer from './canvas/index.mjs';

/** A built-in renderer entry: a name and its constructor-function impl. */
export interface RendererExtensionEntry {
  name: string;
  impl: unknown;
}

const renderers: RendererExtensionEntry[] = [
  { name: 'null', impl: nullRenderer },
  { name: 'base', impl: baseRenderer },
  { name: 'canvas', impl: canvasRenderer },
];

export default renderers;
