import layout from './layout/index.mjs';
import renderer from './renderer/index.mjs';

/** A group of built-in extensions of one type, consumed by src/extension.mts. */
export interface ExtensionGroup {
  type: string;
  extensions: { name: string; impl: unknown }[];
}

const groups: ExtensionGroup[] = [
  {
    type: 'layout',
    extensions: layout
  },

  {
    type: 'renderer',
    extensions: renderer
  }
];

export default groups;
