var Promise = require("bluebird");
var bluebird = require("bluebird");
var pexec = bluebird.promisify( require('child_process').exec );
var configFile = './docmaker.json';
var config;
var phantom = 'phantomjs';
// var phantom = './slimerjs-0.9.3/slimerjs';
var delay = 3000;
var width = 1000;
var height = 1000;

try {
  config = require(configFile);
} catch(e){
  throw '`' + configFile + '` could not be read; check the JSON is formatted correctly http://pro.jsonlint.com/ : ' + e;
}

var demoIds = [];

function parseSections( sections ){
  for( var i = 0; i < sections.length; i++ ){
    var section = sections[i];

    if( section.demos ){
      var demos = section.demos;

      for( var j = 0; j < demos.length; j++ ){
        var demo = demos[j];

        demoIds.push( demo.id );
      }
    }

    if( section.demo ){
      var demo = section.demo;

      demoIds.push( demo.id );
    }

    if( section.sections ){
      parseSections( section.sections );
    }
  }
}

module.exports = function( next ){
  parseSections( config.sections );

  var wh = width + '*' + height;
  var execs = [];

  //process.env['SLIMERJSLAUNCHER'] = '/Applications/Firefox.app/Contents/MacOS/firefox';

  for( var i = 0; i < demoIds.length; i++ ){
    var id = demoIds[i];
    var url = 'http://jsbin.com/' + id + '/latest';
    var filename = 'img/demos/' + id + '.png';

    execs.push( pexec(phantom + ' screencapture.js ' + url + ' ' + filename + ' ' + delay + ' ' + wh) );
  }

  Promise.all( execs ).then(function(){
    next && next();
  }).catch(function( err ){
    throw err;
  });
};
