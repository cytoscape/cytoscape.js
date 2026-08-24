import { expect } from 'chai';
import QuietReporter from '../../playwright-tests/quiet-reporter.mjs';

/*
Round 101.3: the failures-only Playwright reporter, driven directly
with the shapes Playwright hands a reporter — cheap enough to run in
the Node tier, where spinning a real browser suite up to red is not.
The write sink is injected, so nothing here touches process.stdout.
*/

const makeTest = ({ outcome = 'expected', retries = 0, id = 't1' } = {}) => ({
  id,
  retries,
  outcome: () => outcome,
  titlePath: () => ['', 'renderer', 'renderer.spec.js', 'draws the node'],
  location: { file: 'playwright-tests/renderer.spec.js', line: 12, column: 3 },
});

const makeResult = ({ status = 'passed', retry = 0, errors = [] } = {}) => ({
  status,
  retry,
  errors,
});

const record = () => {
  const written = [];

  return {
    written,
    reporter: new QuietReporter({ write: (text) => written.push(text) }),
  };
};

describe('quiet Playwright reporter', () => {
  it('prints nothing for a passing test, dropped stdio included', () => {
    const { reporter, written } = record();
    const test = makeTest();

    reporter.onStdOut('some page noise\n', test);
    reporter.onTestEnd(test, makeResult({ status: 'passed' }));

    expect(written.join('')).to.equal('');
  });

  it("prints the failing test's block: title path, location, error", () => {
    const { reporter, written } = record();
    const test = makeTest({ outcome: 'unexpected' });

    reporter.onTestEnd(
      test,
      makeResult({
        status: 'failed',
        errors: [
          {
            message: 'expected 5 to equal 6',
            stack: 'Error: expected 5 to equal 6\n  at spec',
          },
        ],
      }),
    );

    const output = written.join('');

    expect(output).to.include('renderer > renderer.spec.js > draws the node');
    expect(output).to.include('playwright-tests/renderer.spec.js:12:3');
    expect(output).to.include('expected 5 to equal 6');
  });

  it("replays the failing test's own captured output", () => {
    const { reporter, written } = record();
    const failing = makeTest({ outcome: 'unexpected', id: 'red' });
    const green = makeTest({ id: 'green' });

    reporter.onStdOut('green noise\n', green);
    reporter.onStdErr('red noise\n', failing);
    reporter.onTestEnd(green, makeResult({ status: 'passed' }));
    reporter.onTestEnd(
      failing,
      makeResult({ status: 'failed', errors: [{ message: 'boom' }] }),
    );

    const output = written.join('');

    expect(output).to.include('red noise');
    expect(output).to.not.include('green noise');
  });

  it('stays silent on a non-final retry and prints on the final one', () => {
    const { reporter, written } = record();
    const test = makeTest({ outcome: 'unexpected', retries: 1 });

    reporter.onTestEnd(
      test,
      makeResult({ status: 'failed', retry: 0, errors: [{ message: 'boom' }] }),
    );

    expect(written.join('')).to.equal('');

    reporter.onTestEnd(
      test,
      makeResult({ status: 'failed', retry: 1, errors: [{ message: 'boom' }] }),
    );

    expect(written.join('')).to.include('boom');
  });

  it('always prints a worker-level error', () => {
    const { reporter, written } = record();

    reporter.onError({
      message: 'worker crashed',
      stack: 'Error: worker crashed',
    });

    expect(written.join('')).to.include('worker crashed');
  });
});
