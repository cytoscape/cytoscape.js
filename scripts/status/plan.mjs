// Round 46.5: deciding what the status site contains, separately from writing it.
//
// `buildPlan()` is pure and cheap — stat calls only.  `executePlan()` in
// `scripts/status-build.mjs` is the only thing that touches the filesystem.
// That split is what lets the site's specs run without copying 48 MiB of
// fixtures, and it is what lets the runtime-asset check run over the *intended*
// output rather than over a tree it had to build first.
//
// An op is one output file:
//
//   { kind: 'copy',    from, to }      byte-for-byte
//   { kind: 'jsonmin', from, to }      JSON.parse -> JSON.stringify
//   { kind: 'wire',    from, to }      -> v4's binary wire format (round 46.5)
//   { kind: 'write',   to, text }      generated
//   { kind: 'omit',    to, reason }    planned, deliberately absent, with why
//
// `to` is always the path *inside* the site — and for every mirrored asset it
// is the same as its path in the repo.  That invariant is what keeps
// `debug/index.html`'s `../build/cytoscape.umd.js` and `../v3/debug/webgl/*`
// resolving with no source file edited.
import { existsSync, statSync, readFileSync, readdirSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { join } from 'node:path';

import { wireSize, WIRE_EXT } from './wire-fixtures.mjs';

/** Cloudflare Pages refuses a file larger than this. */
export const PAGES_MAX_BYTES = 25 * 1024 * 1024;

export const copy = (from, to) => ({ kind: 'copy', from, to });
export const jsonmin = (from, to) => ({ kind: 'jsonmin', from, to });
export const wire = (from, to) => ({ kind: 'wire', from, to });
export const write = (to, text) => ({ kind: 'write', to, text });
export const omit = (to, reason) => ({ kind: 'omit', to, reason });

/**
 * How a fixture gets to the site.
 *
 * **Binary by default** (2026-08-05, the maintainer's call after the sizes were
 * measured): each fixture is re-encoded into v4's own wire format, which takes
 * the five of them from 102.5 MiB of JSON to 37.5 MiB — and, crucially, takes
 * the largest from 34.1 MiB to 9.5 MiB, under Cloudflare Pages' 25 MiB
 * per-file cap.  That is what lets the deploy carry every network itself
 * rather than depending on an off-site bucket with a CORS rule on it.
 *
 * Note what this does *not* buy: gzipped, the binary and the minified JSON are
 * within 1% of each other, and Cloudflare compresses on the wire regardless.
 * This is a file-at-rest win (which is what the cap measures) and a parse win,
 * not a transfer win.
 *
 * `jsonmin` remains the fallback for anything the encoder cannot take, since
 * dropping the v3 fixtures' pretty-printing is free — the page only ever calls
 * `res.json()`, so the whitespace is unobservable.
 *
 * @returns 'wire' | 'jsonmin' | 'copy' | 'omit'
 */
export function fixturePolicy({
  bytes,
  minifiedBytes,
  wireBytes = null,
  max = PAGES_MAX_BYTES,
}) {
  if (wireBytes != null && wireBytes <= max) {
    return 'wire';
  }

  if (minifiedBytes != null && minifiedBytes < bytes) {
    return minifiedBytes <= max ? 'jsonmin' : 'omit';
  }

  return bytes <= max ? 'copy' : 'omit';
}

/** Byte length of a file, or null. */
export function sizeOf(path) {
  try {
    return statSync(path).size;
  } catch {
    return null;
  }
}

/** Byte length after re-serializing, or null when it is not JSON. */
export function minifiedSize(path) {
  try {
    return Buffer.byteLength(
      JSON.stringify(JSON.parse(readFileSync(path, 'utf8'))),
    );
  } catch {
    return null;
  }
}

/**
 * The harness mirror.
 *
 * Two files in the copy differ from the source, and that list is closed —
 * `test/modules/status-site.mjs` diffs `index.html` and fails on a third edit.
 * Everything else is byte-for-byte, because a transform applied to a copy is
 * invisible to `test/modules/debug-harness.mjs`.
 */
export function planDebug({ root, networks, wireEnabled = true }) {
  const ops = [];
  const warnings = [];
  const dir = join(root, 'debug');

  if (!existsSync(join(dir, 'index.html'))) {
    return {
      ops,
      warnings,
      available: false,
      reason: 'debug/index.html is missing',
    };
  }

  // -- the harness's own files --
  for (const file of readdirSync(dir)) {
    if (file.endsWith('.json') || file.endsWith('.mjs')) {
      continue;
    } // fixtures and tooling
    if (
      file === 'index.html' ||
      file === 'networks.js' ||
      file === 'livereload-setup.js'
    ) {
      continue;
    }

    ops.push(copy(join(dir, file), `debug/${file}`));
  }

  // edit 1 of 2: livereload injects an http:// script that an https deploy
  // blocks as mixed content, and there is nothing to reload anyway
  ops.push(
    write(
      'debug/livereload-setup.js',
      '// Round 46.5: stubbed by scripts/status-build.mjs.  The hosted harness has\n' +
        '// no livereload server, and the original injects an http:// script that an\n' +
        '// https deploy blocks as mixed content.  Run `npm run watch` for the live one.\n' +
        "console.info( 'status site: livereload disabled (this is a static build)' );\n",
    ),
  );

  const indexHtml = readFileSync(join(dir, 'index.html'), 'utf8');

  ops.push(write('debug/index.html', patchDebugHtml(indexHtml)));

  // -- the fixtures --
  const dropped = [];
  const wireUrls = {};
  const byPath = new Map(); // two networks share em-web; encode it once

  for (const [id, def] of Object.entries(networks)) {
    if (def.generated || def.url == null) {
      continue;
    }

    const from = def.url.startsWith('../')
      ? join(root, def.url.replace(/^\.\.\//, ''))
      : join(dir, def.url);
    const jsonTo = def.url.startsWith('../')
      ? def.url.replace(/^\.\.\//, '')
      : `debug/${def.url}`;

    // a fixture two networks share is planned once but named by both
    if (byPath.has(from)) {
      const already = byPath.get(from);

      if (already != null) {
        wireUrls[id] = already;
      }

      continue;
    }

    const bytes = sizeOf(from);

    if (bytes == null) {
      warnings.push(`${id}: ${def.url} does not exist`);
      ops.push(omit(jsonTo, 'the fixture is missing from this checkout'));
      dropped.push(id);
      byPath.set(from, null);
      continue;
    }

    const encoded = wireEnabled ? wireSize(root, from) : null;
    const policy = fixturePolicy({
      bytes,
      minifiedBytes: minifiedSize(from),
      wireBytes: encoded,
    });

    if (policy === 'wire') {
      const to = `${jsonTo.replace(/\.json$/, '')}${WIRE_EXT}`;
      // the url the page fetches, relative to debug/index.html
      const url = jsonTo.startsWith('debug/')
        ? to.slice('debug/'.length)
        : `../${to}`;

      ops.push(wire(from, to));
      wireUrls[id] = url;
      byPath.set(from, url);
      continue;
    }

    byPath.set(from, null);

    if (policy === 'omit') {
      const why =
        `${(bytes / 1048576).toFixed(1)} MiB, over the 25 MiB Pages cap,` +
        ' and neither the binary encoding nor minifying brings it under';

      warnings.push(`${id}: omitted — ${why}`);
      ops.push(omit(jsonTo, why));
      dropped.push(id);
      continue;
    }

    ops.push(policy === 'jsonmin' ? jsonmin(from, jsonTo) : copy(from, jsonTo));
  }

  // edit 2 of 2: the wire manifest, injected as a script tag.  It names only
  // the networks whose fixture was encoded, so a network that fell back to
  // JSON simply is not in it and `init.js` reads its `url` as before.
  ops.push(
    write(
      'debug/status-config.js',
      '// Round 46.5: generated by scripts/status-build.mjs.\n' +
        '// Maps a network id to its binary wire fixture.  Absent under\n' +
        '// `npm run watch`, so local development reads the JSON unchanged.\n' +
        `window.DEBUG_FIXTURE_WIRE = ${JSON.stringify(wireUrls, null, 2)};\n`,
    ),
  );

  // networks.js is appended to, never rewritten: `var networks` is in scope
  // after the source's trailing export hook, so the patch is plain assignment
  // and no regex has to understand the file
  ops.push(
    write(
      'debug/networks.js',
      readFileSync(join(dir, 'networks.js'), 'utf8') + networksPatch(dropped),
    ),
  );

  // the bundle the page loads, at the path it looks for it
  const umd = join(root, 'build', 'cytoscape.umd.js');

  if (existsSync(umd)) {
    ops.push(copy(umd, 'build/cytoscape.umd.js'));
  } else {
    return {
      ops,
      warnings,
      available: false,
      reason: 'build/cytoscape.umd.js is missing — run `npm run build`',
    };
  }

  return { ops, warnings, available: true, reason: null, dropped };
}

/** The two — and only two — edits made to the harness's page. */
export function patchDebugHtml(html) {
  return html.replace(
    '<script src="livereload-setup.js"></script>',
    '<script src="livereload-setup.js"></script>\n    <script src="status-config.js"></script>',
  );
}

/** The tail appended to the copied `networks.js`. */
export function networksPatch(dropped) {
  if (dropped.length === 0) {
    return '\n// -- generated by scripts/status-build.mjs: every network is available --\n';
  }

  return (
    `\n// -- generated by scripts/status-build.mjs (do not edit) --\n` +
    `// These networks are not available in the hosted preview.  Removing the\n` +
    `// entry is deliberate: a dropdown option that 404s is worse than one that\n` +
    `// is absent, and round 42 shipped four of exactly that.\n` +
    dropped.map((id) => `delete networks[${JSON.stringify(id)}];`).join('\n') +
    '\n'
  );
}
