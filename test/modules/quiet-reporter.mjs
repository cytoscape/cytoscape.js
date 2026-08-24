import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect } from 'chai';

/*
Round 101.1: the failures-only `node:test` reporter, pinned by running
the real runner over two fixtures.

The two controls named at planning are both here and both literal:
green is asserted as **zero bytes** (compared to the empty string, not
to "short"), and red is asserted to carry the failing test's name and
assertion message — a quiet reporter that swallows failures is
strictly worse than the noise it replaced.  Run once with the
reporter's failure branch broken (`yield` dropped from `test:fail`) to
prove the red specs can fail; recorded in PLAN.md.
*/

const REPORTER = fileURLToPath(
  new URL('../quiet-reporter.mjs', import.meta.url),
);
const ROOT = fileURLToPath(new URL('../..', import.meta.url));

const fixture = (name) =>
  fileURLToPath(new URL(`./fixtures/quiet/${name}`, import.meta.url));

// This spec itself runs as a `node:test` child, and a spawned
// `node --test` that inherits NODE_TEST_CONTEXT behaves as another
// child (serialised events, no reporter) rather than as a root
// runner — so the variable is stripped from the fixture runs.
const env = { ...process.env };

delete env.NODE_TEST_CONTEXT;

const runReporter = (fixtureName) => {
  try {
    const stdout = execFileSync(
      process.execPath,
      ['--test', `--test-reporter=${REPORTER}`, fixture(fixtureName)],
      { cwd: ROOT, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );

    return { code: 0, stdout, stderr: '' };
  } catch (error) {
    return {
      code: error.status,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
    };
  }
};

describe('quiet-reporter', () => {
  describe('a green run', () => {
    let run;

    before(() => {
      run = runReporter('pass.mjs');
    });

    it('exits zero', () => {
      expect(run.code).to.equal(0);
    });

    it('emits zero bytes on stdout, dropped console noise included', () => {
      expect(run.stdout).to.equal('');
    });

    it('emits zero bytes on stderr', () => {
      expect(run.stderr).to.equal('');
    });
  });

  describe('a red run', () => {
    let run;

    before(() => {
      run = runReporter('fail.mjs');
    });

    it('exits nonzero', () => {
      expect(run.code).to.not.equal(0);
    });

    it('names the failing test with its suite path and file', () => {
      expect(run.stdout).to.include('quiet fixture (red) > the failing one');
      expect(run.stdout).to.include('fail.mjs');
    });

    it('carries the assertion message', () => {
      expect(run.stdout).to.include('one is not two');
    });

    // Whole-file replay, not per-test: the events API cannot
    // attribute output to a test (see test/quiet-reporter.mjs), so
    // the neighbour's noise rides along on red — asserted, so a
    // future "improvement" that silently drops the failing test's
    // own output with it is caught.
    it("replays the failing file's captured output", () => {
      expect(run.stdout).to.include('failing-test noise that must be replayed');
      expect(run.stdout).to.include('neighbour noise that must be dropped');
    });

    it('prints one block: the passing neighbour and the suite echo are silent', () => {
      const blocks = run.stdout.split('✖').length - 1;

      expect(blocks).to.equal(1);
      expect(run.stdout).to.not.include('a passing neighbour');
    });

    it('prints no tally and no pass marks', () => {
      expect(run.stdout).to.not.match(/\bpass \d/);
      expect(run.stdout).to.not.include('✔');
      expect(run.stdout).to.not.include('ℹ');
    });
  });
});
