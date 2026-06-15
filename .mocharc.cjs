const os = require('node:os');

const parallelism = typeof os.availableParallelism === 'function'
  ? os.availableParallelism()
  : os.cpus().length;

module.exports = {
  // tsx lets mocha tests import .mts source transparently; its extension
  // aliasing also resolves './foo.mjs' specifiers to foo.mts during the
  // incremental TypeScript migration.
  'node-option': ['import=tsx'],
  parallel: true,
  jobs: parallelism,
  // The d.ts surface audit reads the generated build/dts declarations, which
  // are not a precondition of the main `npm test` run. It has its own target
  // (`test:types:docs`) that builds the types first, so keep it out of the
  // recursive mocha sweep.
  ignore: ['test/types-docmaker-surface.mjs']
};
