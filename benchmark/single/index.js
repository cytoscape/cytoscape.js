// set this to run just a single suite via `gulp benchmark-single`
// (useful when working on a specific function)
var suite = require('../karger-stein');

suite.run({ async: true });
