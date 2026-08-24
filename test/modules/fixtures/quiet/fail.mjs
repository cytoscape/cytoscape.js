/**
 * Round-101 reporter fixture: one passing neighbour (with its own
 * stdout noise) and one failing test that logs before it fails, so
 * the reporter spec can assert a red run names the failure, replays
 * the file's captured output (the events API cannot attribute output
 * to a test — see test/quiet-reporter.mjs), and prints no pass line
 * for the green neighbour.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

describe('quiet fixture (red)', () => {
  test('a passing neighbour', () => {
    console.log('neighbour noise that must be dropped');
    assert.ok(true);
  });

  test('the failing one', () => {
    console.log('failing-test noise that must be replayed');
    assert.equal(1, 2, 'one is not two');
  });
});
