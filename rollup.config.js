var nodeResolve = require('rollup-plugin-node-resolve');
var commonjs = require('rollup-plugin-commonjs');
var babel = require('rollup-plugin-babel');
var uglify = require('rollup-plugin-uglify');

var env = function( name, def ){
  var val = process.env[ name ];

  if( val === undefined || val === '' ){
    return def;
  } else {
    return val;
  }
};
var boolEnv = function( name, def ){
  return env( name, def ? 'true' : 'false' ) == 'true';
};
var FILENAME = env('FILENAME', 'cytoscape.js');
var NODE_ENV = env('NODE_ENV', '');
var MINIFY = boolEnv('MINIFY', false);
var BABEL = boolEnv('BABEL', true);
var SOURCEMAPS = boolEnv('SOURCEMAPS', false);
var pkg = require('./package.json');
var path = require('path');

module.exports = {
  input: './src/index.js',
  output: {
    file: path.resolve(__dirname, 'build', FILENAME),
    name: 'cytoscape',
    format: NODE_ENV === 'production' ? 'cjs' : 'umd',
    sourcemap: SOURCEMAPS ? 'inline' : false
  },
  external: NODE_ENV === 'production' ? Object.keys( pkg.dependencies || {} ) : [],
  plugins: [
    nodeResolve(),
    commonjs({
      include: [
        'node_modules/lodash.debounce/**',
        'node_modules/heap/**'
      ]
    }),
    BABEL ? babel({
      include: [
        path.resolve(__dirname, 'src', '**/*.js')
      ],
      babelrc: false,
      presets: [
        ['env', { modules: false }]
      ],
      plugins: [
        'external-helpers'
      ]
    }) : {},
    MINIFY ? uglify({
      compress: {
        warnings: false,
        drop_console: false,
      }
    }) : {}
  ]
};
