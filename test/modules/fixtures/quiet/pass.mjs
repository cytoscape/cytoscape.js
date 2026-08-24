/**
 * Round-101 reporter fixture: an all-green file whose tests also
 * write to stdout, so the reporter spec can assert that a green run
 * emits zero bytes — dropped `console.log` noise included.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

describe('quiet fixture (green)', () => {
  test('a passing test that logs', () => {
    console.log('green noise that must be dropped');
    assert.equal(1 + 1, 2);
  });

  test('a second passing test', () => {
    assert.ok(true);
  });
});
