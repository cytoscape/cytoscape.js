/**
 * Normalize the result streams from Node's node:test reporter and Bun's JUnit
 * reporter.  These are execution records: a test is counted only after its
 * runner emits a terminal event or testcase.
 */

import { resolve } from 'node:path';

const xmlDecode = (value) =>
  (() => {
    if (!/^(?:[^&]|&(?:#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);)*$/i.test(value)) {
      throw new Error(`malformed or unsupported XML entity in ${value}`);
    }

    return value.replace(
      /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
      (_, entity) => {
        const named = {
          amp: '&',
          lt: '<',
          gt: '>',
          quot: '"',
          apos: "'",
        };

        if (entity[0] !== '#') {
          return named[entity.toLowerCase()];
        }

        const codepoint =
          entity[1].toLowerCase() === 'x'
            ? Number.parseInt(entity.slice(2), 16)
            : Number.parseInt(entity.slice(1), 10);

        if (
          !Number.isInteger(codepoint) ||
          codepoint < 0 ||
          codepoint > 0x10ffff ||
          (codepoint >= 0xd800 && codepoint <= 0xdfff)
        ) {
          throw new Error(`invalid XML character reference &${entity};`);
        }

        return String.fromCodePoint(codepoint);
      },
    );
  })();

const xmlAttributes = (text) => {
  const attrs = {};
  const pattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let matched;
  let consumed = '';

  while ((matched = pattern.exec(text)) != null) {
    if (Object.hasOwn(attrs, matched[1])) {
      throw new Error(`duplicate JUnit attribute ${matched[1]}`);
    }

    attrs[matched[1]] = xmlDecode(matched[2] ?? matched[3]);
    consumed += matched[0];
  }

  if (consumed.replace(/\s/g, '') !== text.replace(/\s/g, '')) {
    throw new Error(`malformed JUnit attributes: ${text}`);
  }

  return attrs;
};

const parseXml = (text) => {
  const document = { name: '#document', attrs: {}, children: [], text: [] };
  const stack = [document];
  let offset = 0;

  while (offset < text.length) {
    if (text[offset] !== '<') {
      const end = text.indexOf('<', offset);
      const value = text.slice(offset, end < 0 ? text.length : end);
      stack.at(-1).text.push({ value, cdata: false });
      offset += value.length;
      continue;
    }

    if (text.startsWith('<!--', offset)) {
      const end = text.indexOf('-->', offset + 4);

      if (end < 0) {
        throw new Error(`truncated JUnit XML comment at byte ${offset}`);
      }

      offset = end + 3;
      continue;
    }

    if (text.startsWith('<![CDATA[', offset)) {
      const end = text.indexOf(']]>', offset + 9);

      if (end < 0) {
        throw new Error(`truncated JUnit XML CDATA at byte ${offset}`);
      }

      stack.at(-1).text.push({
        value: text.slice(offset + 9, end),
        cdata: true,
      });
      offset = end + 3;
      continue;
    }

    if (text.startsWith('<?', offset)) {
      const end = text.indexOf('?>', offset + 2);

      if (end < 0) {
        throw new Error(
          `truncated JUnit XML processing instruction at byte ${offset}`,
        );
      }

      offset = end + 2;
      continue;
    }

    if (text.startsWith('</', offset)) {
      const end = text.indexOf('>', offset + 2);

      if (end < 0) {
        throw new Error(`truncated JUnit XML closing tag at byte ${offset}`);
      }

      const token = text.slice(offset, end + 1);
      const closingName = token.match(/^<\/([\w:.-]+)\s*>$/)?.[1];
      const open = stack.pop();

      if (
        closingName == null ||
        open == null ||
        open === document ||
        open.name !== closingName
      ) {
        throw new Error(`mismatched JUnit XML closing tag ${token}`);
      }

      offset = end + 1;
      continue;
    }

    const openingPrefix = text.slice(offset).match(/^<([A-Za-z_][\w:.-]*)/);

    if (openingPrefix == null) {
      throw new Error(`malformed JUnit XML tag at byte ${offset}`);
    }

    const name = openingPrefix[1];
    const attrsStart = offset + openingPrefix[0].length;
    let quote = null;
    let end = attrsStart;

    for (; end < text.length; end += 1) {
      const char = text[end];

      if (quote != null) {
        if (char === quote) {
          quote = null;
        }
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === '>') {
        break;
      }
    }

    if (end === text.length || quote != null) {
      throw new Error(`truncated JUnit XML opening tag at byte ${offset}`);
    }

    const rawAttrs = text.slice(attrsStart, end).replace(/\/\s*$/, '');
    const selfClosing = /\/\s*$/.test(text.slice(attrsStart, end));
    const node = {
      name,
      attrs: xmlAttributes(rawAttrs),
      children: [],
      text: [],
    };
    stack.at(-1).children.push(node);

    if (!selfClosing) {
      stack.push(node);
    }

    offset = end + 1;
  }

  if (
    stack.length !== 1 ||
    document.children.length !== 1 ||
    document.text
      .map(({ value }) => value)
      .join('')
      .trim() !== ''
  ) {
    throw new Error('truncated or ambiguous JUnit XML document');
  }

  return document.children[0];
};

const descendants = (node, name, out = []) => {
  for (const child of node.children) {
    if (child.name === name) {
      out.push(child);
    }

    descendants(child, name, out);
  }

  return out;
};

const textContent = (node) =>
  node.text
    .map(({ value, cdata }) => (cdata ? value : xmlDecode(value)))
    .join('') + node.children.map(textContent).join('');

const checkAggregate = (node, name, actual, label) => {
  if (node.attrs[name] == null) {
    return;
  }

  const declared = Number(node.attrs[name]);

  if (!Number.isInteger(declared) || declared !== actual) {
    throw new Error(
      `Bun JUnit ${label} declares ${node.attrs[name]} ${name}, observed ${actual}`,
    );
  }
};

const makeIdentity = (file, suitePath, name, kind = 'test') => ({
  kind,
  file,
  suitePath,
  name,
  key: JSON.stringify([
    file,
    kind,
    suitePath.map(({ name: suiteName, occurrence }) => [suiteName, occurrence]),
    name,
  ]),
  display: `${file} :: ${suitePath.map(({ name: suiteName, occurrence }) => `${JSON.stringify(suiteName)}#${occurrence}`).join(' / ')} :: ${kind} ${JSON.stringify(name)}`,
});

const addOrdinals = (outcomes) => {
  const seen = new Map();

  return outcomes.map((outcome) => {
    const count = (seen.get(outcome.identity.key) ?? 0) + 1;
    seen.set(outcome.identity.key, count);

    return {
      ...outcome,
      identity: {
        ...outcome.identity,
        key:
          count === 1
            ? outcome.identity.key
            : `${outcome.identity.key}#${count}`,
        display:
          count === 1
            ? outcome.identity.display
            : `${outcome.identity.display} [${count}]`,
      },
    };
  });
};

/** Parse one per-file Node `--test-isolation=none` structured event stream. */
export const parseNodeTestEvents = (text, file) => {
  const enqueued = new Map();
  const suiteOccurrences = new Map();
  const completed = new Map();
  const eventOrder = [];
  let summary;

  for (const [lineNumber, line] of text.split(/\r?\n/).entries()) {
    if (line.length === 0) {
      continue;
    }

    let event;

    try {
      event = JSON.parse(line);
    } catch (cause) {
      throw new Error(
        `Node reporter emitted malformed JSON on line ${lineNumber + 1}`,
        {
          cause,
        },
      );
    }

    if (event == null || typeof event.type !== 'string' || event.data == null) {
      throw new Error(
        `Node reporter emitted a malformed event on line ${lineNumber + 1}`,
      );
    }

    const data = event.data;

    if (event.type === 'test:enqueue') {
      if (
        !Number.isInteger(data.nesting) ||
        data.nesting < 0 ||
        typeof data.name !== 'string' ||
        !Number.isInteger(data.testId)
      ) {
        throw new Error(
          `Node reporter emitted a malformed enqueue on line ${lineNumber + 1}`,
        );
      }

      if (enqueued.has(data.testId)) {
        throw new Error(`Node reporter enqueued id ${data.testId} twice`);
      }

      // Node 24 can label shimmed `it()` enqueue events as `suite`; the
      // terminal event's details.type is authoritative.
      const queued = {
        id: data.testId,
        nesting: data.nesting,
        name: data.name,
      };
      enqueued.set(data.testId, queued);
    } else if (event.type === 'test:complete') {
      if (
        !Number.isInteger(data.testId) ||
        !['suite', 'test'].includes(data.details?.type)
      ) {
        throw new Error(
          `Node reporter emitted a malformed terminal event for id ${data.testId}`,
        );
      }

      if (!enqueued.has(data.testId)) {
        throw new Error(`Node reporter completed unknown id ${data.testId}`);
      }

      if (completed.has(data.testId)) {
        throw new Error(`Node reporter completed id ${data.testId} twice`);
      }

      completed.set(data.testId, data);
      eventOrder.push({ type: 'complete', data });
    } else if (event.type === 'test:start') {
      if (
        !Number.isInteger(data.testId) ||
        !Number.isInteger(data.nesting) ||
        data.nesting < 0 ||
        typeof data.name !== 'string' ||
        !enqueued.has(data.testId)
      ) {
        throw new Error(
          `Node reporter emitted a malformed start event for id ${data.testId}`,
        );
      }

      eventOrder.push({ type: 'start', data });
    } else if (event.type === 'test:summary') {
      if (summary != null) {
        throw new Error('Node reporter emitted more than one test summary');
      }

      summary = data;
    }
  }

  if (summary == null || summary.counts == null) {
    throw new Error('Node reporter did not emit a test summary');
  }

  if (completed.size !== enqueued.size) {
    const missing = [...enqueued.keys()].filter((id) => !completed.has(id));
    throw new Error(
      `Node reporter left enqueued ids without outcomes: ${missing.join(', ')}`,
    );
  }

  const suiteSkips = [];
  const outcomes = [];
  const suiteStack = [];
  const started = new Set();
  const suiteRecords = new Map();

  for (const event of eventOrder) {
    const { data } = event;
    const queued = enqueued.get(data.testId);
    const terminal = completed.get(data.testId);

    if (event.type === 'start') {
      if (started.has(data.testId)) {
        throw new Error(`Node reporter started id ${data.testId} twice`);
      }

      if (data.name !== queued.name || data.nesting !== queued.nesting) {
        throw new Error(
          `Node reporter start disagrees with enqueue for id ${data.testId}`,
        );
      }

      const suitePath = suiteStack.slice(0, data.nesting);

      if (
        suitePath.length !== data.nesting ||
        suitePath.some((part) => part == null)
      ) {
        throw new Error(
          `Node reporter has no complete parent path for ${JSON.stringify(data.name)}`,
        );
      }

      started.add(data.testId);

      if (terminal.details.type === 'suite') {
        const occurrenceKey = JSON.stringify([
          suitePath.map(({ name, occurrence }) => [name, occurrence]),
          data.name,
        ]);
        const occurrence = (suiteOccurrences.get(occurrenceKey) ?? 0) + 1;
        suiteOccurrences.set(occurrenceKey, occurrence);
        const segment = { name: data.name, occurrence, id: data.testId };
        const record = {
          identity: makeIdentity(file, suitePath, data.name, 'suite'),
          file,
          suitePath: [...suitePath, segment],
          name: data.name,
        };
        suiteStack.length = data.nesting;
        suiteStack[data.nesting] = segment;
        suiteRecords.set(data.testId, record);

        if (terminal.skip === true) {
          suiteSkips.push({ ...record, status: 'skipped-suite' });
        }
      } else {
        const failureType = terminal.details.error?.failureType;
        const status =
          terminal.skip === true
            ? 'skipped'
            : terminal.todo === true
              ? 'todo'
              : failureType === 'cancelledByParent'
                ? 'cancelled'
                : terminal.details.passed === true
                  ? 'passed'
                  : 'failed';

        outcomes.push({
          identity: makeIdentity(file, suitePath, data.name),
          file,
          name: data.name,
          suitePath,
          status,
          failureType,
          message: terminal.formattedError ?? '',
        });
      }
    } else if (terminal.details.type === 'suite') {
      const record = suiteRecords.get(data.testId);

      if (record == null || suiteStack[data.nesting]?.id !== data.testId) {
        throw new Error(
          `Node reporter completed suite id ${data.testId} outside its active parent path`,
        );
      }

      suiteStack.length = data.nesting;
    }
  }

  const missingStarts = [...enqueued.keys()].filter((id) => !started.has(id));

  if (missingStarts.length > 0) {
    throw new Error(
      `Node reporter completed ids without start events: ${missingStarts.join(', ')}`,
    );
  }

  if (outcomes.length !== summary.counts.tests) {
    throw new Error(
      `Node reporter summary counted ${summary.counts.tests} tests, but emitted ${outcomes.length} terminal test identities`,
    );
  }

  const allOutcomes = addOrdinals([...outcomes, ...suiteSkips]);
  const totals = countStatuses(allOutcomes);

  if (
    totals.passed !== summary.counts.passed ||
    totals.failed !== summary.counts.failed ||
    totals.skipped !== (summary.counts.skipped ?? 0) ||
    totals.cancelled !== summary.counts.cancelled ||
    totals.todo !== (summary.counts.todo ?? 0)
  ) {
    throw new Error(
      `Node reporter summary disagrees with terminal outcomes: summary ${JSON.stringify(summary.counts)}, leaves ${JSON.stringify(totals)}`,
    );
  }

  return { outcomes: allOutcomes, summary: summary.counts, totals };
};

/** Parse Bun's JUnit output, rejecting incomplete or internally inconsistent reports. */
export const parseBunJunit = (text, wrapperToSource) => {
  const root = parseXml(text);

  if (root.name !== 'testsuites') {
    throw new Error('Bun JUnit report root is not <testsuites>');
  }

  const suites = descendants(root, 'testsuite');
  const cases = descendants(root, 'testcase');
  const testcases = [];
  const suiteOccurrences = new Map();
  const sourceToWrapper = new Map(
    [...wrapperToSource].map(([wrapper, source]) => [source, resolve(wrapper)]),
  );
  // keyed by resolved path, as the lookups below are: on Windows resolve()
  // turns `/tmp/…` into `D:\tmp\…` (round 151)
  const sourceOf = new Map(
    [...wrapperToSource].map(([wrapper, source]) => [resolve(wrapper), source]),
  );

  if (root.attrs.tests == null) {
    throw new Error('Bun JUnit testsuites root is missing its test count');
  }

  const collectCases = (node, suitePath = [], inheritedFile = null) => {
    let currentPath = suitePath;
    let currentFile = inheritedFile;

    if (node.name === 'testsuite') {
      const isWrapperSuite = suitePath.length === 0 && inheritedFile == null;

      if (isWrapperSuite) {
        if (node.attrs.file == null) {
          throw new Error('Bun JUnit wrapper testsuite is missing its file');
        }

        currentFile = sourceOf.get(resolve(node.attrs.file));

        if (currentFile == null) {
          throw new Error(
            `Bun JUnit suite came from an unknown wrapper: ${node.attrs.file}`,
          );
        }
      } else {
        if (
          node.attrs.file != null &&
          resolve(node.attrs.file) !== sourceToWrapper.get(inheritedFile)
        ) {
          throw new Error(
            `Bun JUnit nested suite points to a different wrapper: ${node.attrs.file}`,
          );
        }

        if (typeof node.attrs.name !== 'string') {
          throw new Error('Bun JUnit testsuite is missing its name');
        }

        const parentKey = JSON.stringify([
          currentFile,
          suitePath.map(({ name, occurrence }) => [name, occurrence]),
        ]);
        const occurrenceKey = JSON.stringify([parentKey, node.attrs.name]);
        const occurrence = (suiteOccurrences.get(occurrenceKey) ?? 0) + 1;
        suiteOccurrences.set(occurrenceKey, occurrence);
        currentPath = [...suitePath, { name: node.attrs.name, occurrence }];
      }
    }

    if (node.name === 'testcase') {
      const attrs = node.attrs;

      if (
        typeof attrs.name !== 'string' ||
        typeof attrs.classname !== 'string' ||
        typeof attrs.file !== 'string'
      ) {
        throw new Error(
          'Bun JUnit testcase is missing its name, classname or file',
        );
      }

      const file = sourceOf.get(resolve(attrs.file));

      if (file == null || (currentFile != null && currentFile !== file)) {
        throw new Error(
          `Bun JUnit testcase came from an unknown or inconsistent wrapper: ${attrs.file}`,
        );
      }

      const treePath = currentPath.map(({ name }) => name);
      const expectedClassname = treePath.slice().reverse().join(' > ');

      if (attrs.classname !== expectedClassname) {
        throw new Error(
          `Bun JUnit classname disagrees with XML suite nesting for ${file}: expected ${JSON.stringify(expectedClassname)}, got ${JSON.stringify(attrs.classname)}`,
        );
      }

      const skippedNodes = descendants(node, 'skipped');
      const failureNodes = [
        ...descendants(node, 'failure'),
        ...descendants(node, 'error'),
      ];
      const skipped = skippedNodes.length > 0;

      if (skipped && failureNodes.length > 0) {
        throw new Error(
          `Bun JUnit testcase is both skipped and failed: ${attrs.name}`,
        );
      }

      const status = skipped
        ? 'skipped'
        : failureNodes.length > 0
          ? 'failed'
          : 'passed';
      const failure = failureNodes[0];
      const failureMessage =
        failure == null
          ? ''
          : [failure.attrs.message, textContent(failure)]
              .filter(Boolean)
              .join('\n');
      const captured = [
        ...descendants(node, 'system-out'),
        ...descendants(node, 'system-err'),
      ]
        .map(textContent)
        .filter(Boolean);

      testcases.push({
        identity: makeIdentity(file, currentPath, attrs.name),
        file,
        name: attrs.name,
        suitePath: currentPath,
        status,
        failureType: failure?.name ?? null,
        message: [failureMessage, ...captured].filter(Boolean).join('\n'),
      });
    }

    for (const child of node.children) {
      collectCases(child, currentPath, currentFile);
    }
  };

  collectCases(root);

  if (cases.length !== testcases.length) {
    throw new Error(
      `Bun JUnit parser found ${testcases.length} of ${cases.length} testcases`,
    );
  }

  const failed = testcases.filter(({ status }) => status === 'failed').length;
  const skipped = testcases.filter(({ status }) => status === 'skipped').length;
  checkAggregate(root, 'tests', testcases.length, 'root');
  checkAggregate(root, 'failures', failed, 'root');
  checkAggregate(root, 'errors', descendants(root, 'error').length, 'root');
  checkAggregate(root, 'skipped', skipped, 'root');

  for (const suite of suites) {
    const nestedCases = descendants(suite, 'testcase');
    const nestedFailed = nestedCases.filter(
      (testcase) =>
        descendants(testcase, 'failure').length > 0 ||
        descendants(testcase, 'error').length > 0,
    ).length;
    const nestedSkipped = nestedCases.filter(
      (testcase) => descendants(testcase, 'skipped').length > 0,
    ).length;

    checkAggregate(
      suite,
      'tests',
      nestedCases.length,
      `suite ${suite.attrs.name}`,
    );
    checkAggregate(
      suite,
      'failures',
      nestedFailed,
      `suite ${suite.attrs.name}`,
    );
    checkAggregate(
      suite,
      'errors',
      nestedCases.filter(
        (testcase) => descendants(testcase, 'error').length > 0,
      ).length,
      `suite ${suite.attrs.name}`,
    );
    checkAggregate(
      suite,
      'skipped',
      nestedSkipped,
      `suite ${suite.attrs.name}`,
    );
  }

  return addOrdinals(testcases);
};

export const countStatuses = (outcomes) => {
  const totals = {
    tests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    cancelled: 0,
    todo: 0,
    'skipped-suite': 0,
  };

  for (const { status } of outcomes) {
    if (!(status in totals)) {
      throw new Error(`unknown test outcome status ${status}`);
    }

    if (status !== 'skipped-suite') {
      totals.tests += 1;
    }

    totals[status] += 1;
  }

  return totals;
};

/** Fail closed when a discovered Bun wrapper produces no passing leaf. */
export const assertFilesHavePassingTests = (outcomes, expectedFiles, label) => {
  const counts = new Map(expectedFiles.map((file) => [file, 0]));

  if (counts.size !== expectedFiles.length) {
    throw new Error(`${label} discovery contains duplicate source files`);
  }

  for (const outcome of outcomes) {
    if (!counts.has(outcome.file)) {
      throw new Error(
        `${label} emitted a test for undiscovered file ${outcome.file}`,
      );
    }

    if (outcome.status !== 'passed') {
      throw new Error(
        `${label} has an unreviewed ${outcome.status} outcome: ${outcome.identity?.display ?? outcome.file}`,
      );
    }

    counts.set(outcome.file, counts.get(outcome.file) + 1);
  }

  const empty = [...counts]
    .filter(([, count]) => count === 0)
    .map(([file]) => file);

  if (empty.length > 0) {
    throw new Error(
      `${label} produced no terminal test identity for discovered file(s): ${empty.join(', ')}`,
    );
  }

  return counts;
};

export const compareTestResults = (
  nodeResults,
  bunResults,
  expectedSkipKeys = [],
) => {
  const nodeFiles = nodeResults.files.map(({ file }) => file).sort();
  const bunFiles = bunResults.files.map(({ file }) => file).sort();

  if (JSON.stringify(nodeFiles) !== JSON.stringify(bunFiles)) {
    throw new Error(
      `discovered file sets differ: Node ${nodeFiles.length}, Bun ${bunFiles.length}`,
    );
  }

  const nodeOutcomes = nodeResults.files.flatMap(({ outcomes }) => outcomes);
  const bunOutcomes = bunResults.files.flatMap(({ outcomes }) => outcomes);
  const allowedSkipKeys = new Set(expectedSkipKeys);
  const nodeSkipSuites = nodeOutcomes.filter(
    ({ status }) => status === 'skipped-suite',
  );
  const remainingBun = [...bunOutcomes];
  const normalizedNode = nodeOutcomes.filter(
    ({ status }) => status !== 'skipped-suite',
  );
  let bunSkippedLeavesNormalized = 0;

  for (const suiteSkip of nodeSkipSuites) {
    const descendants = remainingBun.filter(
      ({ file, suitePath }) =>
        file === suiteSkip.file &&
        suitePath.length >= suiteSkip.suitePath.length &&
        suiteSkip.suitePath.every(
          (part, index) =>
            suitePath[index]?.name === part.name &&
            suitePath[index]?.occurrence === part.occurrence,
        ),
    );

    if (descendants.some(({ status }) => status !== 'skipped')) {
      throw new Error(
        `Bun ran a descendant of Node-skipped suite ${suiteSkip.identity.display}`,
      );
    }

    if (descendants.length === 0) {
      throw new Error(
        `Bun reported no skipped descendants for Node-skipped suite ${suiteSkip.identity.display}`,
      );
    }

    bunSkippedLeavesNormalized += descendants.length;

    for (const descendant of descendants) {
      remainingBun.splice(remainingBun.indexOf(descendant), 1);
    }

    remainingBun.push({ ...suiteSkip });
  }

  const nodeLeafSkips = normalizedNode.filter(
    ({ status }) => status === 'skipped',
  );
  const bunLeafSkips = remainingBun.filter(
    ({ status }) => status === 'skipped',
  );
  const nodeTodo = normalizedNode.filter(({ status }) => status === 'todo');
  const bunTodo = remainingBun.filter(({ status }) => status === 'todo');
  const bunSkipSuites = remainingBun.filter(
    ({ status }) => status === 'skipped-suite',
  );

  for (const [label, outcomes] of [
    ['Node skipped', nodeLeafSkips],
    ['Bun skipped', bunLeafSkips],
    ['Node todo', nodeTodo],
    ['Bun todo', bunTodo],
    ['Node skipped suite', nodeSkipSuites],
  ]) {
    for (const outcome of outcomes) {
      if (!allowedSkipKeys.has(outcome.identity.key)) {
        throw new Error(
          `${label} outcome is not in the reviewed expected-skip set: ${outcome.identity.display}`,
        );
      }
    }
  }

  const nonPassKey = ({ identity, status }) => `${identity.key}\u0000${status}`;
  const nonPassNode = [...nodeLeafSkips, ...nodeTodo, ...nodeSkipSuites]
    .map(nonPassKey)
    .sort();
  const nonPassBun = [...bunLeafSkips, ...bunTodo, ...bunSkipSuites]
    .map(nonPassKey)
    .sort();

  if (JSON.stringify(nonPassNode) !== JSON.stringify(nonPassBun)) {
    throw new Error(
      'Node and Bun skip/todo identities or normalized suite-skip counts differ',
    );
  }

  const nodeCompared = normalizedNode.filter(
    ({ status }) =>
      status !== 'skipped' && status !== 'todo' && status !== 'skipped-suite',
  );
  const bunCompared = remainingBun.filter(
    ({ status }) =>
      status !== 'skipped' && status !== 'todo' && status !== 'skipped-suite',
  );
  const keyOf = ({ identity, status }) => `${identity.key}\u0000${status}`;
  const sorted = (outcomes) => outcomes.map(keyOf).sort();
  const nodeKeys = sorted(nodeCompared);
  const bunKeys = sorted(bunCompared);

  if (JSON.stringify(nodeKeys) !== JSON.stringify(bunKeys)) {
    const nodeSet = new Set(nodeKeys);
    const bunSet = new Set(bunKeys);
    const missingFromBun = nodeCompared
      .filter((outcome) => !bunSet.has(keyOf(outcome)))
      .map(({ identity, status }) => `${status}: ${identity.display}`);
    const missingFromNode = bunCompared
      .filter((outcome) => !nodeSet.has(keyOf(outcome)))
      .map(({ identity, status }) => `${status}: ${identity.display}`);
    throw new Error(
      `test identity/outcome mismatch\nmissing from Bun: ${missingFromBun.join('\n')}\nmissing from Node: ${missingFromNode.join('\n')}`,
    );
  }

  return {
    tests: nodeCompared.length,
    files: nodeFiles.length,
    normalizedSuiteSkips: nodeSkipSuites.length,
    bunNormalizedSuiteSkips: bunSkipSuites.length,
    bunSkippedLeavesNormalized,
    allowedLeafSkips: nodeLeafSkips.length,
    allowedTodo: nodeTodo.length,
  };
};
