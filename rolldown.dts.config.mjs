// Bundles the per-module declarations emitted from source into one .d.ts
// per package entry point.  v4 is ESM-first, so the generated ESM shape is
// what ships; `scripts/build-dts.mjs` finalizes each into `dist/` and adds
// the UMD global name to the full entry's only.
//
// Round 131: three entries, so three configs of **one input each**.  One
// config with three inputs would emit shared `.d.ts` chunks that the three
// declarations import from (rolldown-plugin-dts's documented behaviour),
// and a shipped declaration must stand alone.  Each names its entry, so
// `build/dts/<entry>.d.ts` is fixed whatever the source file is called.
import { dts } from 'rolldown-plugin-dts';

const resolve = {
  extensionAlias: {
    '.mjs': ['.mts', '.mjs'],
  },
};

/** The declaration entries: source → the name under build/dts/. */
export const DTS_ENTRIES = [
  { input: './src/index.mts', name: 'index' },
  { input: './src/headless.mts', name: 'headless' },
  { input: './src/headless-gpu.mts', name: 'headless-gpu' },
];

export default DTS_ENTRIES.map(({ input, name }) => ({
  // the named-input form fixes the entry's name, and the plugin names the
  // declaration after it: `build/dts/<name>.d.ts`
  input: { [name]: input },
  resolve,
  plugins: [
    dts({
      // type-check happens in `npm run typecheck`; here we just roll up
      emitDtsOnly: true,
      tsconfig: './tsconfig.dts.json',
    }),
  ],
  output: {
    dir: 'build/dts',
    format: 'es',
  },
}));
