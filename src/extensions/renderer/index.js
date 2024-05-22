import nullRenderer from './null';
import baseRenderer from './base';
import canvasRenderer from './canvas';
import gpuRenderer from './gpu';
import webglRenderer from './webgl';

export default [
  { name: 'null', impl: nullRenderer },
  { name: 'base', impl: baseRenderer },
  { name: 'canvas', impl: canvasRenderer },
  { name: 'gpu', impl: gpuRenderer },
  { name: 'webgl', impl: webglRenderer },
];
