var fs = require('fs');
var Handlebars = require('handlebars');
var encoding = 'utf8';

var vercmp = function(a, b){
  var aNums = getVerNums(a);
  var bNums = getVerNums(b);

  for( var i = 0; i < aNums.length; i++ ){
    if( aNums[i] === bNums[i] ){ continue; }

    return aNums[i] - bNums[i];
  }

  return 0;
};

var getVerNums = function( filename ){
  var format = /cytoscape\.js-(\d+\.\d+\.\d+)\.zip/;

  return filename.match( format )[1].split('.').map(function( digit ){
    return parseInt( digit, 10 );
  });
}

var filenameHasVer = function( file ){
  try{
    getVerNums( file );
  } catch(e){
    return false;
  }

  return true;
};

module.exports = function( next ){
  var files = fs.readdirSync('.').filter( filenameHasVer ).sort( vercmp ).reverse();

  var builds = files.map(function( file ){
    return {
      filename: file
    };
  });

  var htmlTemplate = fs.readFileSync('./template.html', encoding);
  var template = Handlebars.compile( htmlTemplate );
  var context = {
    builds: builds
  };
  var html = template( context );

  fs.writeFileSync('index.html', html, encoding);

  next();
}


