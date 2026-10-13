import ts from 'typescript-compiler-api';

const parseSource = (file, source) => {
  const parsed = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  if (parsed.parseDiagnostics.length > 0) {
    throw new Error(
      `could not parse ${file}: ${parsed.parseDiagnostics.length} syntax errors`,
    );
  }

  return parsed;
};

/**
 * Insert a same-line call immediately before each `throw new` statement.
 * Wrapping each throw in a block keeps it one statement when it is the
 * unbraced body of an `if`, loop, or label. No source lines or throw text move.
 */
export const instrumentThrowSource = (file, source, expectedSites = null) => {
  const parsed = parseSource(file, source);
  const statements = [];
  const seen = new Set();

  const visit = (node) => {
    if (ts.isThrowStatement(node) && ts.isNewExpression(node.expression)) {
      const start = node.getStart(parsed);
      const end = node.getEnd();
      const line = parsed.getLineAndCharacterOfPosition(start).line + 1;
      const site = `${file}:${line}`;
      const sourceLine = source.split('\n')[line - 1] ?? '';

      if (!sourceLine.includes('throw new')) {
        throw new Error(`${site} is an AST throw but not a scanned throw site`);
      }
      if (seen.has(site)) {
        throw new Error(
          `${site} has multiple throw-new statements on one line`,
        );
      }

      seen.add(site);
      statements.push({ start, end, site });
    }

    ts.forEachChild(node, visit);
  };

  visit(parsed);

  if (expectedSites != null) {
    const expected = new Set(expectedSites);
    const discovered = new Set(statements.map(({ site }) => site));
    const missing = [...expected].filter((site) => !discovered.has(site));
    const extra = [...discovered].filter((site) => !expected.has(site));

    if (missing.length > 0 || extra.length > 0) {
      throw new Error(
        `throw-site manifest mismatch for ${file}: missing ${missing.join(', ') || 'none'}; extra ${extra.join(', ') || 'none'}`,
      );
    }
  }

  let contents = source;

  for (const { start, end, site } of statements.sort(
    (a, b) => b.start - a.start,
  )) {
    contents = contents.slice(0, end) + '}' + contents.slice(end);
    contents =
      contents.slice(0, start) +
      `{globalThis.__cyThrowProbe(${JSON.stringify(site)}); ` +
      contents.slice(start);
  }

  if (contents.split('\n').length !== source.split('\n').length) {
    throw new Error(
      `throw-site instrumentation changed line count for ${file}`,
    );
  }

  parseSource(file, contents);

  return {
    contents,
    sites: statements.map(({ site }) => site).sort(),
  };
};

/** Parse the append-only log written by the Bun-only preload. */
export const parseThrowProbeLog = (text, expectedSites) => {
  const expected = new Set(expectedSites);
  const instrumented = new Set();
  const instrumentedRealms = new Map();
  const hits = new Map();
  const hitRealms = new Map();
  const ready = new Map();

  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim();

    if (line === '') {
      continue;
    }

    let record;

    try {
      record = JSON.parse(line);
    } catch {
      throw new Error(`malformed throw-probe record on line ${index + 1}`);
    }

    if (
      record == null ||
      typeof record !== 'object' ||
      Array.isArray(record) ||
      !['main', 'worker'].includes(record.realm)
    ) {
      throw new Error(`invalid throw-probe record on line ${index + 1}`);
    }

    if (record.kind === 'ready') {
      if (record.site !== null) {
        throw new Error(
          `invalid throw-probe ready record on line ${index + 1}`,
        );
      }

      ready.set(record.realm, (ready.get(record.realm) ?? 0) + 1);

      continue;
    }

    if (
      !['instrumented', 'hit'].includes(record.kind) ||
      typeof record.site !== 'string'
    ) {
      throw new Error(`invalid throw-probe record on line ${index + 1}`);
    }

    if (!expected.has(record.site)) {
      throw new Error(
        `throw-probe record names unknown or stale site ${record.site}`,
      );
    }

    if (record.kind === 'instrumented') {
      instrumented.add(record.site);
      const realms = instrumentedRealms.get(record.site) ?? new Set();
      realms.add(record.realm);
      instrumentedRealms.set(record.site, realms);
    } else {
      hits.set(record.site, (hits.get(record.site) ?? 0) + 1);
      const realms = hitRealms.get(record.site) ?? new Set();
      realms.add(record.realm);
      hitRealms.set(record.site, realms);
    }
  }

  for (const site of hits.keys()) {
    if (!instrumented.has(site)) {
      throw new Error(
        `throw-probe hit has no instrumentation record for ${site}`,
      );
    }
  }

  return {
    instrumented,
    instrumentedRealms,
    hits,
    hitRealms,
    ready,
    missingInstrumentation: [...expected].filter(
      (site) => !instrumented.has(site),
    ),
  };
};
