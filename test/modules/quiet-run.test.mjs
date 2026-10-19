import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect } from 'chai';

/*
Round 101.2: the capture wrapper for tools with no quiet mode.  Green
prints nothing at all; red replays the child's captured stdout and
stderr byte-for-byte on their own streams and preserves the child's
exit code.  The byte-for-byte claim is asserted by comparison against
an unwrapped run of the same command, not by eyeballing.
*/

const WRAPPER = fileURLToPath(
  new URL('../../scripts/quiet-run.mjs', import.meta.url),
);
const ROOT = fileURLToPath(new URL('../..', import.meta.url));

const run = (argv) => {
  try {
    const stdout = execFileSync(process.execPath, argv, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    return { code: 0, stdout, stderr: '' };
  } catch (error) {
    return {
      code: error.status,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
    };
  }
};

const GREEN_CHILD = ['-e', 'console.log("out"); console.error("err")'];
const RED_CHILD = [
  '-e',
  'console.log("out line"); console.error("err line"); process.exit(3)',
];

describe('quiet-run', () => {
  it('prints nothing and exits zero when the child succeeds', () => {
    const wrapped = run([WRAPPER, process.execPath, ...GREEN_CHILD]);

    expect(wrapped.code).to.equal(0);
    expect(wrapped.stdout).to.equal('');
    expect(wrapped.stderr).to.equal('');
  });

  it('replays a failing child byte-for-byte on the right streams', () => {
    const wrapped = run([WRAPPER, process.execPath, ...RED_CHILD]);
    const unwrapped = run([...RED_CHILD]);

    expect(wrapped.stdout).to.equal(unwrapped.stdout);
    expect(wrapped.stderr).to.equal(unwrapped.stderr);
    expect(wrapped.stdout).to.equal('out line\n');
    expect(wrapped.stderr).to.equal('err line\n');
  });

  it("preserves the child's exit code", () => {
    const wrapped = run([WRAPPER, process.execPath, ...RED_CHILD]);

    expect(wrapped.code).to.equal(3);
  });

  it('accepts a -- separator before the command', () => {
    const wrapped = run([WRAPPER, '--', process.execPath, ...GREEN_CHILD]);

    expect(wrapped.code).to.equal(0);
    expect(wrapped.stdout).to.equal('');
  });

  it('fails loudly when given no command', () => {
    const wrapped = run([WRAPPER]);

    expect(wrapped.code).to.equal(2);
    expect(wrapped.stderr).to.include('usage');
  });

  it('exits 127 and says so when the command does not exist', () => {
    const wrapped = run([WRAPPER, 'no-such-command-round-101']);

    expect(wrapped.code).to.equal(127);
    expect(wrapped.stderr).to.include('no-such-command-round-101');
  });
});
