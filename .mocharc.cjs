module.exports = {
  // tsx lets mocha tests import .mts source transparently; its extension
  // aliasing also resolves './foo.mjs' specifiers to foo.mts during the
  // incremental TypeScript migration.
  'node-option': ['import=tsx']
};
