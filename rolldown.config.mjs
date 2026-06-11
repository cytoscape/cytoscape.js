import babel from '@rollup/plugin-babel';
import replace from '@rollup/plugin-replace';
import license from 'rollup-plugin-license';
import path from 'path';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const VERSION = process.env.VERSION || 'snapshot'; // default snapshot
const FILE = process.env.FILE;
const SOURCEMAPS = process.env.SOURCEMAPS === 'true'; // default false
const BABEL = process.env.BABEL !== 'false'; // default true
const NODE_ENV = process.env.NODE_ENV === 'development' ? 'development' : 'production'; // default prod

const input = './src/index.mjs';

const name = 'cytoscape';

// During the TypeScript migration, import specifiers keep their original
// '.mjs' extension while files are renamed to '.mts' one at a time. This
// alias makes rolldown try foo.mts first when resolving './foo.mjs'.
const resolve = {
  extensionAlias: {
    '.mjs': ['.mts', '.mjs']
  }
};

const envVariables = {
  'process.env.VERSION': JSON.stringify(VERSION),
  'process.env.NODE_ENV': JSON.stringify(NODE_ENV)
};

const replaceOptions = {
  values: envVariables,
  preventAssignment: true
};

const getBabelOptions = () => ({
  exclude: '**/node_modules/**',
  babelHelpers: 'bundled'
});

const licenseHeaderOptions = {
  sourcemap: true,
  banner: {
    content: {
      file: path.join(__dirname, 'LICENSE')
    }
  }
};

// Node resolution and CommonJS interop are handled natively by rolldown,
// so @rollup/plugin-node-resolve and @rollup/plugin-commonjs are no longer needed.
const configs = [
  {
    input,
    resolve,
    output: {
      file: 'build/cytoscape.umd.js',
      format: 'umd',
      name,
      sourcemap: SOURCEMAPS ? 'inline' : false
    },
    plugins: [
      BABEL ? babel(getBabelOptions()) : {},
      replace(replaceOptions),
      license(licenseHeaderOptions)
    ]
  },

  {
    input,
    resolve,
    output: {
      file: 'build/cytoscape.min.js',
      format: 'umd',
      name,
      minify: true
    },
    plugins: [
      BABEL ? babel(getBabelOptions()) : {},
      replace(replaceOptions),
      license(licenseHeaderOptions)
    ]
  },

  {
    input,
    resolve,
    output: {
      file: 'build/cytoscape.esm.min.mjs',
      format: 'es',
      minify: true
    },
    plugins: [
      BABEL ? babel(getBabelOptions()) : {},
      replace(replaceOptions),
      license(licenseHeaderOptions)
    ]
  },

  {
    input,
    resolve,
    output: { file: 'build/cytoscape.cjs.js', format: 'cjs' },
    plugins: [
      BABEL ? babel(getBabelOptions()) : {},
      replace(replaceOptions),
      license(licenseHeaderOptions)
    ]
  },

  {
    input,
    resolve,
    output: { file: 'build/cytoscape.esm.mjs', format: 'es' },
    plugins: [
      BABEL ? babel(getBabelOptions()) : {},
      replace(replaceOptions),
      license(licenseHeaderOptions)
    ]
  }
];

export default FILE
  ? configs.filter(config => config.output.file.endsWith(FILE + '.js') || config.output.file.endsWith(FILE + '.mjs'))
  : configs;
