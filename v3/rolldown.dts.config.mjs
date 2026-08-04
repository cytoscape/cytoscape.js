// Bundles the per-module declarations emitted from source into a single
// dist .d.ts, mirroring the old hand-written index.d.ts shape.
import { dts } from 'rolldown-plugin-dts';

const resolve = {
  extensionAlias: {
    '.mjs': ['.mts', '.mjs']
  }
};

export default {
  input: './src/index.mts',
  resolve,
  plugins: [
    dts({
      // type-check happens in `npm run typecheck`; here we just roll up
      emitDtsOnly: true,
      tsconfig: './tsconfig.dts.json'
    })
  ],
  output: {
    dir: 'build/dts',
    format: 'es'
  }
};
