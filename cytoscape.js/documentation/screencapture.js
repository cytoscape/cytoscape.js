// uses phantomjs to get screenshots of page

var page = require('webpage').create();
var system = require('system');
var url;
var usage = 'phantomjs screencapture.js <url> [filename] [msDelay] [w*h]';
var delay = 0; // by default
var filename = 'screencapture.png'; // by default
var viewport = { // by default
  width: 800,
  height: 600
};

if( system.args.length < 2 ){
  console.log('No URL specified for capture: ' + usage);
  phantom.exit();
} else {
  url = system.args[1];
}

if( system.args.length >= 3 ){
  filename = system.args[2];
}

if( system.args.length >= 4 ){
  delay = parseInt( system.args[3], 10 ) || 0;
}

if( system.args.length >= 5 ){
  var vp = system.args[4].match(/^([0-9]+)\*([0-9]+)$/);

  if( vp ){
    viewport = {
      width: parseInt( vp[1], 10),
      height: parseInt( vp[2], 10)
    };
  }
}

page.viewportSize = viewport;
page.clipRect = { top: 0, left: 0, width: viewport.width, height: viewport.height };

page.open(url, function(){

  window.setTimeout(function(){
    page.render( { filename }, { quality: 80 } );

    phantom.exit();
  }, delay);

});