import type {
  Css,
  StyleJsonBlock,
  StylesheetJsonBlock,
} from '../../build/dts/index.js';

const styleBlock: StyleJsonBlock = {
  selector: 'node',
  style: { shape: 'ellipse' }
};

const cssBlock: StylesheetJsonBlock = {
  selector: 'edge',
  css: { 'curve-style': 'bezier' }
};

const bothBlock: StyleJsonBlock = {
  selector: 'core',
  style: {} as Css.Core,
  css: {} as Css.Core
};

// @ts-expect-error a stylesheet block must provide either style or css
const missingStyle: StyleJsonBlock = { selector: 'node' };

// @ts-expect-error the public compatibility alias has the same requirement
const missingStylesheet: StylesheetJsonBlock = { selector: 'edge' };

void [styleBlock, cssBlock, bothBlock, missingStyle, missingStylesheet];
