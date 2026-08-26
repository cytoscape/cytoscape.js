import replace from '@rollup/plugin-replace';
import license from 'rollup-plugin-license';
import path from 'path';

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

// The sources are TypeScript (.mts); rolldown transpiles them natively via
// oxc. This alias resolves the './foo.mjs' import specifiers in source to
// their foo.mts files.
const resolve = {
  extensionAlias: {
    '.mjs': ['.mts', '.mjs'],
  },
};

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

// Node resolution and CommonJS interop are handled natively by rolldown.
const configs = [
  {
    input,
    resolve,
    transform: transformNonEsm,
    output: {
      file: 'build/cytoscape.umd.js',
      format: 'umd',
      name,
      sourcemap: SOURCEMAPS ? 'inline' : false,
    },
    plugins: [
      wgslMinifyPlugin(),
      replace(replaceOptions),
      license(licenseHeaderOptions),
    ],
  },

  {
    input,
    resolve,
    transform: transformNonEsm,
    output: {
      file: 'build/cytoscape.min.js',
      format: 'umd',
      name,
      minify: true,
    },
    plugins: [
      wgslMinifyPlugin(),
      replace(replaceOptions),
      license(licenseHeaderOptions),
    ],
  },

  {
    input,
    resolve,
    transform,
    output: {
      file: 'build/cytoscape.esm.min.mjs',
      format: 'es',
      minify: true,
    },
    plugins: [
      wgslMinifyPlugin(),
      replace(replaceOptions),
      license(licenseHeaderOptions),
    ],
  },

  {
    input,
    resolve,
    transform: transformNonEsm,
    output: { file: 'build/cytoscape.cjs.js', format: 'cjs' },
    plugins: [
      wgslMinifyPlugin(),
      replace(replaceOptions),
      license(licenseHeaderOptions),
    ],
  },

  {
    input,
    resolve,
    transform,
    output: { file: 'build/cytoscape.esm.mjs', format: 'es' },
    plugins: [
      wgslMinifyPlugin(),
      replace(replaceOptions),
      license(licenseHeaderOptions),
    ],
  },
];

export default FILE
  ? configs.filter(
      (config) =>
        config.output.file.endsWith(FILE + '.js') ||
        config.output.file.endsWith(FILE + '.mjs'),
    )
  : configs;
