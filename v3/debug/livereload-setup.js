/* global document, location, window */

// window.LiveReloadOptions = {
//   host: location.hostname,
//   port: 35729
// };

window.addEventListener('DOMContentLoaded', function(){
  var script = document.createElement('script');

  script.src = 'http://' + location.hostname + ':35729/livereload.js?snipver=1';

  document.head.appendChild( script );
});
