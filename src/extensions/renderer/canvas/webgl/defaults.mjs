import { defaults } from '../../../../util/index.mjs';

export const RENDER_TARGET = {
  SCREEN:  { name: 'screen',  screen:  true },
  PICKING: { name: 'picking', picking: true },
};


export const atlasCollectionDefaults = defaults({
  texRows: 24,
});


export const renderDefaults = defaults({
  collection: 'default',
  getKey: null, // since render types (eg node-body, node-overlay) can share an atlas collection, its importeant their style keys don't collide
  drawElement: null,
  getBoundingBox: null,
  getRotation: null,
  getRotationPoint: null,
  getRotationOffset: null,
  isVisible: () => true,  // this is an extra check for visibility in addition to ele.visible()
  getPadding: 0,
});