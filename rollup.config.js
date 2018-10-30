import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import replace from 'rollup-plugin-replace';
import { uglify } from 'rollup-plugin-uglify';
import { sizeSnapshot } from 'rollup-plugin-size-snapshot';

const VERSION = process.env.VERSION || 'snapshot'; // default snapshot
const FILE = process.env.FILE;
const SOURCEMAPS = process.env.SOURCEMAPS === 'true'; // default false
const BABEL = process.env.BABEL !== 'false'; // default true
const NODE_ENV = process.env.NODE_ENV === 'development' ? 'development' : 'production'; // default prod
const matchSnapshot = process.env.SNAPSHOT === 'match';

const input = './src/index.js';

const name = 'cytoscape';

const envVariables = {
  'process.env.VERSION': JSON.stringify(VERSION),
  'process.env.NODE_ENV': JSON.stringify(NODE_ENV)
};

const getBabelOptions = () => ({
  exclude: '**/node_modules/**',
  externalHelpers: true
});

// Ignore all node_modules dependencies
const isExternal = id => !id.startsWith('\0') && !id.startsWith('.') && !id.startsWith('/');

const configs = [
  {
    input,
    output: {
      file: 'build/cytoscape.umd.js',
      format: 'umd',
      name,
      sourcemap: SOURCEMAPS ? 'inline' : false
    },
    plugins: [
      nodeResolve(),
      commonjs({ include: '**/node_modules/**' }),
      BABEL ? babel(getBabelOptions()) : {},
      replace(envVariables),
      !FILE ? sizeSnapshot({ matchSnapshot }) : {}
    ]
  },

  {
    input,
    output: {
      file: 'build/cytoscape.min.js',
      format: 'umd',
      name
    },
    plugins: [
      nodeResolve(),
      commonjs({ include: '**/node_modules/**' }),
      BABEL ? babel(getBabelOptions()) : {},
      replace(envVariables),
      uglify({
        compress: {
          warnings: false,
          drop_console: false
        }
      })
    ]
  },

  {
    input,
    output: { file: 'build/cytoscape.cjs.js', format: 'cjs' },
    external: isExternal,
    plugins: [
      nodeResolve(),
      BABEL ? babel(getBabelOptions()) : {},
      replace(envVariables),
      !FILE ? sizeSnapshot({ matchSnapshot }) : {}
    ]
  },

  {
    input,
    output: { file: 'build/cytoscape.esm.js', format: 'es' },
    external: isExternal,
    plugins: [
      nodeResolve(),
      BABEL ? babel(getBabelOptions()) : {},
      replace(envVariables),
      !FILE ? sizeSnapshot({ matchSnapshot }) : {}
    ]
  }
];

export default FILE
  ? configs.filter(config => config.output.file.includes(FILE))
  : configs;
