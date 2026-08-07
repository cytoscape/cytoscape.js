// Round 46.5: what the checkout looks like right now.
//
// The status site's header, and `status/version.json` — the machine-readable
// form, which is what the site's spec asserts against and what a monitor can
// poll.
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { describeMachine } from '../machine-info.mjs';

/** git, or `null` for any failure — the site still builds outside a checkout. */
export function git(root, ...args) {
  try {
    const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });

    return r.status === 0 ? r.stdout.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Extensions that end up in a bundle.
 *
 * The staleness comparison is only meaningful over these.  Walking *every*
 * file under `src/` counts `src/README.md`, which this repo's process rules
 * require updating on essentially every commit — so the "bundle is stale"
 * tile would light up after a docs edit, when nothing about the code had
 * moved.  `benchmark/render-bench.mjs` had the identical bug and this module
 * inherited it by writing the same walk from scratch.
 */
export const SOURCE_EXT = /\.(m?[jt]s|wgsl|json)$/;

/** The newest mtime under a directory, recursively. `0` if unreadable. */
export function newestMtime(
  dir,
  skip = new Set(['node_modules', '.git']),
  match = SOURCE_EXT,
) {
  let newest = 0;

  const walk = (path) => {
    let entries;

    try {
      entries = readdirSync(path, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (skip.has(entry.name)) {
        continue;
      }

      const child = join(path, entry.name);

      if (entry.isDirectory()) {
        walk(child);
      } else if (match.test(entry.name)) {
        try {
          newest = Math.max(newest, statSync(child).mtimeMs);
        } catch {
          /* raced with a write; the next file is as good */
        }
      }
    }
  };

  walk(dir);

  return newest;
}

/** The rolldown outputs, with sizes. */
export function bundleSizes(root, { gzip = true } = {}) {
  const dir = join(root, 'build');

  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir)
    .filter((f) => /\.(js|mjs)$/.test(f))
    .sort()
    .map((file) => {
      const path = join(dir, file);

      try {
        const buf = readFileSync(path);

        return {
          file,
          bytes: buf.length,
          // level 9 rather than brotli: Cloudflare recomputes it anyway, and
          // brotli on a 4.6 MB dev bundle is seconds for a number nobody acts on
          gzipBytes: gzip ? gzipSync(buf, { level: 9 }).length : null,
          mtime: statSync(path).mtimeMs,
        };
      } catch {
        return null;
      }
    })
    .filter((b) => b != null);
}

/**
 * Assemble the state.
 *
 * `staleness` is the field to insist on.  This repo's single most-repeated
 * operational failure is trusting a stale bundle — AGENTS.md says so twice —
 * and a preview site that served one without saying so would be a new
 * instance of exactly that.
 */
export function repoState(root, { now = Date.now(), gzip = true } = {}) {
  const sha = git(root, 'rev-parse', 'HEAD');
  const dirtyOut = git(root, 'status', '--porcelain');
  const dirtyFiles =
    dirtyOut == null || dirtyOut === '' ? [] : dirtyOut.split('\n');
  const authorDate = git(root, 'log', '-1', '--format=%aI');

  const bundles = bundleSizes(root, { gzip });
  const umd =
    bundles.find((b) => b.file === 'cytoscape.umd.js') ?? bundles[0] ?? null;
  const newestSource = newestMtime(join(root, 'src'));

  return {
    branch: git(root, 'rev-parse', '--abbrev-ref', 'HEAD'),
    commit: {
      sha,
      short: sha != null ? sha.slice(0, 8) : null,
      subject: git(root, 'log', '-1', '--format=%s'),
      authorDate,
      ageMs: authorDate != null ? now - Date.parse(authorDate) : null,
      // '' means "not on any remote branch" — so a blob link built from this
      // sha would 404, which the site needs to know before it makes one
      pushed: (git(root, 'branch', '-r', '--contains', 'HEAD') ?? '') !== '',
    },
    dirty: { count: dirtyFiles.length, files: dirtyFiles.slice(0, 20) },
    builtAt: new Date(now).toISOString(),
    bundles,
    staleness: {
      newestSourceMtime: newestSource || null,
      bundleMtime: umd?.mtime ?? null,
      staleByMs:
        umd != null && newestSource > 0
          ? Math.max(0, newestSource - umd.mtime)
          : null,
    },
    machine: describeMachine(),
  };
}
