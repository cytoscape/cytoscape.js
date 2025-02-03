import { defaults } from '../../../../util';

export const RENDER_TARGET = {
  SCREEN:  { name: 'screen',  screen:  true },
  PICKING: { name: 'picking', picking: true },
};

export const renderDefaults = defaults({
  getKey: null,
  drawElement: null,
  getBoundingBox: null,
  getRotation: null,
  getRotationPoint: null,
  getRotationOffset: null,
  isVisible: () => true,  // this is an extra check for visibility in addition to ele.visible()
  getPadding: null,
  texRows: 24
});