import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import {
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { availableParallelism, tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  compareTestResults,
  countStatuses,
  parseBunJunit,
  parseNodeTestEvents,
} from './runtime-test-results.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const SUITES = {
  public: join(ROOT, 'test'),
  modules: join(ROOT, 'test', 'modules'),
  soak: join(ROOT, 'test', 'soak'),
};
const NODE_REPORTER = join(ROOT, 'scripts', 'node-test-events-reporter.mjs');
const NODE_PRELOAD = join(ROOT, 'test', 'node-test-setup.mjs');
const BUN_PRELOAD = join(ROOT, 'test', 'lib', 'bun-test-setup.mjs');
// keeps the repo bunfig.toml (plain `bun test`'s preload) out of the run
const BUN_CONFIG = join(ROOT, 'test', 'lib', 'bunfig.scripted.toml');
const FILE_PROCESS_TIMEOUT_MS = 15 * 60 * 1000;
const CAPTURE_LIMIT = 64 * 1024 * 1024;
const activeChildren = new Set();
const temporaryDirectories = new Set();

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.once(signal, async () => {
    for (const child of activeChildren) {
      child.kill('SIGTERM');
    }

    await Promise.all(
      [...temporaryDirectories].map((dir) =>
        rm(dir, { recursive: true, force: true }),
      ),
    );
    process.exit(128 + ({ SIGINT: 2, SIGTERM: 15, SIGHUP: 1 }[signal] ?? 1));
  });
}

const parseArgs = (argv) => {
  const options = {
    runtime: 'both',
    suite: null,
    file: null,
    quiet: false,
    report: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--quiet') {
      options.quiet = true;
    } else if (arg.startsWith('--runtime=')) {
      options.runtime = arg.slice('--runtime='.length);
    } else if (arg.startsWith('--suite=')) {
      options.suite = arg.slice('--suite='.length);
    } else if (arg === '--file' && argv[i + 1] != null) {
      options.file = argv[++i];
    } else if (arg.startsWith('--file=')) {
      options.file = arg.slice('--file='.length);
    } else if (arg === '--report' && argv[i + 1] != null) {
      options.report = argv[++i];
    } else if (arg.startsWith('--report=')) {
      options.report = arg.slice('--report='.length);
    } else {
      throw new Error(`unknown argument ${arg}`);
    }
  }

  if (!['node', 'bun', 'both'].includes(options.runtime)) {
    throw new Error(
      `unknown runtime ${options.runtime}; expected node, bun or both`,
    );
  }

  if (!['public', 'modules', 'soak', 'all'].includes(options.suite)) {
    throw new Error(
      `unknown suite ${options.suite}; expected public, modules, soak or all`,
    );
  }

  return options;
};

const discoverFiles = async (suite) => {
  const names = suite === 'all' ? Object.keys(SUITES) : [suite];
  const files = [];

  for (const name of names) {
    const dir = SUITES[name];
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      // specs are *.test.mjs, the names `bun test` and `node --test`
      // discover on their own
      if (!entry.isFile() || !entry.name.endsWith('.test.mjs')) {
        continue;
      }

      files.push({ suite: name, file: relative(ROOT, join(dir, entry.name)) });
    }
  }

  files.sort((a, b) => a.file.localeCompare(b.file));

  if (files.length === 0) {
    throw new Error(`discovery found no test files for ${suite}`);
  }

  return files;
};

const collectChild = (command, args, options = {}) =>
  new Promise((resolveChild) => {
    let stdout = '';
    let stderr = '';
    let outputOverflow = false;
    let timedOut = false;
    let spawnError;
    const child = spawn(command, args, {
      cwd: ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    activeChildren.add(child);
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 5000).unref();
    }, options.timeoutMs ?? FILE_PROCESS_TIMEOUT_MS);
    timer.unref();

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      if (
        Buffer.byteLength(stdout) + Buffer.byteLength(chunk) <=
        CAPTURE_LIMIT
      ) {
        stdout += chunk;
      } else {
        outputOverflow = true;
        child.kill('SIGTERM');
      }
    });
    child.stderr.on('data', (chunk) => {
      if (
        Buffer.byteLength(stderr) + Buffer.byteLength(chunk) <=
        CAPTURE_LIMIT
      ) {
        stderr += chunk;
      } else {
        outputOverflow = true;
        child.kill('SIGTERM');
      }
    });
    child.on('error', (error) => {
      spawnError = error;
    });
    child.on('close', (code, signal) => {
      activeChildren.delete(child);
      clearTimeout(timer);
      resolveChild({
        code,
        signal,
        spawnError,
        stdout,
        stderr,
        timedOut,
        outputOverflow,
      });
    });
  });

const workers = async (items, concurrency, task) => {
  const results = new Array(items.length);
  let next = 0;

  await Promise.all(
    Array.from({ length: Math.min(items.length, concurrency) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await task(items[index]);
      }
    }),
  );

  return results;
};

const formatCounts = (totals) =>
  `${totals.tests} tests (${totals.passed} passed, ${totals.failed} failed, ${totals.skipped} skipped, ${totals.cancelled} cancelled, ${totals.todo} todo)`;

const nodeCommand = (file) => [
  '--test-isolation=none',
  '--import',
  'tsx',
  '--import',
  // a URL, not a path: Node reads `D:\…` as a URL with scheme `d:`
  pathToFileURL(NODE_PRELOAD).href,
  ...(file.includes(
    `${join('test', 'soak')}${process.platform === 'win32' ? '\\' : '/'}`,
  )
    ? ['--expose-gc']
    : []),
  '--test',
  `--test-reporter=${pathToFileURL(NODE_REPORTER).href}`,
  file,
];

const runNode = async (files) => {
  if (
    process.release?.name !== 'node' ||
    process.versions.node == null ||
    process.versions.bun != null ||
    globalThis.Bun != null
  ) {
    throw new Error(
      'the parity harness must be launched by Node; set NODE_BINARY only to select the child Node executable',
    );
  }

  const nodeBinary = process.env.NODE_BINARY || process.execPath;
  const runtimeProbe = await collectChild(
    nodeBinary,
    [
      '--eval',
      'process.stdout.write(JSON.stringify({ name: process.release?.name ?? "unknown", version: process.versions.node ?? null, bun: process.versions.bun ?? (globalThis.Bun ? globalThis.Bun.version : null) }))',
    ],
    { timeoutMs: 10_000 },
  );
  let nodeRuntime;

  try {
    nodeRuntime = JSON.parse(runtimeProbe.stdout);
  } catch {
    nodeRuntime = null;
  }

  if (
    runtimeProbe.code !== 0 ||
    nodeRuntime?.name !== 'node' ||
    typeof nodeRuntime.version !== 'string' ||
    nodeRuntime.bun != null ||
    runtimeProbe.spawnError != null
  ) {
    throw new Error(
      `NODE_BINARY must start Node (exit ${runtimeProbe.code ?? runtimeProbe.signal}; stdout ${JSON.stringify(runtimeProbe.stdout.trim())}; stderr ${JSON.stringify(runtimeProbe.stderr.trim())})`,
    );
  }

  const fileResults = await workers(
    files,
    Math.max(1, Math.min(availableParallelism(), 8)),
    async ({ suite, file }) => {
      const absFile = join(ROOT, file);
      const child = await collectChild(nodeBinary, nodeCommand(absFile));
      let parsed;
      let infrastructureError;

      try {
        parsed = parseNodeTestEvents(child.stdout, file);
      } catch (error) {
        infrastructureError = error.message;
      }

      if (child.outputOverflow) {
        infrastructureError = `Node test process output exceeded the ${CAPTURE_LIMIT}-byte safety limit`;
      } else if (child.timedOut) {
        infrastructureError = `Node test process exceeded ${FILE_PROCESS_TIMEOUT_MS}ms`;
      } else if (child.spawnError != null) {
        infrastructureError = `could not start Node: ${child.spawnError.message}`;
      } else if (
        child.code !== 0 &&
        parsed?.totals.failed === 0 &&
        parsed?.totals.cancelled === 0
      ) {
        infrastructureError = `Node exited ${child.code ?? child.signal} without a failed or cancelled test`;
      } else if (
        child.code === 0 &&
        (parsed?.totals.failed > 0 || parsed?.totals.cancelled > 0)
      ) {
        infrastructureError =
          'Node reported failed/cancelled tests but exited successfully';
      }

      if (parsed != null && parsed.totals.tests === 0) {
        infrastructureError =
          'Node reported no executed tests for a discovered spec file';
      }

      return {
        suite,
        file,
        outcomes: parsed?.outcomes ?? [],
        totals: parsed?.totals ?? countStatuses([]),
        summary: parsed?.summary ?? null,
        exitCode: child.code,
        infrastructureError,
        stderr: child.stderr,
      };
    },
  );

  return makeRuntimeResult('node', nodeRuntime.version, files, fileResults);
};

const resolveBun = () => process.env.BUN_BINARY || 'bun';

const runBun = async (files) => {
  // `tmpdir()`, not a '/tmp' fallback: Windows has none (round 151).  And
  // the real path, because Bun's JUnit report names each wrapper by it: on
  // macOS TMPDIR is under /var, a symlink to /private/var, so wrappers keyed
  // by the symlinked path matched no reported suite.
  const tempDir = await realpath(
    await mkdtemp(join(tmpdir(), 'cytoscape-bun-tests-')),
  );
  temporaryDirectories.add(tempDir);
  const junitFile = join(tempDir, 'junit.xml');
  const manifest = [];

  try {
    for (const [index, item] of files.entries()) {
      const wrapper = join(
        tempDir,
        `suite-${String(index).padStart(4, '0')}.test.mjs`,
      );
      const sourceUrl = pathToFileURL(join(ROOT, item.file)).href;
      await writeFile(wrapper, `import ${JSON.stringify(sourceUrl)};\n`);
      manifest.push({ wrapper, source: item.file, suite: item.suite });
    }

    const bun = resolveBun();
    const versionRun = await collectChild(
      bun,
      [
        '--eval',
        'process.stdout.write(JSON.stringify({ name: globalThis.Bun ? "bun" : "unknown", version: globalThis.Bun?.version ?? null }))',
      ],
      { timeoutMs: 10_000 },
    );
    let bunRuntime;

    try {
      bunRuntime = JSON.parse(versionRun.stdout);
    } catch {
      bunRuntime = null;
    }

    if (
      versionRun.code !== 0 ||
      versionRun.spawnError != null ||
      bunRuntime?.name !== 'bun' ||
      typeof bunRuntime.version !== 'string'
    ) {
      throw new Error(
        `BUN_BINARY must start Bun (exit ${versionRun.code ?? versionRun.signal}; stdout ${JSON.stringify(versionRun.stdout.trim())}; stderr ${JSON.stringify(versionRun.stderr.trim())})`,
      );
    }

    const args = [
      'test',
      `--config=${BUN_CONFIG}`,
      '--isolate',
      `--preload=${BUN_PRELOAD}`,
      '--reporter=junit',
      `--reporter-outfile=${junitFile}`,
      ...manifest.map(({ wrapper }) => wrapper),
    ];
    const child = await collectChild(bun, args, {
      timeoutMs: FILE_PROCESS_TIMEOUT_MS,
    });
    let outcomes = [];
    let infrastructureError;

    try {
      const xml = await readFile(junitFile, 'utf8');
      const wrapperToSource = new Map(
        manifest.map(({ wrapper, source }) => [resolve(wrapper), source]),
      );
      outcomes = parseBunJunit(xml, wrapperToSource);
    } catch (error) {
      infrastructureError = `could not read valid Bun JUnit results: ${error.message}`;
    }

    const byFile = new Map(
      files.map(({ file, suite }) => [file, { suite, outcomes: [] }]),
    );

    for (const outcome of outcomes) {
      byFile.get(outcome.file).outcomes.push(outcome);
    }

    const fileResults = files.map(({ file, suite }) => {
      const result = byFile.get(file);
      const totals = countStatuses(result.outcomes);

      if (totals.tests === 0 && infrastructureError == null) {
        infrastructureError = `Bun reported no executed tests for discovered spec file ${file}`;
      }

      return {
        suite,
        file,
        outcomes: result.outcomes,
        totals,
        exitCode: child.code,
        infrastructureError: null,
        stderr: '',
      };
    });

    if (child.outputOverflow) {
      infrastructureError = `Bun test process output exceeded the ${CAPTURE_LIMIT}-byte safety limit`;
    } else if (child.timedOut) {
      infrastructureError = `Bun test process exceeded ${FILE_PROCESS_TIMEOUT_MS}ms`;
    } else if (child.spawnError != null) {
      infrastructureError = `could not start Bun: ${child.spawnError.message}`;
    } else if (
      child.code !== 0 &&
      !outcomes.some(
        ({ status }) => status === 'failed' || status === 'cancelled',
      )
    ) {
      infrastructureError = `Bun exited ${child.code ?? child.signal} without a failed/cancelled testcase`;
    } else if (
      child.code === 0 &&
      outcomes.some(
        ({ status }) => status === 'failed' || status === 'cancelled',
      )
    ) {
      infrastructureError =
        'Bun reported failed/cancelled tests but exited successfully';
    }

    const result = makeRuntimeResult(
      'bun',
      bunRuntime.version,
      files,
      fileResults,
    );
    result.infrastructureError = infrastructureError;
    result.stderr = child.stderr;
    return result;
  } finally {
    temporaryDirectories.delete(tempDir);
    await rm(tempDir, { recursive: true, force: true });
  }
};

const makeRuntimeResult = (runtime, version, files, fileResults) => {
  const outcomes = fileResults.flatMap(({ outcomes: tests }) => tests);
  const totals = countStatuses(outcomes);

  return {
    runtime,
    version,
    files: fileResults.map(
      ({ file, suite, outcomes: tests, totals: fileTotals, ...rest }) => ({
        file,
        suite,
        outcomes: tests,
        totals: fileTotals,
        ...rest,
      }),
    ),
    discoveredFiles: files.length,
    executedFiles: fileResults.filter(
      ({ totals: fileTotals }) => fileTotals.tests > 0,
    ).length,
    totals,
    infrastructureError: fileResults.find(
      ({ infrastructureError }) => infrastructureError,
    )?.infrastructureError,
  };
};

const listFailures = (result) => {
  const lines = [];
  const stderrTail = (stderr) => {
    const text = stderr?.trim() ?? '';

    if (text.length <= 4000) {
      return text;
    }

    return `… (last 4000 of ${text.length} stderr characters)\n${text.slice(-4000)}`;
  };

  if (result.infrastructureError != null) {
    lines.push(`${result.runtime}: ${result.infrastructureError}`);

    const tail = stderrTail(result.stderr);
    if (tail) {
      lines.push(`  stderr (${result.runtime}): ${tail}`);
    }
  }

  for (const { file, outcomes, infrastructureError, stderr } of result.files) {
    if (infrastructureError != null) {
      lines.push(`${result.runtime} ${file}: ${infrastructureError}`);
    }

    for (const outcome of outcomes) {
      if (outcome.status === 'failed' || outcome.status === 'cancelled') {
        lines.push(
          `  ${outcome.status}: ${outcome.identity.display}${outcome.failureType ? ` (${outcome.failureType})` : ''}`,
        );
        if (outcome.message) {
          lines.push(`    ${outcome.message}`);
        }
      }
    }

    if (
      (infrastructureError != null ||
        outcomes.some(
          ({ status }) => status === 'failed' || status === 'cancelled',
        )) &&
      stderr?.trim()
    ) {
      lines.push(`  stderr (${file}): ${stderrTail(stderr)}`);
    }
  }

  return lines;
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const discovered = await discoverFiles(options.suite);
  const files =
    options.file == null
      ? discovered
      : discovered.filter(({ file }) => file === options.file);

  if (files.length === 0) {
    throw new Error(
      `${options.file} is not discovered by the ${options.suite} suite`,
    );
  }
  const nodeResults = options.runtime === 'bun' ? null : await runNode(files);
  const bunResults = options.runtime === 'node' ? null : await runBun(files);
  let comparison;
  let failed = false;

  for (const result of [nodeResults, bunResults].filter(Boolean)) {
    if (
      result.infrastructureError != null ||
      result.totals.failed > 0 ||
      result.totals.cancelled > 0 ||
      result.executedFiles !== result.discoveredFiles
    ) {
      failed = true;
    }
  }

  if (nodeResults != null && bunResults != null) {
    try {
      comparison = compareTestResults(nodeResults, bunResults);
    } catch (error) {
      failed = true;
      comparison = { error: error.message };
    }
  }

  const results = [nodeResults, bunResults].filter(Boolean);

  if (options.report != null) {
    const report = {
      suite: options.suite,
      results,
      ...(comparison == null ? {} : { comparison }),
    };
    const target = resolve(ROOT, options.report);
    const fs = await import('node:fs/promises');
    await fs.mkdir(dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(report, null, 2) + '\n');
  }

  if (failed) {
    const details = results.flatMap(listFailures);
    if (comparison?.error) {
      details.push(`parity: ${comparison.error}`);
    }
    console.error(
      details.length
        ? details.join('\n')
        : 'runtime test tier failed without a reported test outcome',
    );
    process.exitCode = 1;
  } else if (!options.quiet) {
    for (const result of results) {
      console.log(
        `${result.runtime} ${result.version}: ${result.executedFiles}/${result.discoveredFiles} files, ${formatCounts(result.totals)}`,
      );
    }

    if (comparison != null) {
      console.log(
        `Node/Bun identities and outcomes match: ${comparison.tests} tests across ${comparison.files} files`,
      );
    }
  }
};

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
