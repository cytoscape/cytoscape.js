var env = function( name, def ){
  var val = process.env[ name ];

  if( val === undefined || val === '' ){
    return def;
  } else {
    return val;
  }
};
var boolEnv = function( name, def ){
  return env( name, def ) == 'true';
};
var FILENAME = env('FILENAME', 'cytoscape.js');
var NODE_ENV = env('NODE_ENV', '');
var MINIFY = boolEnv('MINIFY', false);
var BABEL = boolEnv('BABEL', true);
var SOURCEMAPS = boolEnv('SOURCEMAPS', false);
var pkg = require('./package.json');
var path = require('path');
var webpack = require('webpack');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: FILENAME,
    library: 'cytoscape',
    libraryTarget: 'umd'
  },
  externals: NODE_ENV === 'production' ? Object.keys( pkg.dependencies || {} ) : [],
  module: {
    rules: [ // common rules

    ].concat( BABEL ? [
      {
        loader: 'babel-loader',
        test: /\.js$/,
        include: [
          path.resolve(__dirname, 'src')
        ],
        exclude: [
          path.resolve(__dirname, 'node_modules')
        ]
      }
    ] : [])
  },
  plugins: [ // common plugins

  ].concat( MINIFY ? [ // minify plugins
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        warnings: false,
        drop_console: false,
      }
    })
  ] : [] ),
  devtool: SOURCEMAPS ? 'inline-source-map' : false,
  node: false
};
