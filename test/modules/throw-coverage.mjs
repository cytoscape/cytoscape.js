import {
  audit,
  BROWSER_ONLY,
  bunRunFailureDetails,
  gateFailures,
  MISATTRIBUTED,
  parseLcov,
  UNREACHABLE,
} from '../../scripts/throw-coverage.mjs';
import {
  instrumentThrowSource,
  parseThrowProbeLog,
} from '../../scripts/throw-site-probe.mjs';
import { expect } from 'chai';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/*
Round 30.4: the error-contract measurement tool, checked against a
hand-written lcov report.

The tool was a reporting script when these specs were written (a coverage floor
was a policy call, held in PLAN.md's open calls) and became a **gate** in round
37.1.  Either way its *parser* is the thing every number it prints depends on,
and the round it comes from exists because the first version of this
measurement was silently wrong.  So the parser is pinned here rather than
trusted — and now that a build fails on what it says, more so.

`audit( lcovText )` reads real src sources and only takes the line counts
from the report, so the fixture names real files and real throw lines.
*/

/*
The fixture has to name *real* throw lines in *real* files, since `audit()`
reads the sources and takes only the counts from the report.  It resolves them
by searching rather than writing them down, which is round 34's lesson applied
to this spec's own fixture: a `file:line` in a comment goes stale the moment
anything above it moves.  These three were `874`, `1031` and `1074` until round
37.2 deleted one line from style.mts's shape table, at which point three specs
failed for no reason of their own — the same drift the round-37.1 gate now
catches in the allowlists, arriving here instead.

`anchor` is a line unique enough to find; the line reported is the first
`throw new` at or after it, because a multi-line throw carries its message
below the keyword.
*/
const throwLine = (file, anchor) => {
  const lines = readFileSync(
    new URL(`../../${file}`, import.meta.url),
    'utf8',
  ).split('\n');
  const from = lines.findIndex((l) => l.includes(anchor));

  expect(from, `no line of ${file} contains ${anchor}`).to.be.at.least(0);

  const at = lines.findIndex((l, i) => i >= from && l.includes('throw new'));

  expect(at, `no throw follows ${anchor} in ${file}`).to.be.at.least(0);

  return at + 1; // lcov lines are 1-based
};

// two guards of the style parsers' hundreds stand in for "covered" and
// "never run" (round 130 moved the parsers to `src/style/parse.mts`)
const PARSE = 'src/style/parse.mts';
const KEYWORD_GUARD = throwLine(PARSE, 'const parseKeyword =');
const PERCENT_GUARD = throwLine(PARSE, 'is not a valid percent for');
const IMAGE_ENUM_GUARD = throwLine(PARSE, 'const parseImageEnum =');
const EMPTY_EXPORT_GUARD = throwLine(
  'src/render/renderer/export-view.mts',
  'Cannot export a full-graph image',
);
const BIG_ENDIAN_GUARD = throwLine('src/wire.mts', 'little-endian');
const MULTILINE_GUARD = throwLine(
  'src/style/engine-sheet.mts',
  'if (!SHEET_KEYS.has(key))',
);
const UNTRIGGERED_MULTILINE_GUARD = throwLine(
  'src/style/engine-sheet.mts',
  "if (typeof (sheet as Record<string, unknown>)[key] === 'function')",
);

const lcov = ({ covered = [], dead = [], file = PARSE }) => {
  const rows = [
    ...covered.map((ln) => `DA:${ln},7`),
    ...dead.map((ln) => `DA:${ln},0`),
  ];

  return [
    'TN:',
    `SF:${file}`,
    ...rows,
    `LF:${rows.length}`,
    `LH:${covered.length}`,
    'end_of_record',
    '',
  ].join('\n');
};

const allSites = audit(lcov({})).sites;
const completeReport = (deadSites = []) => {
  const dead = new Set(deadSites);
  const byFile = new Map();

  for (const site of allSites) {
    const lines = byFile.get(site.file) ?? [];
    lines.push(
      `DA:${site.line},${dead.has(`${site.file}:${site.line}`) ? 0 : 1}`,
    );
    byFile.set(site.file, lines);
  }

  return [...byFile]
    .map(([file, lines]) => {
      const hits = lines.filter((line) => !line.endsWith(',0')).length;
      return `TN:\nSF:${file}\n${lines.join('\n')}\nLF:${lines.length}\nLH:${hits}\nend_of_record\n`;
    })
    .join('');
};

const fullAudit = (deadSites = []) => audit(completeReport(deadSites));

describe('scripts/throw-coverage', function () {
  it('keeps bounded JUnit and process details when a Bun pass fails', function () {
    const dir = mkdtempSync(join(tmpdir(), 'throw-failure-control-'));
    const report = join(dir, 'failed.xml');

    try {
      writeFileSync(
        report,
        '<testsuites tests="1" failures="1"><testsuite>' +
          '<testcase name="bad control" classname="control">' +
          '<failure message="Expected 2, got 1">Error: stack frame</failure>' +
          '</testcase></testsuite></testsuites>',
      );
      const details = bunRunFailureDetails(
        'Bun exact probe',
        {
          status: 1,
          stdout: `discarded prefix\n${'x'.repeat(8_000)} stdout tail`,
          stderr: 'stderr detail',
        },
        report,
      );

      expect(details).to.contain('Bun exact probe failed (exit 1)');
      expect(details).to.contain('control > bad control');
      expect(details).to.contain('Expected 2, got 1');
      expect(details).to.contain('Error: stack frame');
      expect(details).to.contain('stdout tail:');
      expect(details).to.contain('stderr detail');
      expect(details).to.not.contain('discarded prefix');
      expect(details.length).to.be.lessThan(10_000);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reads a source-mapped lcov report and classifies each throw', function () {
    const result = audit(
      lcov({ covered: [KEYWORD_GUARD], dead: [PERCENT_GUARD] }),
    );
    const at = (file, line) =>
      result.sites.find((s) => s.file === file && s.line === line);

    expect(at(PARSE, KEYWORD_GUARD).covered).to.equal(true);
    expect(at(PARSE, PERCENT_GUARD).covered).to.equal(false);

    // and a throw the report says nothing about is unknown, not covered
    expect(at(PARSE, IMAGE_ENUM_GUARD).covered).to.equal(null);
  });

  it('maps multiline .mts guards by their original LCOV line, including an untouched neighbor', function () {
    const file = 'src/style/engine-sheet.mts';
    const report = [
      lcov({ covered: [MULTILINE_GUARD, MULTILINE_GUARD + 1], file }),
      lcov({ dead: [UNTRIGGERED_MULTILINE_GUARD], file }),
    ].join('');
    const result = audit(report, 'Bun');
    const find = (line) =>
      result.sites.find((site) => site.file === file && site.line === line);

    expect(find(MULTILINE_GUARD).covered).to.equal(true);
    expect(find(UNTRIGGERED_MULTILINE_GUARD).covered).to.equal(false);
    expect(result.runtime).to.equal('Bun');
  });

  it('instruments multiline throw sites without changing their source lines or text', function () {
    const file = 'src/style/engine-sheet.mts';
    const source = readFileSync(
      new URL(`../../${file}`, import.meta.url),
      'utf8',
    );
    const lines = source.split('\n');
    const expectedSites = lines.flatMap((line, index) =>
      line.includes('throw new') ? [`${file}:${index + 1}`] : [],
    );
    const transformed = instrumentThrowSource(file, source, expectedSites);

    expect(transformed.contents.split('\n').length).to.equal(lines.length);
    expect(transformed.sites).to.include(`${file}:${MULTILINE_GUARD}`);
    expect(transformed.sites).to.include(
      `${file}:${UNTRIGGERED_MULTILINE_GUARD}`,
    );
    expect(transformed.contents.split('\n')[MULTILINE_GUARD - 1]).to.contain(
      'throw new Error(',
    );
    expect(transformed.contents).to.contain(
      "Unknown stylesheet key '${key}'; supported keys: nodes, edges, parents, core, bypasses",
    );
  });

  it('wraps an unbraced throw without changing its control flow', function () {
    const file = 'src/control-probe.mts';
    const original =
      'function run(flag) {\nlet reached = false;\nif (flag) throw new Error("guard");\nreached = true;\nreturn reached;\n}\n';
    const transformed = instrumentThrowSource(file, original, [`${file}:3`]);
    const observed = [];
    const previous = globalThis.__cyThrowProbe;

    globalThis.__cyThrowProbe = (site) => observed.push(site);

    try {
      const execute = new Function(`${transformed.contents}\nreturn run;`)();

      expect(execute(false)).to.equal(true);
      expect(observed).to.deep.equal([]);
      expect(() => execute(true)).to.throw('guard');
      expect(observed).to.deep.equal([`${file}:3`]);
    } finally {
      if (previous === undefined) {
        delete globalThis.__cyThrowProbe;
      } else {
        globalThis.__cyThrowProbe = previous;
      }
    }
  });

  it('uses exact Bun site hits and fails closed for missing, malformed or stale records', function () {
    const file = 'src/style/engine-sheet.mts';
    const triggered = `${file}:${MULTILINE_GUARD}`;
    const untouched = `${file}:${UNTRIGGERED_MULTILINE_GUARD}`;
    const expected = [triggered, untouched];
    const record = (kind, site, realm = 'main') =>
      JSON.stringify({ kind, site, realm });
    const parsed = parseThrowProbeLog(
      [
        record('instrumented', triggered),
        record('instrumented', untouched),
        record('instrumented', triggered, 'worker'),
        record('hit', triggered),
        record('hit', triggered, 'worker'),
      ].join('\n'),
      expected,
    );
    const result = audit(
      lcov({ covered: [MULTILINE_GUARD, UNTRIGGERED_MULTILINE_GUARD], file }),
      'Bun',
      parsed,
    );
    const siteAt = (line) =>
      result.sites.find((site) => site.file === file && site.line === line);

    expect(siteAt(MULTILINE_GUARD).covered).to.equal(true);
    expect(parsed.hitRealms.get(triggered)).to.deep.equal(
      new Set(['main', 'worker']),
    );
    expect(parsed.instrumentedRealms.get(triggered)).to.deep.equal(
      new Set(['main', 'worker']),
    );
    expect(siteAt(MULTILINE_GUARD).nativeCovered).to.equal(true);
    expect(siteAt(UNTRIGGERED_MULTILINE_GUARD).covered).to.equal(false);
    expect(siteAt(UNTRIGGERED_MULTILINE_GUARD).nativeCovered).to.equal(true);
    expect(result.dead).to.include(siteAt(UNTRIGGERED_MULTILINE_GUARD));

    expect(() => parseThrowProbeLog('{bad json', expected)).to.throw(
      'malformed throw-probe record',
    );
    expect(() =>
      parseThrowProbeLog(
        JSON.stringify({ kind: 'hit', site: triggered, realm: 'unknown' }),
        expected,
      ),
    ).to.throw('invalid throw-probe record');
    expect(() =>
      parseThrowProbeLog(record('hit', triggered), expected),
    ).to.throw('no instrumentation record');
    expect(() =>
      parseThrowProbeLog(record('instrumented', `${file}:999999`), expected),
    ).to.throw('unknown or stale site');

    const missing = parseThrowProbeLog(
      record('instrumented', triggered),
      expected,
    );
    const missingResult = audit(
      lcov({ covered: [MULTILINE_GUARD], file }),
      'Bun',
      missing,
    );
    const missingSite = missingResult.sites.find(
      (site) => site.file === file && site.line === UNTRIGGERED_MULTILINE_GUARD,
    );

    expect(missingSite.covered).to.equal(null);
    expect(missingResult.unknown).to.include(missingSite);
    expect(
      gateFailures(missingResult).some((failure) =>
        failure.includes('coverage unknown'),
      ),
    ).to.equal(true);
  });

  it('rejects malformed, escaped or truncated LCOV source records', function () {
    expect(() => parseLcov('DA:1,1')).to.throw('before a source path');
    expect(() =>
      parseLcov('SF:../outside.mts\nDA:1,1\nend_of_record'),
    ).to.throw('escapes the repository');
    expect(() => parseLcov('SF:src/style/parse.mts\nDA:1,1')).to.throw(
      'missing end_of_record',
    );
    expect(() =>
      parseLcov('SF:src/style/parse.mts\nDA:nope\nend_of_record'),
    ).to.throw('malformed lcov line');
    expect(() =>
      parseLcov('SF:src/style/parse.mts\nDA:1,1\nLF:2\nLH:1\nend_of_record'),
    ).to.throw('declares 2 lines');
    expect(() =>
      parseLcov(
        'SF:/tmp/generated-wrapper.mjs\nDA:1,1\nLF:1\nLH:1\nend_of_record',
      ),
    ).to.not.throw();
  });

  it('counts only Node-reachable sites as dead', function () {
    // three never-run throws, one per classification
    const report = [
      lcov({ dead: [KEYWORD_GUARD] }),
      lcov({
        dead: [EMPTY_EXPORT_GUARD],
        file: 'src/render/renderer/export-view.mts',
      }),
      lcov({ dead: [BIG_ENDIAN_GUARD], file: 'src/wire.mts' }),
    ].join('');
    const result = audit(report);
    const isDead = (file, line) =>
      result.dead.some((s) => s.file === file && s.line === line);

    expect(isDead(PARSE, KEYWORD_GUARD)).to.equal(true);
    expect(
      isDead('src/render/renderer/export-view.mts', EMPTY_EXPORT_GUARD),
    ).to.equal(false); // browser
    expect(isDead('src/wire.mts', BIG_ENDIAN_GUARD)).to.equal(false); // unreachable

    expect(result.browser).to.be.greaterThan(0);
    expect(result.unreachable).to.equal(Object.keys(UNREACHABLE).length);
  });

  it('classifies a browser-file site that is also unreachable as unreachable', function () {
    // Round 36.4: three of the browser tier's unpinned sites are guards
    // no input reaches (a shadowed check, a column-id invariant, a
    // write-kind invariant), so they moved to UNREACHABLE while staying
    // in a BROWSER_ONLY directory.  The two tallies then double-counted
    // them and summed past the site total — which is how it was noticed,
    // and is what this pins.
    const result = audit(lcov({}));
    const both = Object.keys(UNREACHABLE).filter((at) =>
      BROWSER_ONLY.some((prefix) => at.startsWith(prefix)),
    );

    expect(
      both.length,
      'no site is in both lists; this spec is vacuous',
    ).to.be.greaterThan(0);

    // the tallies partition: their sum is the number of *distinct* sites
    // in either category, so a site in both is counted once
    const unrun = result.sites.filter((s) => s.covered !== true);
    const distinct = new Set([
      ...unrun.filter((s) => s.browser),
      ...unrun.filter((s) => s.unreachable != null),
    ]);

    expect(result.browser + result.unreachable + result.misattributed).to.equal(
      distinct.size,
    );

    // and --verbose labels them the same way the tally counts them
    for (const at of both) {
      const [file, line] = [
        at.slice(0, at.lastIndexOf(':')),
        Number(at.slice(at.lastIndexOf(':') + 1)),
      ];
      const site = result.sites.find((s) => s.file === file && s.line === line);

      expect(
        site,
        `${at} is listed in UNREACHABLE but is not a throw site`,
      ).to.not.equal(undefined);
      expect(site.unreachable).to.be.a('string');
    }
  });

  it('reports a throw the lcov says nothing about as unknown, never as dead', function () {
    // the distinction matters: "no data" means the file never loaded, which
    // is a different problem from "loaded and never reached"
    const result = audit(lcov({}));

    expect(result.sites.every((s) => s.covered !== true)).to.equal(true);
    expect(result.dead.length).to.equal(0);
    expect(result.unknown.length).to.be.greaterThan(0);
  });

  it('overrides the known-misattributed site rather than counting it covered', function () {
    // exportScale's body reads as the module-evaluation count, so the raw
    // report claims this line runs in Node.  It cannot: there is no renderer.
    const [file, line] = Object.keys(MISATTRIBUTED)[0].split(':');
    const result = audit(lcov({ covered: [Number(line)], file }));
    const site = result.sites.find(
      (s) => s.file === file && s.line === Number(line),
    );

    expect(site.covered).to.equal(null);
    expect(site.misattributed).to.be.a('string');
    expect(result.dead).to.not.include(site); // still browser, not a gap
    expect(result.unknown).to.not.include(site); // explicit maintained classification
  });

  it('finds a throw in every audited file it claims to scan', function () {
    const result = audit(lcov({}));
    const files = new Set(result.sites.map((s) => s.file));

    expect(result.sites.length).to.be.greaterThan(100);
    expect(files.has(PARSE)).to.equal(true);
    expect(files.has('src/core.mts')).to.equal(true);

    // the browser prefixes are matched against repo-relative paths: every
    // site under one is classified browser, and at least one prefix matches
    // (src/interact/ holds no throws today — the prefix is there so its
    // first one is classified correctly rather than read as a Node gap)
    const under = result.sites.filter((s) =>
      BROWSER_ONLY.some((p) => s.file.startsWith(p)),
    );

    expect(under.length).to.be.greaterThan(0);
    expect(under.every((s) => s.browser)).to.equal(true);
    expect(result.sites.filter((s) => s.browser).length).to.equal(under.length);
  });

  /*
  Round 37.1: the measurement became a gate, at the zero-tolerance floor the
  fifth design sitting chose.  These are the 31.2 controls — each of the three
  ways the gate could stop meaning anything, staged and asserted to fail.

  Note what a spec cannot do here: `npm run test:throws` re-runs the whole Node
  suite under coverage, so the *live* reading is not something a unit spec can
  take.  What it can take is everything the reading is interpreted through —
  the failure rule and the allowlists — which is where the silent failures
  live anyway.
  */
  describe('the gate (round 37.1)', function () {
    it('fails when a reachable throw has no spec', function () {
      // "a spec deleted", staged on the shared keyword-enum guard
      const failures = gateFailures(fullAudit([`${PARSE}:${KEYWORD_GUARD}`]));

      expect(failures).to.have.lengthOf(1);
      expect(failures[0]).to.contain(`${PARSE}:${KEYWORD_GUARD}`);
      expect(failures[0]).to.contain('never run');
    });

    it('passes when the same site has one', function () {
      expect(gateFailures(fullAudit())).to.deep.equal([]);
    });

    it('fails closed when a reachable throw has unknown coverage', function () {
      const baseline = fullAudit();
      const target = baseline.sites.find(
        (site) => site.file === PARSE && site.line === IMAGE_ENUM_GUARD,
      );
      const failures = gateFailures({
        ...baseline,
        unknown: [{ ...target, covered: null }],
      });

      expect(failures).to.have.lengthOf(1);
      expect(failures[0]).to.contain(`${PARSE}:${IMAGE_ENUM_GUARD}`);
      expect(failures[0]).to.contain('coverage unknown');
    });

    it('fails when an allowlist entry no longer names a throw site', function () {
      // the round-34 failure mode, now caught in its own right: an insertion
      // above an exempted site moves it, and the entry silently re-points at
      // whatever line landed there.  Under a zero-tolerance gate that is an
      // exemption granted to the wrong throw.
      const failures = gateFailures(fullAudit(), [
        ['UNREACHABLE', { 'src/style.mts:2': 'a line with no throw on it' }],
      ]);

      expect(failures).to.have.lengthOf(1);
      expect(failures[0]).to.contain('src/style.mts:2');
      expect(failures[0]).to.contain('not a throw site');
    });

    it('fails when an allowlist entry carries no reason', function () {
      const at = Object.keys(UNREACHABLE)[0];
      const failures = gateFailures(fullAudit(), [
        ['UNREACHABLE', { [at]: '  ' }],
      ]);

      expect(failures).to.have.lengthOf(1);
      expect(failures[0]).to.contain('no reason');
    });

    it('holds the real allowlists against the real sources', function () {
      // The fast suite uses a complete synthetic report to isolate stale
      // allowlist validation from engine coverage collection.
      expect(gateFailures(fullAudit())).to.deep.equal([]);

      // and it is checking something: both lists are non-empty
      expect(
        Object.keys(UNREACHABLE).length + Object.keys(MISATTRIBUTED).length,
      ).to.be.at.least(4);
    });
  });
});
