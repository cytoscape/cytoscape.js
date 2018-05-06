import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import replace from 'rollup-plugin-replace';
import uglify from 'rollup-plugin-uglify';
import { sizeSnapshot } from 'rollup-plugin-size-snapshot';

const FILE = process.env.FILE;
const SOURCEMAPS = process.env.SOURCEMAPS === 'true'; // default false
const BABEL = process.env.BABEL !== 'false'; // default true

const input = './src/index.js';

const name = 'cytoscape';

const envVariables = {
  'process.env.VERSION': JSON.stringify(process.env.VERSION || 'snapshot')
}

const getBabelOptions = () => ({
  exclude: '**/node_modules/**',
  // inject in the bundle babel helpers
  plugins: ['external-helpers']
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
      replace(Object.assign({}, envVariables, {
        'process.env.NODE_ENV': JSON.stringify('development')
      })),
      !FILE ? sizeSnapshot() : {}
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
      replace(Object.assign({}, envVariables, {
        'process.env.NODE_ENV': JSON.stringify('production')
      })),
      !FILE ? sizeSnapshot() : {},
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
      !FILE ? sizeSnapshot() : {}
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
      !FILE ? sizeSnapshot() : {}
    ]
  }
];

export default FILE
  ? configs.filter(config => config.output.file.includes(FILE))
  : configs;
