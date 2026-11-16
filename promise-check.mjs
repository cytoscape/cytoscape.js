import assert from 'node:assert/strict';

// Test 1: Native Promise
const nativeModule = await import('./src/promise.mjs');

assert.equal(nativeModule.default, Promise);
console.log('PASS: Native Promise is selected');

// Test 2: Fallback Promise
const originalPromise = globalThis.Promise;

let Fallback;

try {
  globalThis.Promise = undefined;

  const fallbackModule =
    await import('./src/promise.mjs?fallback-check');

  Fallback = fallbackModule.default;
} finally {
  globalThis.Promise = originalPromise;
}

assert.equal(typeof Fallback, 'function');
assert.notEqual(Fallback, originalPromise);

console.log('PASS: Fallback Promise is selected');

// Test 3: Fallback resolves a value
const result = await new originalPromise((resolve, reject) => {
  Fallback.resolve(42).then(resolve, reject);
});

assert.equal(result, 42);

console.log('PASS: Fallback resolves value 42');
// Test 4: Fallback Promise.all()
const values = await new originalPromise((resolve, reject) => {
  Fallback.all([
    Fallback.resolve(10),
    Fallback.resolve(20),
    Fallback.resolve(30)
  ]).then(resolve, reject);
});

assert.deepEqual(values, [10, 20, 30]);

console.log('PASS: Fallback Promise.all resolves multiple values');