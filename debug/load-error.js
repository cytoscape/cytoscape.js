/* eslint-disable no-unused-vars */

// What the harness says when a network does not come up.
//
// This exists because the previous message lied, and lied in the one direction
// that costs a maintainer an afternoon.  `init.js` fetched a fixture, decoded
// it and *then called `loadNetwork` inside the same promise chain* — so a
// `.catch()` written for the fetch also caught every error the library threw:
// the sheet compile, the `cytoscape()` constructor, the layout.  For a network
// loaded from the binary wire form the message it printed was
//
//   Could not load "em-web" from ../v3/debug/webgl/network-em-web.cyge: …
//   A decode failure means the buffer and the library disagree — rebuild the
//   site (`npm run status`) so both come from the same commit.
//
// which names the fixture, the wire format and the wrong fix, for a failure
// that had nothing to do with any of them.  Meanwhile the eight *generated*
// networks call `loadNetwork` outside any promise, so the identical failure
// surfaced there as its own error.  The visible pattern — "the binary networks
// are broken, the built-in ones are fine" — is an artifact of the error
// handling, and it is what got reported.
//
// So the phase is passed in by the caller, which knows it, rather than guessed
// from the error: 'network' (the fetch never completed), 'http' (the server
// answered, badly), 'decode' (the bytes arrived and would not parse) and
// 'init' (the fixture is loaded and the *library* failed).  Only 'decode' may
// blame the wire buffer; only 'init' may not mention the fixture at all.
var loadError = (function () {
  /**
   * One line naming what stage failed, for the top of the message.
   */
  function headline(phase, networkID) {
    switch (phase) {
      case 'network':
        return 'Could not fetch the fixture for "' + networkID + '"';
      case 'http':
        return 'The server refused the fixture for "' + networkID + '"';
      case 'decode':
        return 'Could not decode the fixture for "' + networkID + '"';
      case 'init':
        // "the graph", not "the fixture": this phase is also reached by the
        // eight generated networks, which have no fixture at all
        return 'The graph for "' + networkID + '" loaded; cytoscape() failed';
      default:
        return 'Could not load "' + networkID + '"';
    }
  }

  /**
   * The hint under the error: one fix, chosen by phase and by which *form* of
   * the fixture was asked for.
   */
  function hint(opts) {
    var isWire = opts.isWire;
    var url = opts.url;

    if (opts.phase === 'network') {
      if (opts.protocol === 'file:') {
        return (
          'The page is open from the filesystem (file://), where fetch() cannot\n' +
          'read a sibling file — so every network that loads from a fixture fails\n' +
          'and only the generated ones work.  Serve the directory instead:\n' +
          '`npm run watch` from the repo root, or `npm run status:serve`.'
        );
      }

      return (
        'Nothing answered at ' +
        url +
        '.\nCheck the server is running and is serving the repo root.'
      );
    }

    if (opts.phase === 'http') {
      return isWire
        ? 'debug/status-config.js names this file, so the site was built\n' +
            'expecting it.  Rebuild it: `npm run status`.'
        : 'Fixtures live in v3/debug/webgl/ — served from the repo root, so run\n' +
            '`npm run watch` from the repo root rather than from debug/.';
    }

    if (opts.phase === 'decode') {
      return isWire
        ? 'This is the binary wire form (.cyge) written by\n' +
            'scripts/status-build.mjs.  A decode failure means the buffer and the\n' +
            'library disagree — rebuild the site (`npm run status`) so both come\n' +
            'from the same commit.'
        : 'The fixture is not the `{ elements: { nodes, edges } }` shape the\n' +
            'harness converts.  Check the file, not the library.';
    }

    // 'init': the bytes are fine and the fixture is not a suspect.  Saying so
    // is the whole point — this is the case that used to read as a bad buffer.
    return (
      'The elements came through intact' +
      (opts.counts != null
        ? ' (' + opts.counts.nodes + ' nodes, ' + opts.counts.edges + ' edges)'
        : '') +
      '.\n' +
      'The data is not the suspect: the failure is in the library, the\n' +
      'stylesheet or the renderer, and the console has the stack.'
    );
  }

  /**
   * The whole message.
   *
   * @param opts.phase 'network' | 'http' | 'decode' | 'init'
   * @param opts.networkID the id from `networks.js`
   * @param opts.url what was fetched
   * @param opts.isWire whether the binary wire form was asked for
   * @param opts.protocol `window.location.protocol`
   * @param opts.error the error itself
   * @param opts.counts `{ nodes, edges }`, when the fixture got that far
   */
  function describeLoadFailure(opts) {
    var err = opts.error;
    var message = err == null ? 'unknown error' : String(err.message || err);

    return (
      headline(opts.phase, opts.networkID) +
      ':\n' +
      message +
      '\n\n' +
      hint(opts) +
      '\n'
    );
  }

  return { describeLoadFailure: describeLoadFailure };
})();

// see debug/fixtures.js — the module suite loads these as scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = loadError;
}
