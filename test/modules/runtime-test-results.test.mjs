import { expect } from 'chai';
import {
  assertFilesHavePassingTests,
  compareTestResults,
  countStatuses,
  parseBunJunit,
  parseNodeTestEvents,
} from '../../scripts/runtime-test-results.mjs';
import nodeTestEventsReporter from '../../scripts/node-test-events-reporter.mjs';

const sourceFile = 'test/fixtures/runtime-controls.mjs';
const wrapperFile = '/tmp/runtime-controls/suite.test.mjs';

const nodeStream = (entries, counts, omitCompleteId = null) => {
  const roots = [];
  const stack = [];

  for (const entry of entries) {
    const node = { entry, children: [] };
    stack.length = entry.nesting;

    if (entry.nesting === 0) {
      roots.push(node);
    } else {
      const parent = stack[entry.nesting - 1];

      if (parent == null) {
        throw new Error(`missing fixture parent for ${entry.name}`);
      }

      parent.children.push(node);
    }

    if (entry.type === 'suite') {
      stack[entry.nesting] = node;
    }
  }

  const terminal = (entry) => ({
    type: 'test:complete',
    data: {
      testId: entry.id,
      name: entry.name,
      nesting: entry.nesting,
      skip: entry.skip === true,
      todo: false,
      details: {
        type: entry.type,
        passed: entry.status === 'passed',
        ...(entry.failureType == null
          ? {}
          : { error: { failureType: entry.failureType } }),
      },
    },
  });
  const execution = [];
  const visit = (node) => {
    const { entry } = node;
    execution.push({
      type: 'test:start',
      data: { testId: entry.id, name: entry.name, nesting: entry.nesting },
    });

    for (const child of node.children) {
      visit(child);
    }

    if (entry.id !== omitCompleteId) {
      execution.push(terminal(entry));
    }
  };

  roots.forEach(visit);
  const events = [
    ...entries.map(({ id, name, nesting }) => ({
      type: 'test:enqueue',
      data: { testId: id, name, nesting, type: 'suite' },
    })),
    ...execution,
    { type: 'test:summary', data: { counts } },
  ];

  return events.map((event) => JSON.stringify(event)).join('\n');
};

const bunXml = (inner) => `<?xml version="1.0"?>
<testsuites tests="2" failures="0" errors="0" skipped="2">
  <testsuite name="wrapper" file="${wrapperFile}" tests="2" failures="0" errors="0" skipped="2">
    <testsuite name="outer" file="${wrapperFile}" tests="2" failures="0" errors="0" skipped="2">
      <testsuite name="ignored" file="${wrapperFile}" tests="2" failures="0" errors="0" skipped="2">
        ${inner}
      </testsuite>
    </testsuite>
  </testsuite>
</testsuites>`;

const bunSkipCases = `
  <testcase name="first > child" classname="ignored &gt; outer" file="${wrapperFile}"><skipped/></testcase>
  <testcase name="second child" classname="ignored &gt; outer" file="${wrapperFile}"><skipped/></testcase>`;

const testOutcome = (name, status) => ({
  file: sourceFile,
  name,
  status,
  suitePath: [],
  identity: {
    key: JSON.stringify([sourceFile, 'test', [], name]),
    display: `${sourceFile} :: :: test ${JSON.stringify(name)}`,
  },
});

const compareOutcomeLists = (nodeOutcomes, bunOutcomes) =>
  compareTestResults(
    { files: [{ file: sourceFile, outcomes: nodeOutcomes }] },
    { files: [{ file: sourceFile, outcomes: bunOutcomes }] },
  );

const compareOne = (
  nodeName,
  nodeStatus,
  bunName = nodeName,
  bunStatus = nodeStatus,
) =>
  compareOutcomeLists(
    [testOutcome(nodeName, nodeStatus)],
    [testOutcome(bunName, bunStatus)],
  );

describe('runtime test result normalization', () => {
  it('uses terminal Node event types and rebuilds nested, sibling and duplicate suite paths', () => {
    const entries = [
      { id: 1, name: 'outer', nesting: 0, type: 'suite', status: 'passed' },
      { id: 2, name: 'same', nesting: 1, type: 'test', status: 'passed' },
      { id: 3, name: 'same', nesting: 1, type: 'suite', status: 'passed' },
      {
        id: 4,
        name: 'child > label',
        nesting: 2,
        type: 'test',
        status: 'passed',
      },
      { id: 5, name: 'same', nesting: 1, type: 'suite', status: 'passed' },
      { id: 6, name: 'child', nesting: 2, type: 'test', status: 'passed' },
    ];
    const parsed = parseNodeTestEvents(
      nodeStream(entries, {
        tests: 3,
        passed: 3,
        failed: 0,
        cancelled: 0,
        skipped: 0,
        todo: 0,
      }),
      sourceFile,
    );

    expect(parsed.totals).to.deep.equal(countStatuses(parsed.outcomes));
    expect(
      parsed.outcomes.map(({ identity }) => identity.display),
    ).to.deep.equal([
      'test/fixtures/runtime-controls.mjs :: "outer"#1 :: test "same"',
      'test/fixtures/runtime-controls.mjs :: "outer"#1 / "same"#1 :: test "child > label"',
      'test/fixtures/runtime-controls.mjs :: "outer"#1 / "same"#2 :: test "child"',
    ]);
  });

  it('rejects a leaf that has no terminal event', () => {
    const stream = nodeStream(
      [{ id: 1, name: 'missing', nesting: 0, type: 'test', status: 'passed' }],
      {
        tests: 1,
        passed: 1,
        failed: 0,
        cancelled: 0,
        skipped: 0,
        todo: 0,
      },
      1,
    ).split('\n');

    expect(() => parseNodeTestEvents(stream.join('\n'), sourceFile)).to.throw(
      'without outcomes',
    );
  });

  it('normalizes only real Bun skipped descendants of a Node skipped suite', () => {
    const node = parseNodeTestEvents(
      nodeStream(
        [
          { id: 1, name: 'outer', nesting: 0, type: 'suite', status: 'passed' },
          {
            id: 2,
            name: 'ignored',
            nesting: 1,
            type: 'suite',
            status: 'failed',
            skip: true,
          },
        ],
        {
          tests: 0,
          passed: 0,
          failed: 0,
          cancelled: 0,
          skipped: 0,
          todo: 0,
        },
      ),
      sourceFile,
    );
    const bunOutcomes = parseBunJunit(
      bunXml(bunSkipCases),
      new Map([[wrapperFile, sourceFile]]),
    );
    const comparison = compareTestResults(
      { files: [{ file: sourceFile, outcomes: node.outcomes }] },
      { files: [{ file: sourceFile, outcomes: bunOutcomes }] },
      [node.outcomes[0].identity.key],
    );

    expect(comparison.normalizedSuiteSkips).to.equal(1);
    expect(comparison.bunSkippedLeavesNormalized).to.equal(2);
    expect(comparison.tests).to.equal(0);
  });

  it('rejects empty or executed descendants under a Node skipped suite', () => {
    const suiteSkip = {
      file: sourceFile,
      suitePath: [
        { name: 'outer', occurrence: 1 },
        { name: 'ignored', occurrence: 1 },
      ],
      status: 'skipped-suite',
      identity: {
        key: 'skip-suite',
        display: `${sourceFile} :: skipped suite`,
      },
    };
    const node = { files: [{ file: sourceFile, outcomes: [suiteSkip] }] };
    const emptyBun = { files: [{ file: sourceFile, outcomes: [] }] };
    const passedBun = {
      files: [
        {
          file: sourceFile,
          outcomes: [
            {
              ...suiteSkip,
              status: 'passed',
              identity: { key: 'child', display: 'child' },
            },
          ],
        },
      ],
    };

    expect(() => compareTestResults(node, emptyBun, ['skip-suite'])).to.throw(
      'no skipped descendants',
    );
    expect(() => compareTestResults(node, passedBun, ['skip-suite'])).to.throw(
      'ran a descendant',
    );
  });

  it('accepts identical green identities and rejects missing or extra identities', () => {
    expect(compareOne('same test', 'passed').tests).to.equal(1);
    let missingFromBun;
    let missingFromNode;

    try {
      compareOutcomeLists([testOutcome('node-only', 'passed')], []);
    } catch (error) {
      missingFromBun = error;
    }

    try {
      compareOutcomeLists([], [testOutcome('bun-only', 'passed')]);
    } catch (error) {
      missingFromNode = error;
    }

    expect(missingFromBun.message).to.contain('missing from Bun');
    expect(missingFromNode.message).to.contain('missing from Node');
    expect(() =>
      compareOne('node test', 'passed', 'bun test', 'passed'),
    ).to.throw('test identity/outcome mismatch');
  });

  it('fails closed when a discovered wrapper emits no passing leaf', () => {
    const passing = {
      file: sourceFile,
      status: 'passed',
      identity: { display: `${sourceFile} :: test` },
    };

    expect(
      assertFilesHavePassingTests([passing], [sourceFile], 'control'),
    ).to.deep.equal(new Map([[sourceFile, 1]]));
    expect(() =>
      assertFilesHavePassingTests(
        [passing],
        [sourceFile, 'test/empty.mjs'],
        'control',
      ),
    ).to.throw(
      'no terminal test identity for discovered file(s): test/empty.mjs',
    );
    expect(() =>
      assertFilesHavePassingTests(
        [{ ...passing, file: 'test/unknown.mjs' }],
        [sourceFile],
        'control',
      ),
    ).to.throw('undiscovered file');
    expect(() =>
      assertFilesHavePassingTests(
        [{ ...passing, status: 'skipped' }],
        [sourceFile],
        'control',
      ),
    ).to.throw('unreviewed skipped outcome');
    expect(() =>
      assertFilesHavePassingTests(
        [passing],
        [sourceFile, sourceFile],
        'control',
      ),
    ).to.throw('duplicate source files');
  });

  it('rejects equal identities with different terminal outcomes', () => {
    expect(() =>
      compareOne('same test', 'passed', 'same test', 'failed'),
    ).to.throw('test identity/outcome mismatch');
  });

  it('fails closed on truncated XML and inconsistent declared aggregates', () => {
    const wrapperToSource = new Map([[wrapperFile, sourceFile]]);

    expect(() =>
      parseBunJunit(
        bunXml(bunSkipCases).replace('</testsuites>', ''),
        wrapperToSource,
      ),
    ).to.throw('truncated or ambiguous');
    expect(() =>
      parseBunJunit(
        bunXml(bunSkipCases).replace(
          'tests="2" failures="0"',
          'tests="3" failures="0"',
        ),
        wrapperToSource,
      ),
    ).to.throw('declares 3 tests, observed 2');
  });
});

describe('the Node events reporter (round 151)', () => {
  // On Windows a hook's `npm` spawn failed with an error that referenced
  // itself; JSON.stringify threw inside the reporter and the file's every
  // result was lost.  The reporter must emit the event, failureType intact.
  it('emits an event whose error is circular', async () => {
    const error = new Error('spawn npm ENOENT');
    error.failureType = 'hookFailed';
    error.error = error;
    const lines = [];

    for await (const line of nodeTestEventsReporter([
      { type: 'test:complete', data: { name: 'x', details: { error } } },
    ])) {
      lines.push(line);
    }

    const event = JSON.parse(lines[0]);

    expect(event.data.details.error.failureType).to.equal('hookFailed');
    expect(event.data.details.error.error).to.equal('[Circular]');
    expect(event.data.formattedError).to.include('spawn npm ENOENT');
  });
});
