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
  jobs: parallelism
};
