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
  // The d.ts surface audits read the generated build/dts declarations, which
  // are not a precondition of the main `npm test` run. They have their own
  // targets (`test:types:docs`, `test:types:css`) that build the types first,
  // so keep them out of the recursive mocha sweep.
  ignore: [
    'test/types-docmaker-surface.mjs',
    'test/types-css-surface.mjs'
  ]
};
