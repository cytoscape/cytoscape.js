var fs = require('fs');
var path = require('path');
var isJs = function( name ){ return name.match(/\.js$/) != null; };
var suiteFiles = fs.readdirSync( path.join(__dirname, '..') ).filter( isJs );

suiteFiles.forEach(function( fileName ){
  var suite = require('../' + fileName);

  suite.run();
});
