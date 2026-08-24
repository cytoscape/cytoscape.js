/**
 * Failures-only Playwright reporter (round 101), the browser-side
 * twin of `test/quiet-reporter.mjs`: zero bytes while everything
 * passes, and on failure each failing test's block — title path,
 * location, errors, and the test's own captured output — printed as
 * it lands.  No built-in reporter is silent on green without also
 * being silent on red, hence this one.
 *
 * Wired as `--reporter=./playwright-tests/quiet-reporter.mjs` by the
 * `:quiet` scripts; the loud runs keep the `list` reporter from
 * `playwright.config.js`.
 */
export default class QuietReporter {
  constructor({ write = (text) => process.stdout.write(text) } = {}) {
    this.write = write;
    this.outputByTest = new Map();
  }

  bufferOutput(test, chunk) {
    if (test == null) {
      return;
    }

    const buffered = this.outputByTest.get(test.id) ?? '';

    this.outputByTest.set(test.id, buffered + String(chunk));
  }

  onStdOut(chunk, test) {
    this.bufferOutput(test, chunk);
  }

  onStdErr(chunk, test) {
    this.bufferOutput(test, chunk);
  }

  onTestEnd(test, result) {
    const captured = this.outputByTest.get(test.id) ?? '';

    this.outputByTest.delete(test.id);

    const finalAttempt = result.retry === test.retries;
    const failed =
      test.outcome() === 'unexpected' && result.status !== 'passed';

    if (!failed || !finalAttempt) {
      return;
    }

    const { file, line, column } = test.location;
    const title = test
      .titlePath()
      .filter((part) => part !== '')
      .join(' > ');
    const errors = result.errors
      .map((error) => error.stack ?? error.message ?? String(error.value))
      .join('\n');
    const output = captured === '' ? '' : `\ncaptured output:\n${captured}`;

    this.write(
      `✖ ${title} (${file}:${line}:${column})\n${errors}\n${output}\n`,
    );
  }

  /** A worker-level error has no test to fail; it always prints. */
  onError(error) {
    this.write(`✖ ${error.stack ?? error.message ?? String(error.value)}\n`);
  }

  printsToStdio() {
    return true;
  }
}
