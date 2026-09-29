/*
Round 100.2: the cross-runtime smoke on embedded engines — the release-time
re-run of the support matrix's Tier-3 rows (`src/README.md`, "Supported
environments").

    node test/runtimes/engines.mjs --qjs=<path> --hermes=<path> --graaljs=<path>

Any subset of the three; at least one, or it exits 1 (nothing here
soft-skips).  The engines are not devDependencies: `npx jsvu
--engines=quickjs,graaljs` installs QuickJS-ng and GraalJS, and the
Hermes React Native ships is built from its tag (the round-100 record
says how).  Build first (`npm run build`).

Per engine, over `build/cytoscape-headless.esm.min.mjs` and the same
`smoke-checks.mjs` every other host runs:

- **bare** — the bundle as shipped, no help: printed, not asserted.  The
  first error is the matrix's named failing assertion, and a release that
  finds a bare run green has a row to upgrade.
- **shimmed** — with the host shims an app on that engine installs
  (below): must answer `ok`, with the value assertions counted.
- **the control** — shimmed, with the round-46.5 dict-as-array reader:
  must fail on the value it degrades, so a vacuous `ok` cannot pass.

The shims are the smallest honest set, stated so the matrix can quote
them: a UTF-8 `TextDecoder` (and a `TextEncoder` with `encodeInto` where
the engine has none) on all three; `queueMicrotask` on GraalJS's plain
launcher; and on Hermes the two globals React Native's runtime installs
before app code (`queueMicrotask`, `performance.now`).  Hermes takes no
ES modules, so its run is an IIFE bundled here by rolldown — what Metro
hands it, modulo Babel, which Hermes at React Native 0.87's pin no longer
needs for this bundle (measured).
*/
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const BUNDLE = join(ROOT, 'build', 'cytoscape-headless.esm.min.mjs');
const CHECKS = join(ROOT, 'test', 'runtimes', 'smoke-checks.mjs');
const CONTROL_FAILS = 'expected "alpha", got undefined';

const engines = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a) => /^--(qjs|hermes|graaljs)=(.+)$/.exec(a))
    .filter((m) => m != null)
    .map((m) => [m[1], m[2]]),
);

if (Object.keys(engines).length === 0) {
  console.error(
    'usage: node test/runtimes/engines.mjs --qjs=<path> --hermes=<path> ' +
      '--graaljs=<path> (at least one)',
  );
  process.exit(1);
}

/** A minimal UTF-8 codec: what fast-text-encoding gives, plus encodeInto. */
const TEXT_SHIM = `
(function (g) {
  var utf8 = function (s) {
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length) {
        var d = s.charCodeAt(i + 1);
        if (d >= 0xdc00 && d < 0xe000) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; }
      }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  };
  if (typeof g.TextEncoder !== 'function' || typeof g.TextEncoder.prototype.encodeInto !== 'function') {
    var TE = function TextEncoder() {};
    TE.prototype.encoding = 'utf-8';
    TE.prototype.encode = function (s) { return new Uint8Array(utf8(String(s === undefined ? '' : s))); };
    TE.prototype.encodeInto = function (s, dest) {
      var b = utf8(String(s)), n = Math.min(b.length, dest.length);
      for (var i = 0; i < n; i++) dest[i] = b[i];
      return { read: s.length, written: n };
    };
    g.TextEncoder = TE;
  }
  if (typeof g.TextDecoder !== 'function') {
    var TD = function TextDecoder() {};
    TD.prototype.encoding = 'utf-8';
    TD.prototype.decode = function (u8) {
      if (u8 == null) return '';
      if (!(u8 instanceof Uint8Array)) u8 = new Uint8Array(u8.buffer || u8, u8.byteOffset || 0, u8.byteLength);
      var s = '', i = 0;
      while (i < u8.length) {
        var c = u8[i++], cp;
        if (c < 0x80) cp = c;
        else if (c < 0xe0) cp = ((c & 31) << 6) | (u8[i++] & 63);
        else if (c < 0xf0) cp = ((c & 15) << 12) | ((u8[i++] & 63) << 6) | (u8[i++] & 63);
        else cp = ((c & 7) << 18) | ((u8[i++] & 63) << 12) | ((u8[i++] & 63) << 6) | (u8[i++] & 63);
        if (cp >= 0x10000) { cp -= 0x10000; s += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 1023)); }
        else s += String.fromCharCode(cp);
      }
      return s;
    };
    g.TextDecoder = TD;
  }
})(globalThis);
`;
const MICROTASK_SHIM = `
if (typeof queueMicrotask !== 'function') {
  globalThis.queueMicrotask = function (cb) { Promise.resolve().then(cb); };
}
`;
// React Native's InitializeCore installs these before any app code runs
const RN_HOST = `${MICROTASK_SHIM}
if (typeof performance !== 'object') {
  globalThis.performance = { now: function () { return Date.now(); } };
}
`;

/** The smoke, as an async function body every host wraps. */
const body = (label, control) => `
  const t0 = Date.now();
  try {
    await checks.smokeOneBundle(cytoscape, ${JSON.stringify(label)}, ${JSON.stringify(control)});
    await checks.smokeKind(cytoscape, 'headless', ${JSON.stringify(label)});
    await checks.smokeCpuOnly(cytoscape, ${JSON.stringify(label)});
    out('ok ' + checks.assertionCount() + ' ' + (Date.now() - t0));
  } catch (e) {
    out('FAIL ' + String(e && e.message || e));
  }
`;

if (!existsSync(BUNDLE)) {
  console.error(`${BUNDLE} is missing — run \`npm run build\` first`);
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), 'cytoscape-engines-'));
const write = (name, text) => {
  const file = join(dir, name);

  writeFileSync(file, text);

  return file;
};

/** One ES-module host file (QuickJS, GraalJS). */
const esmHost = (name, prelude, label, control) => {
  const shim = write(`${name}-shim.mjs`, prelude);

  return write(
    `${name}.mjs`,
    `import ${JSON.stringify(shim)};
const out = (s) => print(s);
let cytoscape, checks;
try {
  cytoscape = (await import(${JSON.stringify(BUNDLE)})).default;
  checks = await import(${JSON.stringify(CHECKS)});
} catch (e) {
  out('FAIL ' + String(e && e.message || e));
}
if (checks != null) {
${body(label, control)}
}
`,
  );
};

/** The Hermes script: prelude, the IIFE, the driver. */
let hermesIife = null;
const hermesHost = async (name, prelude, label, control) => {
  if (hermesIife == null) {
    const { rolldown } = await import('rolldown');
    const entry = write(
      'hermes-entry.mjs',
      `import cytoscape from ${JSON.stringify(BUNDLE)};
import * as checks from ${JSON.stringify(CHECKS)};
export { cytoscape, checks };
`,
    );
    const build = await rolldown({
      input: entry,
      // the bundle's `import.meta.url` probe answers null in a script
      onLog: (level, log, handler) =>
        log.code === 'EMPTY_IMPORT_META' ? undefined : handler(level, log),
    });
    const { output } = await build.generate({
      format: 'iife',
      name: 'CytoscapeSmoke',
    });

    hermesIife = output[0].code;
  }

  return write(
    `${name}.js`,
    `${prelude}
var CytoscapeSmoke;
try {
${hermesIife}
} catch (e) {
  print('FAIL ' + String(e && e.message || e));
}
if (CytoscapeSmoke != null) {
  (async function () {
    const out = (s) => print(s);
    const { cytoscape, checks } = CytoscapeSmoke;
${body(label, control)}
  })();
}
`,
  );
};

const HOSTS = {
  qjs: {
    name: 'QuickJS-ng',
    shims: TEXT_SHIM,
    host: esmHost,
    args: (file) => ['--module', file],
  },
  graaljs: {
    name: 'GraalJS',
    shims: MICROTASK_SHIM + TEXT_SHIM,
    host: esmHost,
    args: (file) => [file],
  },
  hermes: {
    name: 'Hermes',
    shims: RN_HOST + TEXT_SHIM,
    host: hermesHost,
    args: (file) => ['-w', file],
  },
};

const run = (bin, args) => {
  const res = spawnSync(bin, args, { encoding: 'utf8', timeout: 120_000 });
  const text = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim();

  return res.error != null ? `FAIL ${res.error.message}` : text;
};

const failures = [];

try {
  for (const [key, bin] of Object.entries(engines)) {
    const { name, shims, host, args } = HOSTS[key];
    const bare = run(bin, args(await host(`${key}-bare`, '', key, null)));
    const shimmed = run(bin, args(await host(`${key}-ok`, shims, key, null)));
    const control = run(
      bin,
      args(await host(`${key}-control`, shims, key, 'dict-as-array')),
    );
    const firstLine = (s) =>
      s
        .split('\n')
        .find((l) => /FAIL|Error|error:/.test(l))
        ?.trim() ?? s.split('\n')[0];
    const okMatch = /^ok (\d+) (\d+)$/m.exec(shimmed);

    console.log(`${name}: bare ${/^ok /m.test(bare) ? 'ok' : firstLine(bare)}`);

    if (okMatch == null || Number(okMatch[1]) < 40) {
      failures.push(`${name}: shimmed run failed — ${firstLine(shimmed)}`);
    } else if (!control.includes(CONTROL_FAILS)) {
      failures.push(
        `${name}: the dict-as-array control passed — the checks are not ` +
          `checking (${firstLine(control)})`,
      );
    } else {
      console.log(
        `ok ${name} (${okMatch[1]} assertions, ${okMatch[2]} ms) with its ` +
          'shims; the control fails',
      );
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
