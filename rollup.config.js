import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import replace from 'rollup-plugin-replace';
import uglify from 'rollup-plugin-uglify';
import pkg from './package.json';

const FILE = process.env.FILE;
const SOURCEMAPS = process.env.SOURCEMAPS === 'true'; // default false
const BABEL = process.env.BABEL !== 'false'; // default true
const VERSION = process.env.VERSION || 'snapshot';

const input = './src/index.js';

const name = 'cytoscape';

const getBabelOptions = () => ({
  exclude: '**/node_modules/**',
  plugins: ['external-helpers']
});

const configs = [
  {
    input,
    output: {
      file: 'build/cytoscape.js',
      format: 'umd',
      name,
      sourcemap: SOURCEMAPS ? 'inline' : false
    },
    plugins: [
      nodeResolve(),
      commonjs({ include: '**/node_modules/**' }),
      BABEL ? babel(getBabelOptions()) : {},
      replace({
        'process.env.NODE_ENV': JSON.stringify('development'),
        'process.env.VERSION': JSON.stringify(VERSION)
      })
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
      replace({
        'process.env.NODE_ENV': JSON.stringify('development'),
        'process.env.VERSION': JSON.stringify(VERSION)
      }),
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
    output: {
      file: 'build/cytoscape.umd.js',
      format: 'umd',
      name,
      sourcemap: SOURCEMAPS ? 'inline' : false,
      globals: {
        'heap': 'Heap',
        'lodash.debounce': '_.debounce'
      }
    },
    external: Object.keys( pkg.dependencies || {} ),
    plugins: [
      nodeResolve(),
      commonjs({ include: '**/node_modules/**' }),
      BABEL ? babel(getBabelOptions()) : {},
      replace({
        'process.env.NODE_ENV': JSON.stringify('production'),
        'process.env.VERSION': JSON.stringify(VERSION)
      })
    ]
  }
];

export default FILE
  ? configs.filter(config => config.output.file.includes(FILE))
  : configs;
