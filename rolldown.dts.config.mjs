// Bundles the per-module declarations emitted from source into a single
// dist .d.ts for the package entry point.  v4 is ESM-first, so the generated
// ESM shape is what ships; `scripts/build-dts.mjs` only adds the UMD global name for
// script-tag consumers.
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
