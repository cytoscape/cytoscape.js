/**
 * Failures-only reporter for the `node:test` runner (round 101).
 *
 * Wired as `--test-reporter=./test/quiet-reporter.mjs`.  A green run
 * emits zero bytes — the exit code is the contract — and a red run
 * prints each failing test's block (name path, location, error, and
 * the output its file wrote) and nothing else.  Passing tests, suite
 * headers, diagnostics and the tally are all dropped; the loud
 * default reporter remains the tool for watching a suite think.
 *
 * The replayed output is the failing *file's*, not the failing
 * test's: measured at implementation (2026-08-24), `test:stdout`
 * events arrive decoupled from the result events — a file's writes
 * can all land before its first `test:pass` — so the events API
 * cannot attribute output to a test, and clearing on pass would drop
 * a failing test's own noise.  Whole-file replay never loses the
 * failing output; the price is that a green neighbour's noise rides
 * along on red, and only on red.
 */
import { inspect } from 'node:util';

/**
 * Failure kinds that are echoes of a child's failure rather than
 * failures in their own right: a suite whose only sin is holding a
 * failing test, and a test cancelled because its parent aborted.
 */
const ECHO_FAILURES = new Set(['subtestsFailed', 'cancelledByParent']);

const nameStackByFile = new Map();
const outputByFile = new Map();

const keyOf = (data) => data.file ?? '(unknown file)';

const stackFor = (file) => {
  let stack = nameStackByFile.get(file);

  if (stack == null) {
    stack = [];
    nameStackByFile.set(file, stack);
  }

  return stack;
};

const bufferOutput = (data) => {
  const file = keyOf(data);
  const buffered = outputByFile.get(file) ?? '';

  outputByFile.set(file, buffered + data.message);
};

const takeOutput = (file) => {
  const buffered = outputByFile.get(file) ?? '';

  outputByFile.delete(file);

  return buffered;
};

const fullName = (data) => {
  const ancestors = stackFor(keyOf(data)).slice(0, data.nesting);

  return [...ancestors, data.name].join(' > ');
};

const locationOf = (data) => {
  if (data.file == null) {
    return '';
  }

  const line = data.line != null ? `:${data.line}:${data.column}` : '';

  return ` (${data.file}${line})`;
};

const failureBlock = (data) => {
  const error = data.details?.error;
  const cause = error?.cause ?? error;
  const rendered = inspect(cause, { colors: false, depth: 6 });
  const captured = takeOutput(keyOf(data));
  const output =
    captured === '' ? '' : `\ncaptured output (whole file):\n${captured}`;

  return `✖ ${fullName(data)}${locationOf(data)}\n${rendered}\n${output}\n`;
};

export default async function* quietReporter(source) {
  for await (const event of source) {
    const { data } = event;

    switch (event.type) {
      case 'test:start': {
        stackFor(keyOf(data))[data.nesting] = data.name;
        break;
      }
      case 'test:stdout':
      case 'test:stderr': {
        bufferOutput(data);
        break;
      }
      case 'test:fail': {
        if (!ECHO_FAILURES.has(data.details?.error?.failureType)) {
          yield failureBlock(data);
        }
        break;
      }
      default: {
        // Suite headers, diagnostics, coverage, the tally: dropped.
        break;
      }
    }
  }
}
