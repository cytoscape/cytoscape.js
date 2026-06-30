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
  // The `test/types-*.mjs` files are standalone d.ts-surface audits, not mocha
  // suites. They read the generated build/dts declarations (which are not a
  // precondition of the main `npm test` run) and run via their own
  // build-first targets (`test:types:docs`/`:css`/`:exports`, `test:types:fresh`
  // and `test:types:all`). Keep them out of the recursive mocha sweep so a
  // build-less `npm test` does not try to load them.
  ignore: [
    'test/types-*.mjs'
  ]
};
