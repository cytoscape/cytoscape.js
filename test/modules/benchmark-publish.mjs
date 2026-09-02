import { expect } from 'chai';
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  mkdirSync,
  utimesSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  summarize,
  sortRuns,
  pruneRuns,
  readIndex,
  loadPublished,
  parseArgs,
  newestResults,
} from '../../scripts/benchmark-publish.mjs';

/*
Round 46.5: the benchmark archive's bookkeeping.

The publish step is the only thing standing between "a number was measured"
and "a number is published on a site", so its two judgements get specs: what
an index entry claims about a run, and which runs a prune keeps.

Controls run while writing (each failed the spec named):
  - `pruneRuns` keyed on profile alone, ignoring the fingerprint — fails
    'keeps a run per machine, not n runs overall'.  This is the one that
    matters: with a single machine in the fixture the broken version agrees.
  - `sortRuns` left in insertion order — fails 'orders newest first'.
  - `summarize` reading `meta.machine.cpu.model` directly rather than through
    `machineLine` — fails 'summarizes the machine in one line'.
  - `loadPublished`'s catch made to rethrow — fails 'skips an index entry
    whose results file is gone'.

That last control is worth recording, because its *first* aim missed and the
miss was informative.  It originally deleted an `existsSync` guard above the
catch, and every spec still passed — the catch already handled a missing file,
so the guard was dead code.  The guard is gone and the control now targets
what actually implements the behaviour.  A control that fails to fail is not a
wasted control.
*/

const machine = (over = {}) => ({
  cpu: {
    model: 'Intel(R) Core(TM) i9-9900K CPU @ 3.60GHz',
    physicalCores: 8,
    logicalCores: 16,
    baseGHz: 3.6,
    maxGHz: 5,
  },
  memory: { totalBytes: 67262709760 },
  os: {
    platform: 'linux',
    distro: 'Fedora Linux 43',
    kernel: '6.19.14',
    arch: 'x64',
  },
  node: { version: 'v24.18.0', v8: '13.6' },
  gpus: [
    {
      vendor: 'AMD',
      model: 'Radeon RX 580',
      driver: 'amdgpu',
      vramBytes: 8589934592,
    },
  ],
  probe: { errors: [] },
  fingerprint: '2d2ea233',
  ...over,
});

const results = (over = {}) => ({
  meta: {
    date: '2026-08-05T17:00:00.000Z',
    commit: 'abc1234',
    commitSubject: 'feat: a thing',
    branch: 'v4',
    profile: 'quick',
    suiteFilter: null,
    dirty: false,
    totalMs: 426000,
    nodeVersion: 'v24.18.0',
    machine: machine(),
    adapter: null,
    ...over,
  },
  jobs: [{ suite: 'mappers', n: 2000, groups: [] }],
});

describe('benchmark archive: summarize', () => {
  it('carries the fingerprint, which is the grouping key for a trend', () => {
    // runs from different boxes are not comparable; without this the site
    // cannot tell one machine's history from another's
    expect(summarize(results(), { file: 'r.json' }).fingerprint).to.equal(
      '2d2ea233',
    );
  });

  it('carries the Node version, which the fingerprint ignores by design', () => {
    // round 113.1: a Node upgrade must not split a machine's history, so the
    // index is where a reader sees a step coincide with one
    expect(summarize(results(), { file: 'r.json' }).node).to.equal('v24.18.0');
  });

  it('summarizes the machine in one line', () => {
    const entry = summarize(results(), { file: 'r.json' });

    expect(entry.machine).to.match(/i9-9900K/);
    expect(entry.machine).to.match(/8c\/16t/);
    expect(entry.machine).to.match(/Radeon RX 580 \(8\.0 GiB\)/);
  });

  it('flattens the adapter, and answers null when there was none', () => {
    expect(summarize(results(), { file: 'r.json' }).adapter).to.equal(null);

    const withAdapter = summarize(
      results({
        adapter: { vendor: 'amd', architecture: 'gcn-4', description: '' },
      }),
      { file: 'r.json' },
    );

    expect(withAdapter.adapter).to.equal('amd gcn-4');
  });

  it('keeps the dirty flag, so a published run cannot hide it', () => {
    expect(
      summarize(results({ dirty: true }), { file: 'r.json' }).dirty,
    ).to.equal(true);
  });

  it('survives a results file with no machine block at all', () => {
    // every run published before round 46.5 is one of these
    const entry = summarize(
      {
        meta: { date: '2026-07-01T00:00:00.000Z', profile: 'quick' },
        jobs: [],
      },
      { file: 'old.json' },
    );

    expect(entry.fingerprint).to.equal(null);
    expect(entry.machine).to.equal(null);
    expect(entry.date).to.equal('2026-07-01T00:00:00.000Z');
  });

  it('keeps the worker count, so a concurrent run cannot enter the archive quietly', () => {
    // round 68: publishing one takes --allow-concurrent, and the index says
    // so afterwards — the archive is serial, and a row measured beside five
    // neighbours is a different measurement, not a slower one
    expect(
      summarize(results({ concurrency: 6 }), { file: 'r.json' }).concurrency,
    ).to.equal(6);
    expect(
      summarize(results({ concurrency: 1 }), { file: 'r.json' }).concurrency,
    ).to.equal(1);
    // and every run published before round 68 carries no such field: null is
    // the honest answer, the same one `dirty` gives for a pre-46.5 run
    expect(summarize(results(), { file: 'r.json' }).concurrency).to.equal(null);
  });

  it('records the note verbatim', () => {
    expect(
      summarize(results(), { file: 'r.json', note: 'round 46.5 baseline' })
        .note,
    ).to.equal('round 46.5 baseline');
  });
});

describe('benchmark archive: ordering and prune', () => {
  const run = (date, fingerprint, profile = 'quick') => ({
    file: `${date}.json`,
    date,
    fingerprint,
    profile,
  });

  it('orders newest first', () => {
    const sorted = sortRuns([
      run('2026-08-01'),
      run('2026-08-05'),
      run('2026-08-03'),
    ]);

    expect(sorted.map((r) => r.date)).to.eql([
      '2026-08-05',
      '2026-08-03',
      '2026-08-01',
    ]);
  });

  it('sorts a dateless run last rather than dropping it', () => {
    const sorted = sortRuns([{ file: 'x.json' }, run('2026-08-01')]);

    expect(sorted).to.have.lengthOf(2);
    expect(sorted[1].file).to.equal('x.json');
  });

  it('keeps a run per machine, not n runs overall', () => {
    // two boxes, two runs each, prune to 1: one survivor *per box*.  A prune
    // keyed on profile alone would keep one run in total and silently delete
    // the other machine's whole history
    const { keep, drop } = pruneRuns(
      [
        run('2026-08-05', 'aaa'),
        run('2026-08-04', 'aaa'),
        run('2026-08-03', 'bbb'),
        run('2026-08-02', 'bbb'),
      ],
      1,
    );

    expect(keep.map((r) => r.fingerprint).sort()).to.eql(['aaa', 'bbb']);
    expect(drop.map((r) => r.date).sort()).to.eql(['2026-08-02', '2026-08-04']);
  });

  it('keeps profiles apart on one machine', () => {
    // a renderer run and a quick run measure different things; pruning one
    // against the other would delete a whole profile's history
    const { keep } = pruneRuns(
      [run('2026-08-05', 'aaa', 'quick'), run('2026-08-04', 'aaa', 'renderer')],
      1,
    );

    expect(keep).to.have.lengthOf(2);
  });

  it('drops nothing when the archive is under the limit', () => {
    const { keep, drop } = pruneRuns([run('2026-08-05', 'aaa')], 5);

    expect(keep).to.have.lengthOf(1);
    expect(drop).to.eql([]);
  });
});

describe('benchmark archive: on disk', () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cy-published-'));
  });

  const cleanup = () => rmSync(dir, { recursive: true, force: true });

  it('reads an empty archive as empty rather than throwing', () => {
    expect(readIndex(dir).runs).to.eql([]);
    expect(loadPublished(dir)).to.eql([]);
    cleanup();
  });

  it('reads a corrupt index as empty rather than throwing', () => {
    writeFileSync(join(dir, 'index.json'), 'not json');
    expect(readIndex(dir).runs).to.eql([]);
    cleanup();
  });

  it('loads each run with its results attached', () => {
    writeFileSync(join(dir, 'r1.json'), JSON.stringify(results()));
    writeFileSync(
      join(dir, 'index.json'),
      JSON.stringify({
        runs: [
          {
            file: 'r1.json',
            date: '2026-08-05T17:00:00.000Z',
            profile: 'quick',
            fingerprint: 'aaa',
          },
        ],
      }),
    );

    const loaded = loadPublished(dir);

    expect(loaded).to.have.lengthOf(1);
    expect(loaded[0].results.meta.commit).to.equal('abc1234');
    cleanup();
  });

  it('skips an index entry whose results file is gone', () => {
    // the archive is hand-editable and lives in git; a stale index entry must
    // not take the whole status build down
    writeFileSync(
      join(dir, 'index.json'),
      JSON.stringify({
        runs: [
          {
            file: 'missing.json',
            date: '2026-08-05T17:00:00.000Z',
            profile: 'quick',
          },
        ],
      }),
    );

    expect(loadPublished(dir)).to.eql([]);
    cleanup();
  });

  it('finds the newest results file by mtime', () => {
    const older = join(dir, 'results-z.json'); // z, so name order would lose
    const newer = join(dir, 'results-a.json');

    writeFileSync(older, '{}');
    writeFileSync(newer, '{}');

    // two files written back to back land in the same millisecond, so the
    // times are set explicitly — otherwise this spec is a coin flip and tests
    // readdir order rather than the mtime sort it is named for.  The names are
    // deliberately reversed against the times, so a sort on either alone fails.
    utimesSync(older, new Date(1000), new Date(1000));
    utimesSync(newer, new Date(2000), new Date(2000));

    expect(newestResults(dir)).to.equal(newer);
    cleanup();
  });

  it('answers null when there is nowhere to look', () => {
    expect(newestResults(join(dir, 'nope'))).to.equal(null);
    mkdirSync(join(dir, 'empty'));
    expect(newestResults(join(dir, 'empty'))).to.equal(null);
    cleanup();
  });
});

describe('benchmark archive: argument parsing', () => {
  it('reads a value flag and a positional in one scan', () => {
    const { flags, positional } = parseArgs([
      '--note',
      'a run',
      'results.json',
      '--dry-run',
    ]);

    expect(flags['--note']).to.equal('a run');
    expect(flags['--dry-run']).to.equal(true);
    expect(positional).to.eql(['results.json']);
  });

  it('does not mistake a positional for a flag value it happens to repeat', () => {
    // the reason this is a single left-to-right scan and not an indexOf: with
    // `--note test` and a positional `test`, indexOf finds the first `test`
    // and drops the real argument
    const { flags, positional } = parseArgs(['--note', 'test', 'test']);

    expect(flags['--note']).to.equal('test');
    expect(positional).to.eql(['test']);
  });

  it('treats a value flag with nothing after it as null, not as a crash', () => {
    expect(parseArgs(['--note']).flags['--note']).to.equal(null);
  });
});
