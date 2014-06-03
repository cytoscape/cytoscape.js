var exec = require('child_process').exec;
var configFile = './docmaker.json';
var config;
var delay = 3000;
var width = 400;
var height = 400;

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

    if( section.sections ){
      parseSections( section.sections );
    }
  }
}

parseSections( config.sections );

var wh = width + '*' + height;
for( var i = 0; i < demoIds.length; i++ ){
  var id = demoIds[i];
  var url = 'http://jsbin.com/' + id + '/latest';
  var filename = 'img/demos/' + id + '.png';

  exec('phantomjs screencapture.js ' + url + ' ' + filename + ' ' + delay + ' ' + wh);
}