// set this to run just a single suite via `npm run benchmark:single`
// (useful when working on a specific function)
var suite = require('../collection-creation');

suite.run({ async: true });
