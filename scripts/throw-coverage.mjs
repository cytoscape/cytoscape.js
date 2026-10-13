// Measures how much of the v4 GPU prototype's *error contract* the Node and
// Bun public suites actually run (round 30; see PLAN.md's round-30 plan).
//
// v4 fails loudly by decided design — an unknown sheet key, an unknown style
// property, an unknown query key and an unknown boundingBox() option all
// throw, on the reasoning that a typo must not silently do nothing — and a
// throw nothing has ever executed is a contract nobody has checked. This
// script finds every `throw new` in src and reports which ones the Node or
// Bun public suite reaches.
//
// Since round 37.1 it is a **gate**, at the floor the fifth design sitting
// chose: zero tolerance for a reachable site the suite never runs. The
// call it was waiting on (PLAN.md's "Open calls for the maintainer", item 8)
// was taken on 2026-08-04, by which point round 36.4 had already finished the
// browser tier, so the reading was 0 and the gate held the day it was written.
//
// The two classification lists below are what make a zero-tolerance gate
// honest, so they are **maintained allowlists** rather than one-off notes:
// every entry names a real `throw new` line and carries a reason, and the gate
// fails when one stops doing either. That check exists because the keys are
// `file:line` and so move when the code above them moves — round 34 inserted
// two methods into graph-store.mts and the SHAPE_MASK entry silently stopped
// matching. Under a gate, a stale entry is worse than noise: it would quietly
// re-classify whatever line it now lands on.
//
// Two footguns are baked in, both learned the hard way in round 30:
//
//   1. Raw NODE_V8_COVERAGE offsets do not line up with the .mts sources —
//      tsx transpiles before V8 sees the file, so a byte-offset mapping is
//      fiction. Coverage is collected through each test runner's own lcov
//      output, which maps counts back to the original .mts files.
//   2. Line-level (`DA:`) data on a multi-line throw body is sound; the
//      function-level (`FN:`/`FNDA:`) records misattribute one-line arrow
//      functions badly enough to be useless. Nothing here reads them.
//
// Usage:
//   node scripts/throw-coverage.mjs                       # Node suite
//   node scripts/throw-coverage.mjs --runtime=bun         # Bun suite
//   node scripts/throw-coverage.mjs --verbose             # list dead/unknown
//   node scripts/throw-coverage.mjs --lcov cov.lcov       # reuse a report
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  instrumentThrowSource,
  parseThrowProbeLog,
} from './throw-site-probe.mjs';
import {
  assertFilesHavePassingTests,
  parseBunJunit,
} from './runtime-test-results.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC_DIR = join(ROOT, 'src');

const boundedTail = (value, limit = 6_000) => {
  const text = Buffer.isBuffer(value)
    ? value.toString('utf8')
    : String(value ?? '');
  return text.length > limit ? `…${text.slice(-limit)}` : text;
};

export const bunRunFailureDetails = (label, error, junitPath) => {
  const details = [`${label} failed (exit ${error.status ?? 'unknown'})`];

  if (junitPath && existsSync(junitPath)) {
    const report = readFileSync(junitPath, 'utf8');
    const totals = report.match(/<testsuites\b[^>]*>/)?.[0];
    if (totals) {
      details.push(`JUnit ${totals.replace(/[<>]/g, '')}`);
    }

    const failures = [];
    const testcasePattern =
      /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;
    for (const match of report.matchAll(testcasePattern)) {
      const [, attributes, body = ''] = match;
      if (!/<(?:failure|error)\b/.test(body)) continue;
      const attr = (name) =>
        attributes.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? '';
      const failureMessages = [
        ...body.matchAll(/<(?:failure|error)\b([^>]*)\/?\s*>/g),
      ]
        .map(([, attrs]) =>
          attrs
            .match(/\bmessage="([^"]*)"/)?.[1]
            ?.replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&amp;/g, '&'),
        )
        .filter(Boolean);
      const failureBody = body
        .replace(/<failure\b[^>]*>/g, '')
        .replace(/<error\b[^>]*>/g, '')
        .replace(/<\/\s*(?:failure|error)\s*>/g, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
      failures.push(
        `${attr('classname')} > ${attr('name')}: ${boundedTail(
          [...failureMessages, failureBody].filter(Boolean).join(' — '),
          2_000,
        )}`,
      );
    }
    if (failures.length > 0) {
      details.push(`JUnit failures:\n${failures.slice(0, 6).join('\n')}`);
    }
  }

  const stdout = boundedTail(error.stdout);
  const stderr = boundedTail(error.stderr);
  if (stdout.trim()) details.push(`stdout tail:\n${stdout}`);
  if (stderr.trim()) details.push(`stderr tail:\n${stderr}`);
  return details.join('\n');
};

const runBunSuite = (bunBinary, label, args, junitPath, env = process.env) => {
  try {
    return execFileSync(bunBinary, args, {
      cwd: ROOT,
      encoding: 'utf8',
      env,
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    throw new Error(bunRunFailureDetails(label, error, junitPath), {
      cause: error,
    });
  }
};

/**
 * Directories whose throws the Node and Bun suites cannot reach without a
 * GPU device, a canvas or a pointer. Their contract is pinned in the `webgpu`
 * Playwright project instead (round 30.2), so they are reported separately
 * rather than counted as gaps.
 */
export const BROWSER_ONLY = [
  'src/render/',
  'src/interact/',
  'src/gpu-context.mts',
];

/**
 * Throws that exist to make an internal invariant loud and are unreachable
 * from any input a caller can supply. Each is listed with the reason, so the
 * list stays a decision rather than a silence.
 *
 * A **maintained allowlist** since round 37.1: this is the gate's only escape
 * hatch, so `gateFailures` checks that every entry still names a real throw
 * site and still carries a reason.
 */
export const UNREACHABLE = {
  'src/wire.mts:103':
    'big-endian platform guard — every supported platform is little-endian',
  'src/store/patch.mts:677':
    'PatchPayload.miniatureSpecified is created only by toPatchPayload from the payload ids, with length at least memberNodes; columnar and wire converters omit it, so public patch input cannot make this internal mask shorter than the node-member count',
  'src/store/graph-store/layers.mts:219':
    'SHAPE_MASK field invariant — fires only if a shape id is added without widening the field',

  // Round 36.4 classified the browser-only tier the same way 30.4
  // classified the non-browser tier: four of the seven unpinned sites are
  // reachable and now have specs in the `webgpu` project; these three
  // are not, and saying so is better than a spec that fakes its
  // precondition.
  'src/gpu-context.mts:44':
    "shadowed: the full build's attach (index.mts, through factory.mts's " +
    'requireWebGpu) checks navigator.gpu and then ' +
    'constructs the Renderer synchronously, whose ctor calls init() ' +
    'whose first statement reads navigator.gpu again — nothing can run ' +
    'between the two, so no caller can pass one and fail the other',
  'src/render/column-mirror.mts:296':
    'column spec/group mismatch — an internal invariant; every caller ' +
    'passes a ColumnId the mirror was built from, and no public input ' +
    'chooses the id',
  'src/render/gpu-tween.mts:499':
    'geometry write-kind invariant — barred one layer up by the ' +
    'all-or-nothing eligibility rule (round 25.1), which keeps a lane/' +
    'padding/fontSize write off the device by refusing the whole ' +
    'animation; the guard exists so a future eligibility bug is loud',
  'src/layout/flow-order.mts:107':
    'non-positive edge span invariant — ranking always leaves every ' +
    'edge a span of at least its minLen (longest-path enforces it, the ' +
    'simplex preserves feasibility), so no public input reaches a ' +
    'zero-span edge; test/modules/layout-flow-internals.mjs fires it ' +
    'directly with a hand-made ranking so the message stays asserted',
};

// Keys here are `file:line`, which **moves when the file above the site
// moves**.  Round 34 inserted two methods into graph-store.mts and the
// SHAPE_MASK entry silently stopped matching, which surfaced as this
// script reporting a Node-reachable dead site and as a failing spec in
// test/modules/throw-coverage.mjs — the right way round, but worth
// knowing: after moving code, re-run this script rather than assuming
// the classification survived.  Since 37.1 the gate says so directly:
// an entry that no longer names a throw site fails the build in its own
// right, rather than only through the site it stopped exempting.

/**
 * Sites the line-level data reads as covered but that the Node suite cannot
 * run — the measure's known error, kept explicit rather than silently
 * inflating the covered tally.
 *
 * The cause: inside a module-level arrow const, every body line can be
 * attributed to the module-evaluation count rather than to the call, so the
 * whole body reads as run-once-per-import. `exportScale` is such a const, and
 * the throw's line reports the same count as its neighbours and as the
 * declaration.
 *
 * How this list was calibrated, and why it is one entry long: of the 14 throw
 * sites under BROWSER_ONLY, exactly two read as covered, and one of those
 * (`GlyphBuffer.set`) genuinely is — `test/label-render.mjs` drives it
 * with a mock device. The other is this. Treat the tally as a lower bound on
 * dead sites, not an exact count.
 *
 * Maintained on the same terms as `UNREACHABLE` since round 37.1 — an entry
 * here suppresses a *covered* reading, which is the direction that hides work.
 */
export const MISATTRIBUTED = {
  'src/render/renderer/export-view.mts:21':
    'inside the module-level exportScale const; its body reads as module-eval count',
};

/** Every .mts file under src, repo-relative. */
const gpuFiles = (dir = SRC_DIR, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);

    if (statSync(p).isDirectory()) {
      gpuFiles(p, out);
    } else if (name.endsWith('.mts')) {
      out.push(relative(ROOT, p));
    }
  }

  return out;
};

/** Exact source locations used by both the reporter and the Bun probe. */
const throwSiteRecords = () => {
  const records = [];

  for (const file of gpuFiles()) {
    const lines = readFileSync(join(ROOT, file), 'utf8').split('\n');

    lines.forEach((text, index) => {
      if (text.includes('throw new')) {
        records.push({
          file,
          line: index + 1,
          text: text.trim(),
        });
      }
    });
  }

  return records;
};

const validateThrowSiteMap = (records) => {
  const byFile = new Map();

  for (const { file, line } of records) {
    const sites = byFile.get(file) ?? [];
    sites.push(`${file}:${line}`);
    byFile.set(file, sites);
  }

  for (const file of gpuFiles()) {
    instrumentThrowSource(
      file,
      readFileSync(join(ROOT, file), 'utf8'),
      byFile.get(file) ?? [],
    );
  }
};

/** Collect source-mapped line counts by running the Node suite under coverage. */
const collectNodeLcov = () => {
  const dir = mkdtempSync(join(tmpdir(), 'throw-cov-'));
  const out = join(dir, 'cov.lcov');

  try {
    execFileSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '--import',
        './test/node-test-setup.mjs',
        '--enable-source-maps',
        '--experimental-test-coverage',
        '--test-reporter=lcov',
        `--test-reporter-destination=${out}`,
        '--test',
        'test/!(types-*|node-test-setup|quiet-reporter).mjs',
      ],
      { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] },
    );
    return readFileSync(out, 'utf8');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

/** Collect native LCOV and exact throw hits from the Bun public suite. */
const collectBunCoverage = () => {
  const dir = mkdtempSync(join(tmpdir(), 'throw-cov-bun-'));
  const wrapperDir = join(dir, 'wrappers');
  const coverageDir = join(dir, 'coverage');
  const probeLogPath = join(dir, 'throw-probe.jsonl');
  const workerControlLogPath = join(dir, 'throw-worker-control.jsonl');
  const manifestPath = join(dir, 'throw-sites.json');
  const nativeJunitPath = join(dir, 'native-junit.xml');
  const probeJunitPath = join(dir, 'probe-junit.xml');
  const wrapperPaths = [];

  try {
    const specs = readdirSync(join(ROOT, 'test'))
      .filter((name) => name.endsWith('.mjs'))
      .filter(
        (name) =>
          !/^(?:types-.*|node-test-setup|quiet-reporter)\.mjs$/.test(name),
      )
      .sort();
    mkdirSync(wrapperDir, { recursive: true });
    mkdirSync(coverageDir, { recursive: true });
    writeFileSync(probeLogPath, '');
    writeFileSync(workerControlLogPath, '');
    const siteRecords = throwSiteRecords();
    validateThrowSiteMap(siteRecords);
    const expectedSites = siteRecords.map(
      ({ file, line }) => `${file}:${line}`,
    );
    writeFileSync(manifestPath, JSON.stringify(expectedSites));

    const parseLines = readFileSync(
      join(ROOT, 'src/style/parse.mts'),
      'utf8',
    ).split('\n');
    const controlSiteAfter = (exportName) => {
      const start = parseLines.findIndex((line) =>
        line.includes(`export const ${exportName} =`),
      );

      if (start < 0) {
        throw new Error(`Bun worker control could not find ${exportName}`);
      }

      const site = siteRecords.find(
        ({ file, line }) => file === 'src/style/parse.mts' && line > start + 1,
      );

      if (site == null) {
        throw new Error(
          `Bun worker control could not find a ${exportName} guard`,
        );
      }

      return site;
    };

    const copiedFunctionControl = controlSiteAfter('parseLayerShape');
    const importedModuleControl = controlSiteAfter('parseLineCap');

    for (const [index, name] of specs.entries()) {
      const wrapper = join(
        wrapperDir,
        `suite-${String(index).padStart(4, '0')}.test.mjs`,
      );
      const source = pathToFileURL(join(ROOT, 'test', name)).href;
      writeFileSync(wrapper, `import ${JSON.stringify(source)};\n`);
      wrapperPaths.push(wrapper);
    }

    if (wrapperPaths.length === 0) {
      throw new Error('Bun throw coverage found no public spec files');
    }

    const bunBinary = process.env.BUN_BINARY || 'bun';
    const runtimeProbe = execFileSync(
      bunBinary,
      [
        '--eval',
        'process.stdout.write(JSON.stringify({ version: Bun.version, marker: process.versions.bun ?? null }))',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const bunRuntime = JSON.parse(runtimeProbe);

    if (
      typeof bunRuntime.version !== 'string' ||
      typeof bunRuntime.marker !== 'string'
    ) {
      throw new Error('BUN_BINARY did not identify a Bun runtime');
    }

    const workerControlOutput = runBunSuite(
      bunBinary,
      'Bun live-worker throw controls',
      [
        `--preload=${join(ROOT, 'test', 'lib', 'bun-throw-coverage-setup.mjs')}`,
        join(ROOT, 'test', 'lib', 'bun-throw-worker-control.mjs'),
      ],
      null,
      {
        ...process.env,
        CY_THROW_PROBE_LOG: workerControlLogPath,
        CY_THROW_SITE_MANIFEST: manifestPath,
      },
    );
    const workerControlResult = JSON.parse(workerControlOutput.trim());
    const workerControlProbe = parseThrowProbeLog(
      readFileSync(workerControlLogPath, 'utf8'),
      expectedSites,
    );
    const copiedFunctionControlId = `src/style/parse.mts:${copiedFunctionControl.line}`;
    const importedModuleControlId = `src/style/parse.mts:${importedModuleControl.line}`;
    const importedWorkerInstrumentation =
      workerControlProbe.instrumentedRealms.get(importedModuleControlId);
    const importedWorkerHitRealms = workerControlProbe.hitRealms.get(
      importedModuleControlId,
    );

    if (
      !workerControlProbe.hitRealms.get(copiedFunctionControlId)?.has('worker')
    ) {
      throw new Error(
        `Bun copied-function control did not record an exact worker hit at ${copiedFunctionControlId}`,
      );
    }
    if (
      !importedWorkerInstrumentation?.has('worker') ||
      !importedWorkerHitRealms?.has('worker')
    ) {
      throw new Error(
        `Bun source-import worker control did not instrument and hit ${importedModuleControlId}`,
      );
    }

    const wrapperToSource = new Map(
      wrapperPaths.map((wrapper, index) => [
        resolve(wrapper),
        join('test', specs[index]),
      ]),
    );
    const baseArgs = [
      'test',
      '--isolate',
      `--preload=${join(ROOT, 'test', 'lib', 'bun-test-setup.mjs')}`,
      '--reporter=junit',
    ];
    const nativeJunitArgs = [
      ...baseArgs,
      `--reporter-outfile=${nativeJunitPath}`,
      '--coverage',
      '--coverage-reporter=lcov',
      `--coverage-dir=${coverageDir}`,
      ...wrapperPaths,
    ];

    runBunSuite(
      bunBinary,
      'Bun native-coverage suite',
      nativeJunitArgs,
      nativeJunitPath,
    );

    const nativeOutcomes = parseBunJunit(
      readFileSync(nativeJunitPath, 'utf8'),
      wrapperToSource,
    );
    const expectedSourceFiles = specs.map((name) => join('test', name));
    assertFilesHavePassingTests(
      nativeOutcomes,
      expectedSourceFiles,
      'Bun native-coverage suite',
    );

    const probeArgs = [
      'test',
      '--isolate',
      `--preload=${join(ROOT, 'test', 'lib', 'bun-throw-coverage-setup.mjs')}`,
      `--preload=${join(ROOT, 'test', 'lib', 'bun-test-setup.mjs')}`,
      '--reporter=junit',
      `--reporter-outfile=${probeJunitPath}`,
      ...wrapperPaths,
    ];

    runBunSuite(
      bunBinary,
      'Bun exact throw-probe suite',
      probeArgs,
      probeJunitPath,
      {
        ...process.env,
        CY_THROW_PROBE_LOG: probeLogPath,
        CY_THROW_SITE_MANIFEST: manifestPath,
      },
    );

    const probeOutcomes = parseBunJunit(
      readFileSync(probeJunitPath, 'utf8'),
      wrapperToSource,
    );
    assertFilesHavePassingTests(
      probeOutcomes,
      expectedSourceFiles,
      'Bun exact throw-probe suite',
    );
    const identityStatus = (outcomes) =>
      outcomes
        .map(({ identity, status }) => `${identity.key}\u0000${status}`)
        .sort();
    const nativeIdentityStatus = identityStatus(nativeOutcomes);
    const probeIdentityStatus = identityStatus(probeOutcomes);

    if (
      nativeIdentityStatus.length !== probeIdentityStatus.length ||
      nativeIdentityStatus.some(
        (key, index) => key !== probeIdentityStatus[index],
      )
    ) {
      throw new Error(
        'Bun throw-site instrumentation changed test identities or outcomes',
      );
    }

    const probe = parseThrowProbeLog(
      readFileSync(probeLogPath, 'utf8'),
      expectedSites,
    );

    if ((probe.ready.get('main') ?? 0) === 0) {
      throw new Error('Bun throw probe did not initialize in the test realm');
    }
    if ((probe.ready.get('worker') ?? 0) === 0) {
      throw new Error(
        'Bun public suite spawned no worker with the throw probe installed',
      );
    }

    probe.bunVersion = bunRuntime.version;
    probe.testIdentities = probeOutcomes.length;
    probe.testFiles = specs.length;
    probe.workerControl = {
      copiedFunctionSite: copiedFunctionControlId,
      copiedFunctionHitCount: workerControlProbe.hits.get(
        copiedFunctionControlId,
      ),
      importedModuleSite: importedModuleControlId,
      importedModuleHitCount: workerControlProbe.hits.get(
        importedModuleControlId,
      ),
      importedModuleInstrumentedInWorker:
        importedWorkerInstrumentation?.has('worker') === true,
      copiedFunctionMessage: workerControlResult.copiedFunction.message,
      importedModuleMessage: workerControlResult.importedModule.message,
    };

    return {
      lcovText: readFileSync(join(coverageDir, 'lcov.info'), 'utf8'),
      probe,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

/** file (repo-relative) -> Map( 1-based line -> execution count ) */
export const parseLcov = (text) => {
  const perFile = new Map();
  let cur = null;
  let currentLines = null;
  let currentCounts = null;
  let declaredLines = null;
  let declaredHits = null;
  let inRecord = false;

  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();

    if (line === '') {
      continue;
    }

    if (line.startsWith('SF:')) {
      if (inRecord) {
        throw new Error(
          `lcov source record was not closed before line ${index + 1}`,
        );
      }

      const source = line.slice(3).trim();

      if (source === '') {
        throw new Error(`lcov has an empty source path on line ${index + 1}`);
      }

      const resolved = resolve(ROOT, source);
      const relativePath = relative(ROOT, resolved);
      const currentFileOutside =
        relativePath === '..' ||
        relativePath.startsWith(
          `..${process.platform === 'win32' ? '\\' : '/'}`,
        );

      if (currentFileOutside && !isAbsolute(source)) {
        throw new Error(`lcov source escapes the repository: ${source}`);
      }

      cur = currentFileOutside ? null : relativePath;
      currentLines = new Set();
      currentCounts = new Map();
      declaredLines = null;
      declaredHits = null;
      inRecord = true;

      if (cur != null && !perFile.has(cur)) {
        perFile.set(cur, new Map());
      }
    } else if (line.startsWith('DA:')) {
      if (!inRecord || currentLines == null || currentCounts == null) {
        throw new Error(
          `lcov has line data before a source path on line ${index + 1}`,
        );
      }

      const match = line.match(/^DA:(\d+),(\d+)(?:,.*)?$/);

      if (match == null) {
        throw new Error(
          `malformed lcov line record on line ${index + 1}: ${line}`,
        );
      }

      const ln = Number(match[1]);
      const count = Number(match[2]);

      if (ln < 1 || currentLines.has(ln)) {
        throw new Error(
          `invalid or duplicate lcov line ${ln} on line ${index + 1}`,
        );
      }

      currentLines.add(ln);
      currentCounts.set(ln, count);

      if (cur == null) {
        continue;
      }

      const counts = perFile.get(cur);

      counts.set(ln, Math.max(counts.get(ln) ?? 0, count));
    } else if (line.startsWith('LF:') || line.startsWith('LH:')) {
      if (!inRecord) {
        throw new Error(
          `lcov has a summary before a source path on line ${index + 1}`,
        );
      }

      const match = line.match(/^(LF|LH):(\d+)$/);

      if (match == null) {
        throw new Error(`malformed lcov summary on line ${index + 1}: ${line}`);
      }

      const value = Number(match[2]);

      if (match[1] === 'LF') {
        declaredLines = value;
      } else {
        declaredHits = value;
      }
    } else if (line === 'end_of_record') {
      if (!inRecord) {
        throw new Error(
          `lcov has an end_of_record without an open source on line ${index + 1}`,
        );
      }

      if (declaredLines != null && declaredLines !== currentLines.size) {
        throw new Error(
          `lcov declares ${declaredLines} lines, observed ${currentLines.size}`,
        );
      }

      if (
        declaredHits != null &&
        declaredHits !==
          [...currentCounts.values()].filter((count) => count > 0).length
      ) {
        throw new Error(
          `lcov declares ${declaredHits} hit lines, observed ${[...currentCounts.values()].filter((count) => count > 0).length}`,
        );
      }

      cur = null;
      currentLines = null;
      currentCounts = null;
      declaredLines = null;
      declaredHits = null;
      inRecord = false;
    } else if (!/^(?:TN:|FNF:|FNH:|FN:|FNDA:|BRDA:|BRF:|BRH:)/.test(line)) {
      throw new Error(`unsupported lcov record on line ${index + 1}: ${line}`);
    }
  }

  if (inRecord) {
    throw new Error('lcov source record is missing end_of_record');
  }

  return perFile;
};

/**
 * Audit the error contract's coverage.
 *
 * @param lcovText — an lcov report; the selected Node or Bun suite is run
 *   under coverage when omitted
 * @returns per-site records, source-file coverage, and per-runtime covered,
 *   dead and unknown reachable-site counts, plus browser-only and unreachable
 *   classifications
 */
export function audit(lcovText, runtime = 'Node', probe = null) {
  if (!['Node', 'Bun'].includes(runtime)) {
    throw new Error(`unknown coverage runtime ${runtime}`);
  }
  if (probe != null && runtime !== 'Bun') {
    throw new Error('the exact throw-site probe is only valid for Bun');
  }

  if (lcovText == null) {
    if (runtime === 'Node') {
      lcovText = collectNodeLcov();
    } else {
      const collected = collectBunCoverage();
      lcovText = collected.lcovText;
      probe ??= collected.probe;
    }
  }

  const perFile = parseLcov(lcovText);
  const sources = gpuFiles();
  const instrumentedSources = sources.filter(
    (file) => perFile.get(file)?.size > 0,
  );
  const sites = [];
  const probeSites = throwSiteRecords();

  for (const { file, line, text } of probeSites) {
    const counts = perFile.get(file);
    const at = `${file}:${line}`;
    // The exact probe is authoritative for Bun. Native LCOV is retained as
    // independent evidence, but an LCOV count cannot stand in for execution
    // of this particular throw statement.
    const nativeCount = counts?.get(line);
    const instrumented = probe?.instrumented.has(at) ?? false;
    const hitCount = probe?.hits.get(at) ?? 0;
    const browser = BROWSER_ONLY.some((prefix) => file.startsWith(prefix));
    const unreachable = UNREACHABLE[at];
    const misattributed = MISATTRIBUTED[at];
    const covered =
      probe != null
        ? hitCount > 0
          ? true
          : instrumented
            ? false
            : null
        : misattributed != null
          ? null
          : nativeCount == null
            ? null
            : nativeCount > 0;

    sites.push({
      file,
      line,
      text,
      browser,
      unreachable,
      misattributed,
      covered,
      nativeCovered:
        misattributed != null
          ? null
          : nativeCount == null
            ? null
            : nativeCount > 0,
      probeInstrumented: probe == null ? null : instrumented,
      probeHits: probe == null ? null : hitCount,
    });
  }

  const dead = sites.filter(
    (s) => s.covered === false && !s.browser && s.unreachable == null,
  );
  const unknown = sites.filter(
    (s) =>
      s.covered == null &&
      !s.browser &&
      s.unreachable == null &&
      s.misattributed == null,
  );
  const nativeDead = sites.filter(
    (s) => s.nativeCovered === false && !s.browser && s.unreachable == null,
  );
  const nativeUnknown = sites.filter(
    (s) =>
      s.nativeCovered == null &&
      !s.browser &&
      s.unreachable == null &&
      s.misattributed == null,
  );

  return {
    runtime,
    sites,
    sourceFiles: sources.length,
    instrumentedSourceFiles: instrumentedSources.length,
    missingSourceFiles: sources.filter(
      (file) => !instrumentedSources.includes(file),
    ),
    covered: sites.filter((s) => s.covered === true).length,
    dead,
    unknown,
    // `unreachable` wins over `browser`, matching how --verbose labels a
    // site: a browser-only file can still hold a guard no input reaches,
    // and round 36.4 classified three of them.  Counting a site in both
    // tallies made them sum past the site total, which is how this was
    // noticed.
    browser: sites.filter(
      (s) =>
        s.covered !== true &&
        s.browser &&
        s.unreachable == null &&
        (s.misattributed == null || probe != null),
    ).length,
    unreachable: sites.filter(
      (s) => s.covered !== true && s.unreachable != null,
    ).length,
    misattributed: sites.filter(
      (s) => s.misattributed != null && s.covered == null,
    ).length,
    probeInstrumentedSites: probe == null ? null : probe.instrumented.size,
    probeHitSites: probe == null ? null : probe.hits.size,
    probeMissingSites:
      probe == null ? null : probe.missingInstrumentation.length,
    probeInstrumentedSourceFiles:
      probe == null
        ? null
        : new Set(
            [...probe.instrumented].map((site) =>
              site.slice(0, site.lastIndexOf(':')),
            ),
          ).size,
    bunVersion: probe?.bunVersion ?? null,
    instrumentedTestIdentities: probe?.testIdentities ?? null,
    instrumentedTestFiles: probe?.testFiles ?? null,
    workerProbeContexts: probe?.ready.get('worker') ?? null,
    nativeCoverage:
      probe == null
        ? null
        : {
            covered: sites.filter((s) => s.nativeCovered === true).length,
            dead: nativeDead,
            unknown: nativeUnknown,
            probeHitsNotNativeCovered: sites.filter(
              (s) => s.probeHits > 0 && s.nativeCovered !== true,
            ),
          },
  };
}

/**
 * The round-37.1 gate: what would fail the build, as human-readable lines.
 *
 * Two kinds of failure, and the second is the reason the first can be trusted.
 * A reachable throw the suite never runs, or whose source has no usable
 * coverage, is an unchecked contract — the thing the whole measurement exists
 * to find. A stale or reasonless allowlist
 * entry is an unchecked *exemption*: `UNREACHABLE`/`MISATTRIBUTED` are keyed by
 * `file:line`, so an insertion above a site silently re-points its entry at
 * whatever line now sits there, exempting the wrong throw and (worse) reading
 * as a pass.
 *
 * @param result — an {@link audit} result
 * @param allowlists — the `[ name, entries ]` pairs to validate, defaulting to
 *   the two this module exports; passed explicitly by the specs that check the
 *   validation itself, since a stale entry cannot be staged any other way
 * @returns one string per failure; an empty array means the gate passes
 */
export function gateFailures(
  result,
  allowlists = [
    ['UNREACHABLE', UNREACHABLE],
    ['MISATTRIBUTED', MISATTRIBUTED],
  ],
) {
  const failures = [];
  const known = new Set(result.sites.map((s) => `${s.file}:${s.line}`));

  for (const s of result.dead) {
    failures.push(
      `never run by the ${result.runtime ?? 'Node'} suite: ${s.file}:${s.line}  ${s.text.slice(0, 80)}`,
    );
  }

  for (const s of result.unknown ?? []) {
    failures.push(
      `coverage unknown for reachable throw: ${s.file}:${s.line}  ${s.text.slice(0, 80)}`,
    );
  }

  for (const [name, list] of allowlists) {
    for (const [at, reason] of Object.entries(list)) {
      if (!known.has(at)) {
        failures.push(
          `${name} exempts ${at}, which is not a throw site — did the code above it move?`,
        );
      } else if (typeof reason !== 'string' || reason.trim() === '') {
        failures.push(`${name}'s entry for ${at} carries no reason`);
      }
    }
  }

  return failures;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  let runtime = 'Node';
  let lcovPath = null;

  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--verbose') {
      continue;
    }

    if (arg.startsWith('--runtime=')) {
      const value = arg.slice('--runtime='.length);
      runtime = value === 'node' ? 'Node' : value === 'bun' ? 'Bun' : null;

      if (runtime == null) {
        throw new Error(`unknown runtime ${value}; expected node or bun`);
      }
    } else if (arg === '--lcov') {
      if (args[i + 1] == null || args[i + 1].startsWith('--')) {
        throw new Error('--lcov requires a report path');
      }

      lcovPath = args[++i];
    } else if (arg.startsWith('--lcov=')) {
      lcovPath = arg.slice('--lcov='.length);
    } else {
      throw new Error(`unknown argument ${arg}`);
    }
  }

  const result = audit(
    lcovPath == null ? undefined : readFileSync(lcovPath, 'utf8'),
    runtime,
  );

  console.log(`throw sites in src: ${result.sites.length}`);
  console.log(
    `  source files with lcov: ${result.instrumentedSourceFiles}/${result.sourceFiles} (${result.missingSourceFiles.length} missing)`,
  );
  if (result.probeInstrumentedSites != null) {
    console.log(
      `  Bun ${result.bunVersion}: ${result.instrumentedTestIdentities} test identities across ${result.instrumentedTestFiles} files; instrumented/uninstrumented outcomes match`,
    );
    console.log(
      `  exact Bun probe: ${result.probeHitSites} hit sites; ${result.probeInstrumentedSites} instrumented; ${result.probeMissingSites} sites without loaded source; ${result.probeInstrumentedSourceFiles} source files instrumented`,
    );
    console.log(`  Bun worker probe contexts: ${result.workerProbeContexts}`);
    console.log(
      `  native Bun LCOV: ${result.nativeCoverage.covered} positive throw lines; ${result.nativeCoverage.dead.length} dead reachable; ${result.nativeCoverage.unknown.length} unknown reachable`,
    );
    console.log(
      `  exact hits without positive native LCOV: ${result.nativeCoverage.probeHitsNotNativeCovered.length}`,
    );
  }
  console.log(`  run by the ${runtime} suite: ${result.covered}`);
  console.log(`  dead reachable sites: ${result.dead.length}`);
  console.log(`  unknown reachable sites: ${result.unknown.length}`);
  console.log(
    `  browser-only (pinned in the renderer project): ${result.browser}`,
  );
  console.log(`  unreachable by design: ${result.unreachable}`);
  console.log(`  known misattributed sites: ${result.misattributed}`);

  if (process.argv.includes('--verbose')) {
    for (const file of result.missingSourceFiles) {
      console.log(`  SOURCE UNKNOWN ${file}`);
    }

    for (const s of result.sites.filter((x) => x.covered !== true)) {
      const why =
        s.unreachable != null
          ? 'unreachable'
          : s.misattributed != null
            ? 'misattributed'
            : s.browser
              ? 'browser'
              : s.covered === false
                ? 'DEAD'
                : 'UNKNOWN';

      console.log(
        `  ${why.padEnd(12)} ${s.file}:${s.line}  ${s.text.slice(0, 90)}`,
      );
    }

    for (const site of result.nativeCoverage?.probeHitsNotNativeCovered ?? []) {
      console.log(
        `  PROBE HIT, LCOV NOT POSITIVE ${site.file}:${site.line}  ${site.text.slice(0, 90)}`,
      );
    }

    for (const site of result.nativeCoverage?.dead ?? []) {
      console.log(
        `  NATIVE LCOV DEAD ${site.file}:${site.line}  ${site.text.slice(0, 90)}`,
      );
    }

    for (const site of result.nativeCoverage?.unknown ?? []) {
      console.log(
        `  NATIVE LCOV UNKNOWN ${site.file}:${site.line}  ${site.text.slice(0, 90)}`,
      );
    }
  }

  const failures = gateFailures(result);

  if (failures.length > 0) {
    console.error(`\nthrow-coverage gate failed (${failures.length}):`);

    for (const f of failures) {
      console.error(`  ${f}`);
    }

    console.error(
      '\nAdd a spec that fires the guard (a message assertion when several ' +
        'guards share a method), or — if no caller can reach it — classify it ' +
        'in UNREACHABLE with the reason.',
    );

    process.exitCode = 1;
  }
}
