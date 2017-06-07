var env = process.env;
var FILENAME = env.FILENAME || 'cytoscape.js';
var NODE_ENV = env.NODE_ENV || '';
var MINIFY = env.MINIFY ? true : false;
var BABEL = env.BABEL === undefined ? true : ( env.BABEL ? true : false );
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
  devtool: 'inline-source-map'
};
