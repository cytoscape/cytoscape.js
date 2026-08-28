import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect } from 'chai';

/*
Round 101.3: a quiet twin is the same command modulo the reporter flag
or wrapper prefix — enforced, not hoped.  A twin that drifts (a quiet
variant losing its build step, say) fails green in the worst way, so
this spec normalises each `:quiet` script back to its loud form and
asserts equality:

- wrapper twins lose the `node scripts/quiet-run.mjs ` prefix;
- reporter twins lose the one `--test-reporter=` / `--reporter=` token;
- composite (`run-s`) twins lose the `:quiet` suffix on each step.

It also enumerates in both directions: every pair in the table exists,
and every script named `*:quiet` in package.json is in the table — a
stray twin nobody registered is itself a failure.
*/

const WRAPPER_PREFIX = 'node scripts/quiet-run.mjs ';
const NODE_REPORTER = ' --test-reporter=./test/quiet-reporter.mjs';
const PLAYWRIGHT_REPORTER = ' --reporter=./playwright-tests/quiet-reporter.mjs';

const { scripts } = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../package.json', import.meta.url)),
    'utf8',
  ),
);

const loudNameOf = (quietName) => quietName.replace(/:quiet$/, '');

/** Strip the quiet tokens; what remains must be the loud command. */
const normalise = (quietCommand) => {
  let command = quietCommand;

  if (command.startsWith(WRAPPER_PREFIX)) {
    return command.slice(WRAPPER_PREFIX.length);
  }

  if (command.includes(NODE_REPORTER)) {
    return command.replace(NODE_REPORTER, '');
  }

  if (command.includes(PLAYWRIGHT_REPORTER)) {
    return command.replace(PLAYWRIGHT_REPORTER, '');
  }

  if (command.startsWith('run-s ')) {
    return (
      'run-s ' +
      command
        .slice('run-s '.length)
        .split(/\s+/)
        .map((step) => loudNameOf(step))
        .join(' ')
    );
  }

  return command;
};

const quietNames = Object.keys(scripts).filter((name) =>
  name.endsWith(':quiet'),
);

const EXPECTED_TWINS = [
  'build:quiet',
  'lint:quiet',
  'typecheck:quiet',
  'verify:quiet',
  'test:js:quiet',
  'test:modules:quiet',
  'test:modules:run:quiet',
  'test:soak:quiet',
  'test:throws:quiet',
  'test:runtimes:node:quiet',
  'test:runtimes:node:run:quiet',
  'test:runtimes:bun:quiet',
  'test:runtimes:bun:run:quiet',
  'test:runtimes:deno:quiet',
  'test:runtimes:deno:run:quiet',
  'test:node:quiet',
  'test:playwright:install:quiet',
  'test:playwright:build:quiet',
  'test:playwright:build:v3:quiet',
  'test:playwright:run:quiet',
  'test:playwright:quiet',
  'test:quiet',
];

describe('quiet script twins', () => {
  it('every expected twin exists', () => {
    for (const name of EXPECTED_TWINS) {
      expect(scripts, `missing script ${name}`).to.have.property(name);
    }
  });

  it('every *:quiet script in package.json is a registered twin', () => {
    expect(quietNames.sort()).to.deep.equal([...EXPECTED_TWINS].sort());
  });

  it('every twin has a loud original', () => {
    for (const name of quietNames) {
      expect(scripts, `no loud twin for ${name}`).to.have.property(
        loudNameOf(name),
      );
    }
  });

  for (const name of EXPECTED_TWINS) {
    it(`${name} differs from ${loudNameOf(name)} only in the quiet tokens`, () => {
      expect(normalise(scripts[name])).to.equal(scripts[loudNameOf(name)]);
    });
  }

  it('the composite steps each resolve to a defined quiet script', () => {
    for (const name of quietNames) {
      const command = scripts[name];

      if (!command.startsWith('run-s ')) {
        continue;
      }

      for (const step of command.slice('run-s '.length).split(/\s+/)) {
        expect(
          scripts,
          `${name} runs undefined script ${step}`,
        ).to.have.property(step);
        expect(step, `${name} runs loud step ${step}`).to.match(/:quiet$/);
      }
    }
  });
});
