import '../node-test-setup.mjs';

if (typeof globalThis.gc !== 'function') {
  if (typeof globalThis.Bun?.gc !== 'function') {
    throw new Error('Bun test setup needs Bun.gc() for the soak suite');
  }

  globalThis.gc = () => globalThis.Bun.gc(true);
}
