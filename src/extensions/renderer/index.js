import nullRenderer from './null';
import baseRenderer from './base';
import canvasRenderer from './canvas';
import gpuRenderer from './gpu';

export default [
  { name: 'null', impl: nullRenderer },
  { name: 'base', impl: baseRenderer },
  { name: 'canvas', impl: canvasRenderer },
  { name: 'gpu', impl: gpuRenderer },
];
