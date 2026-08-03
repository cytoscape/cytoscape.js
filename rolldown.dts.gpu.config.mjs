// Bundles the per-module declarations emitted from the v4 GPU prototype source
// into a single dist .d.ts for the `cytoscape/gpu` entry point, mirroring what
// rolldown.dts.config.mjs does for the v3 entry.  The gpu entry is ESM-only
// (the package's "./gpu" export has no `require` condition), so the generated
// declaration needs no export-assignment reshaping — `build-dts.mjs` only adds
// the UMD global name for script-tag consumers.
import { dts } from 'rolldown-plugin-dts';

const resolve = {
  extensionAlias: {
    '.mjs': ['.mts', '.mjs']
  }
};

export default {
  input: './src/gpu/index.mts',
  resolve,
  plugins: [
    dts({
      // type-check happens in `npm run typecheck`; here we just roll up
      emitDtsOnly: true,
      tsconfig: './tsconfig.dts.json'
    })
  ],
  output: {
    dir: 'build/dts-gpu',
    format: 'es'
  }
};
