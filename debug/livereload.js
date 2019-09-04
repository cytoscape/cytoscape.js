/* global document, location, window */

window.addEventListener('DOMContentLoaded', function(){
  var script = document.createElement('script');

  script.src = 'http://' + location.hostname + ':35729/livereload.js';

  document.head.appendChild( script );
});
