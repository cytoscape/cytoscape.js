/* global document, location, window, console */

// The LiveReload client is loaded from the server `npm run watch:sync` starts,
// at whatever host this page was served from — which is why that server must
// bind every interface (`-b 0.0.0.0` in watch:sync) rather than take
// livereload's `localhost` default.  Node resolves `localhost` to `::1` here,
// so the default bound `[::1]:35729` only, while `http-server -o` opens the
// page at `127.0.0.1:3333`: the two never met and the client 404'd on every
// reload with nothing but a console line to say so.

window.addEventListener('DOMContentLoaded', function(){
  var script = document.createElement('script');

  script.src = 'http://' + location.hostname + ':35729/livereload.js?snipver=1';

  // a dev-server that is simply not running is a legitimate state (you can
  // serve debug/ from anything), so this is a note rather than a failure —
  // but it says *which* command starts it, because the browser's own
  // ERR_CONNECTION_REFUSED does not
  script.onerror = function(){
    console.info(
      'LiveReload is not running at ' + location.hostname + ':35729 — '
      + 'reloads will not happen. Start it with `npm run watch` (or '
      + '`npm run watch:sync`) from the repo root.'
    );
  };

  document.head.appendChild( script );
});
