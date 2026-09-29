import replace from '@rollup/plugin-replace';
import license from 'rollup-plugin-license';
import path from 'path';

import { constInlinePlugin } from './scripts/const-inline.mjs';
import { wgslMinifyPlugin } from './scripts/wgsl-minify.mjs';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const VERSION = process.env.VERSION || 'snapshot'; // default snapshot
const FILE = process.env.FILE;
const SOURCEMAPS = process.env.SOURCEMAPS === 'true'; // default false
const NODE_ENV =
  process.env.NODE_ENV === 'development' ? 'development' : 'production'; // default prod

const input = './src/index.mjs';

const name = 'cytoscape';

/**
 * The slim entries (round 131): ESM, minified ESM and CJS each — no UMD, a
 * script-tag consumer wants the full build.  `file` is the basename stem
 * under build/.
 */
const SLIM_ENTRIES = [
  { input: './src/headless.mjs', file: 'cytoscape-headless' },
  { input: './src/headless-gpu.mjs', file: 'cytoscape-headless-gpu' },
];

// The sources are TypeScript (.mts); rolldown transpiles them natively via
// oxc. This alias resolves the './foo.mjs' import specifiers in source to
// their foo.mts files.
const resolve = {
  extensionAlias: {
    '.mjs': ['.mts', '.mjs'],
  },
};

// Every source module counts as having side effects **in this build**
// (round 131).  `package.json` declares `sideEffects: false` for the
// consumer's bundler — true of the shipped files, each a single module —
// and rolldown reads that field for our own sources too, where it is not
// true: `style.mts` imports its reader tables for their registration
// alone, and with the field honoured here the three were dropped and
// every style read came back undefined (measured: the runtime smoke went
// red on its first colour readback).  The function form is what overrides
// the package field; `moduleSideEffects: true` does not.
const treeshake = { moduleSideEffects: () => true };

// oxc transpilation target for the shipped bundles
const transform = {
  target: 'es2018',
};

// the non-ESM outputs (UMD/CJS) have no import.meta; define it away so
// the worker spawner's ESM-detection branch (round 86.3,
// worker-renderer.mts) compiles to its documented fallback — the
// document.currentScript path — instead of emitting a build warning
const transformNonEsm = {
  ...transform,
  define: { 'import.meta': '({})' },
};

const envVariables = {
  'process.env.VERSION': JSON.stringify(VERSION),
  'process.env.NODE_ENV': JSON.stringify(NODE_ENV),
};

const replaceOptions = {
  values: envVariables,
  preventAssignment: true,
};

const licenseHeaderOptions = {
  sourcemap: true,
  banner: {
    content: {
      file: path.join(__dirname, 'LICENSE'),
    },
  },
};

/**
 * The source transforms every bundle gets, in order (round 126): the
 * constant vocabularies and the shader constants inlined from the AST
 * (`scripts/const-inline.mjs`, PLAN.md item 63), then the shader
 * literals minified (`scripts/wgsl-minify.mjs`, round 52).  Both run in
 * development builds too, so the Playwright projects exercise what ships.
 *
 * @returns {object[]} fresh plugin instances
 */
const sourcePlugins = () => [constInlinePlugin(), wgslMinifyPlugin()];

// Node resolution and CommonJS interop are handled natively by rolldown.
const configs = [
  {
    input,
    resolve,
    treeshake,
    transform: transformNonEsm,
    output: {
      file: 'build/cytoscape.umd.js',
      format: 'umd',
      name,
      sourcemap: SOURCEMAPS ? 'inline' : false,
    },
    plugins: [
      ...sourcePlugins(),
      replace(replaceOptions),
      license(licenseHeaderOptions),
    ],
  },

  {
    input,
    resolve,
    treeshake,
    transform: transformNonEsm,
    output: {
      file: 'build/cytoscape.min.js',
      format: 'umd',
      name,
      minify: true,
    },
    plugins: [
      ...sourcePlugins(),
      replace(replaceOptions),
      license(licenseHeaderOptions),
    ],
  },

  {
    input,
    resolve,
    treeshake,
    transform,
    output: {
      file: 'build/cytoscape.esm.min.mjs',
      format: 'es',
      minify: true,
    },
    plugins: [
      ...sourcePlugins(),
      replace(replaceOptions),
      license(licenseHeaderOptions),
    ],
  },

  {
    input,
    resolve,
    treeshake,
    transform: transformNonEsm,
    output: { file: 'build/cytoscape.cjs.js', format: 'cjs' },
    plugins: [
      ...sourcePlugins(),
      replace(replaceOptions),
      license(licenseHeaderOptions),
    ],
  },

  {
    input,
    resolve,
    treeshake,
    transform,
    output: { file: 'build/cytoscape.esm.mjs', format: 'es' },
    plugins: [
      ...sourcePlugins(),
      replace(replaceOptions),
      license(licenseHeaderOptions),
    ],
  },
];

for (const entry of SLIM_ENTRIES) {
  const plugins = () => [
    ...sourcePlugins(),
    replace(replaceOptions),
    license(licenseHeaderOptions),
  ];

  configs.push(
    {
      input: entry.input,
      resolve,
      treeshake,
      transform,
      output: { file: `build/${entry.file}.esm.mjs`, format: 'es' },
      plugins: plugins(),
    },
    {
      input: entry.input,
      resolve,
      treeshake,
      transform,
      output: {
        file: `build/${entry.file}.esm.min.mjs`,
        format: 'es',
        minify: true,
      },
      plugins: plugins(),
    },
    {
      input: entry.input,
      resolve,
      treeshake,
      transform: transformNonEsm,
      output: { file: `build/${entry.file}.cjs.js`, format: 'cjs' },
      plugins: plugins(),
    },
  );
}

/**
 * An output's `FILE` key: its basename without the `cytoscape` stem, the
 * separator after it, and the extension — `esm` for `cytoscape.esm.mjs`,
 * `esm.min` for `cytoscape.esm.min.mjs`, `headless.esm` for
 * `cytoscape-headless.esm.mjs`.  Matched exactly (round 131): the old
 * suffix match let `FILE=esm` select every ESM output once slim entries
 * existed, and `FILE=min` the minified ESM beside the minified UMD.
 *
 * @param {string} file — the output path
 * @returns {string} the key
 */
export const fileKey = (file) =>
  path
    .basename(file)
    .replace(/^cytoscape[.-]?/, '')
    .replace(/\.m?js$/, '');

export default FILE
  ? configs.filter((config) => fileKey(config.output.file) === FILE)
  : configs;
