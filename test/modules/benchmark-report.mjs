import {
  renderReport,
  fmtTime,
  fmtSpeedup,
} from '../../benchmark/report-html.mjs';
import { toStats, oneShotStats } from '../../benchmark/render-stats.mjs';
import { finishManualRun } from '../../benchmark/bench-run.mjs';
import { readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'chai';

const stats = (p50, extra = {}) => ({
  min: p50 * 0.9,
  max: p50 * 2,
  p25: p50 * 0.95,
  p50,
  p75: p50 * 1.05,
  p99: p50 * 1.5,
  avg: p50 * 1.02,
  ticks: 1000,
  samples: 100,
  ...extra,
});

const fixture = () => ({
  meta: {
    date: '2026-07-28T12:00:00.000Z',
    commit: 'abc1234',
    branch: 'v4',
    nodeVersion: 'v24.0.0',
    cpu: 'Test CPU',
    arch: 'arm64-darwin',
    runtime: 'node',
    profile: 'quick',
    suiteFilter: null,
    totalMs: 90000,
    failures: [],
  },
  jobs: [
    {
      suite: 'materializers',
      n: 2000,
      op: null,
      durationMs: 60000,
      context: { arch: 'arm64-darwin', runtime: 'node', cpu: 'Test CPU' },
      groups: [
        {
          name: 'sweep: nodes()',
          benches: [
            { name: 'v3', stats: stats(25000) },
            { name: 'gpu', stats: stats(2500) },
          ],
        },
        {
          name: 'sweep: <edges> & "quotes"',
          benches: [
            { name: 'v3', stats: stats(1000) },
            { name: 'gpu', stats: stats(2000) }, // a v3 win
          ],
        },
      ],
    },
    // an op-split job at the same (suite, n) must merge, deduping groups
    {
      suite: 'materializers',
      n: 2000,
      op: 'nodes',
      durationMs: 5000,
      context: { arch: 'arm64-darwin', runtime: 'node', cpu: 'Test CPU' },
      groups: [
        {
          name: 'sweep: nodes()',
          benches: [
            { name: 'v3', stats: stats(999) },
            { name: 'gpu', stats: stats(999) },
          ],
        },
      ],
    },
    // a manually-timed suite (round 33.10): one bench per group, every
    // percentile the single measurement
    {
      suite: 'labels',
      n: 20000,
      op: null,
      durationMs: 4000,
      context: { arch: 'arm64-darwin', runtime: 'node', cpu: 'Test CPU' },
      groups: [
        {
          name: 'labels: breakLines x 20000',
          benches: [{ name: 'gpu', stats: stats(76e6) }],
        },
      ],
    },
    // a gpu-only suite (no v3/gpu pair) must still render
    {
      suite: 'mappers',
      n: 2000,
      op: null,
      durationMs: 25000,
      context: { arch: 'arm64-darwin', runtime: 'node', cpu: 'Test CPU' },
      groups: [
        {
          name: 'mapper: bulk write, color',
          benches: [
            { name: 'cpu eval', stats: stats(5e6) },
            { name: 'gpu path', stats: stats(1e6) },
          ],
        },
      ],
    },
  ],
});

describe('gpu benchmark report', function () {
  describe('formatting', function () {
    it('formats times across units', function () {
      expect(fmtTime(500)).to.equal('500 ns');
      expect(fmtTime(25084.5)).to.equal('25.1 µs');
      expect(fmtTime(3.2e6)).to.equal('3.20 ms');
      expect(fmtTime(1.5e9)).to.equal('1.50 s');
    });

    it('formats speedups by magnitude', function () {
      expect(fmtSpeedup(137.4)).to.equal('137×');
      expect(fmtSpeedup(4.26)).to.equal('4.3×');
      expect(fmtSpeedup(0.834)).to.equal('0.83×');
    });
  });

  describe('renderReport', function () {
    it('produces a standalone page with the run context and sections', function () {
      const html = renderReport(fixture());

      expect(html).to.match(/^<!doctype html>/);
      expect(html).to.include('</html>');
      expect(html).to.include('abc1234');
      expect(html).to.include('Test CPU');
      expect(html).to.include('materializers');
      expect(html).to.include('mappers');
      expect(html).to.not.include('src="http'); // self-contained
      expect(html).to.not.include('href="http');
    });

    it('reports pair speedups and escapes group names', function () {
      const html = renderReport(fixture());

      expect(html).to.include('10×'); // 25000/2500
      expect(html).to.include('0.50×'); // the v3 win
      expect(html).to.include('sweep: &lt;edges&gt; &amp; &quot;quotes&quot;');
      expect(html).to.not.include('sweep: <edges>');
    });

    it('merges op-split jobs without duplicating groups', function () {
      const html = renderReport(fixture());
      const matches = html.match(/sweep: nodes\(\)/g) ?? [];

      // once in the overview, once in the section chart (title attr + text
      // count as one row via the pair), once in the details table
      expect(html.match(/999 ns/g) ?? []).to.have.length(0); // dupe group dropped
      expect(matches.length).to.be.greaterThan(0);
    });

    it('renders gpu-only benches with their own labels', function () {
      const html = renderReport(fixture());

      expect(html).to.include('cpu eval');
      expect(html).to.include('gpu path');
    });

    it('renders a single-bench (manually timed) section', function () {
      const html = renderReport(fixture());

      // round 33.10: curves.mjs and labels.mjs time one shot per row and
      // join the job table through finishManualRun, so a group may hold
      // exactly one bench and must still get a row and a table entry
      expect(html).to.include('labels: breakLines x 20000');
      expect(html).to.include('76.0 ms');
    });

    it('lists failed jobs when present', function () {
      const results = fixture();

      results.meta.failures = [
        { job: 'mutators.mjs @ N=200000 op=select', exitCode: 1 },
      ];

      const html = renderReport(results);

      expect(html).to.include('Failed jobs');
      expect(html).to.include('op=select');
    });

    it('renders an empty run without throwing', function () {
      const html = renderReport({
        meta: { totalMs: 0, failures: [] },
        jobs: [],
      });

      expect(html).to.include('</html>');
    });

    it('renders a section note once per (suite, n)', function () {
      const results = fixture();

      results.jobs[0].note = 'Wall frame times are vsync-bound.';
      results.jobs[1].note = 'A different note that must not double-render.';

      const html = renderReport(results);

      expect(html).to.include('Wall frame times are vsync-bound.');
      expect(html).to.not.include('must not double-render');
    });
  });

  describe('finishManualRun (round 33.10)', function () {
    let dir;

    beforeEach(function () {
      dir = mkdtempSync(join(tmpdir(), 'gpu-bench-'));
    });

    it('writes the report job shape from one-shot rows', function () {
      const path = join(dir, 'job.json');

      process.env.BENCH_JSON = path;

      try {
        finishManualRun('curves', [
          {
            name: 'curve premium: drag',
            benches: [
              { name: 'curved', ms: 12 },
              { name: 'straight', ms: 8 },
            ],
          },
        ]);
      } finally {
        delete process.env.BENCH_JSON;
      }

      const job = JSON.parse(readFileSync(path, 'utf8'));

      expect(job.suite).to.equal('curves');
      expect(job.groups).to.have.length(1);
      expect(job.groups[0].benches.map((b) => b.name)).to.eql([
        'curved',
        'straight',
      ]);

      // a one-shot measurement is every percentile of itself, in ns
      const s = job.groups[0].benches[0].stats;

      expect(s.p50).to.equal(12e6);
      expect(s.p99).to.equal(12e6);
      expect(s.min).to.equal(12e6);
      expect(s.samples).to.equal(1);

      // and the shape the report reads must survive a round-trip
      expect(() =>
        renderReport({
          meta: { totalMs: 1, failures: [] },
          jobs: [{ ...job, durationMs: 1 }],
        }),
      ).to.not.throw();
    });

    it('writes nothing without BENCH_JSON (terminal runs are unchanged)', function () {
      delete process.env.BENCH_JSON;

      expect(() => finishManualRun('curves', [])).to.not.throw();
    });

    afterEach(function () {
      rmSync(dir, { recursive: true, force: true });
    });
  });

  describe('render-bench stat shaping', function () {
    it('converts sampled ms to the ns stats shape with mitata indexing', function () {
      const s = toStats([3, 1, 2, 4, 5]); // ms

      expect(s.min).to.equal(1e6);
      expect(s.max).to.equal(5e6);
      expect(s.p50).to.equal(3e6);
      expect(s.p25).to.equal(2e6); // (0.25 * 4) | 0 = index 1
      expect(s.avg).to.equal(3e6);
      expect(s.samples).to.equal(5);
    });

    it('returns null for no samples and a flat one-shot otherwise', function () {
      expect(toStats([])).to.equal(null);

      const s = oneShotStats(250);

      expect(s.p50).to.equal(250e6);
      expect(s.p99).to.equal(250e6);
      expect(s.samples).to.equal(1);
    });
  });

  /*
  Round 46.5: the machine and provenance block.

  Controls run while writing (each failed the spec named):
    - `machineBlock` made to return its table unconditionally rather than `''`
      for an absent `meta.machine` — fails 'renders exactly as before'.
    - the physical/logical row collapsed to a single core count — fails
      'distinguishes physical cores from logical'.
    - the `esc` calls dropped from the row values — fails 'escapes what other
      programs produced'.
    - `meta.dirty` ignored — fails 'says so when the tree was dirty'.
  */
  describe('machine and provenance block', function () {
    const machine = () => ({
      cpu: {
        model: 'Intel(R) Core(TM) i9-9900K CPU @ 3.60GHz',
        physicalCores: 8,
        logicalCores: 16,
        baseGHz: 3.6,
        maxGHz: 5,
      },
      memory: { totalBytes: 65686240 * 1024 },
      os: {
        platform: 'linux',
        distro: 'Fedora Linux 43',
        kernel: '6.19.14',
        arch: 'x64',
      },
      node: { version: 'v24.18.0', v8: '13.6.233.17-node.50' },
      gpus: [
        {
          vendor: 'Intel Corporation',
          model: 'UHD Graphics 630',
          driver: 'i915',
          vramBytes: null,
        },
        {
          vendor: 'AMD',
          model: 'Ellesmere [Radeon RX 580]',
          driver: 'amdgpu',
          vramBytes: 8589934592,
        },
      ],
      probe: { errors: [] },
      fingerprint: '2d2ea233',
    });

    const withMachine = (extra) => {
      const f = fixture();

      f.meta = { ...f.meta, machine: machine(), ...extra };

      return renderReport(f);
    };

    it('renders exactly as before for a results file with no machine block', function () {
      // the backward-compatibility contract, and the reason it is a spec: the
      // status site re-renders every published run it finds, including every
      // one written before round 46.5
      const html = renderReport(fixture());

      expect(html).to.not.match(/Machine and provenance/);
      expect(html).to.not.match(/physical \/ /);
    });

    it('distinguishes physical cores from logical', function () {
      // 8 and 16 are different numbers here; a block reporting one core count
      // would satisfy any assertion that only looked for a digit
      expect(withMachine()).to.match(/8 physical \/ 16 logical/);
    });

    it('says when the run was concurrent, and says nothing when it was not', function () {
      // round 68: the harness hash already stops the comparison drawing a
      // line from a serial run to this one, but the page is read on its own
      // too, and a reader wondering why every row sits above the archive's
      // deserves the reason on the page rather than in a commit message
      const parallel = withMachine({ concurrency: 6 });

      expect(parallel).to.match(/Concurrency/);
      expect(parallel).to.match(/6 jobs at once/);
      expect(parallel).to.match(/not comparable with a serial run/);

      const serial = withMachine({ concurrency: 1 });

      expect(serial).to.not.match(/Concurrency/);
      expect(withMachine()).to.not.match(/Concurrency/);
    });

    it('reports the clocks, the memory and every GPU with its VRAM', function () {
      const html = withMachine();

      expect(html).to.match(/3\.6 GHz base/);
      expect(html).to.match(/5 GHz max/);
      expect(html).to.match(/62\.6 GiB/); // 65686240 KiB
      expect(html).to.match(/UHD Graphics 630/); // the integrated card too
      expect(html).to.match(/Radeon RX 580/);
      expect(html).to.match(/8\.0 GiB/); // only the discrete one has VRAM
    });

    it('names the adapter that actually rendered, separately from the inventory', function () {
      // the GPU row is what is installed; the adapter row is what WebGPU chose,
      // and on a two-card box those are different questions
      const html = withMachine({
        adapter: { vendor: 'amd', architecture: 'gcn-4', description: '' },
      });

      expect(html).to.match(/amd gcn-4/);
    });

    it('says so when the tree was dirty', function () {
      // a measurement from a dirty tree is not attributable to its sha
      expect(withMachine({ dirty: true })).to.match(/uncommitted changes/);
      expect(withMachine({ dirty: false })).to.not.match(/uncommitted changes/);
    });

    it('escapes what other programs produced', function () {
      // every value in this block is lspci output, a git subject or a WebGPU
      // description — none of it is ours
      const f = fixture();

      f.meta = {
        ...f.meta,
        machine: {
          ...machine(),
          cpu: {
            ...machine().cpu,
            model: 'Evil <script>alert(1)</script> CPU',
          },
        },
        commitSubject: 'fix: <b>bold</b> & "quoted"',
      };

      const html = renderReport(f);

      expect(html).to.not.match(/<script>alert/);
      expect(html).to.match(/&lt;script&gt;alert/);
      expect(html).to.match(
        /&lt;b&gt;bold&lt;\/b&gt; &amp; &quot;quoted&quot;/,
      );
    });

    it('omits a row it has no value for, rather than printing null', function () {
      const f = fixture();

      f.meta = {
        ...f.meta,
        machine: {
          ...machine(),
          memory: { totalBytes: null },
          fingerprint: null,
        },
      };

      const html = renderReport(f);

      expect(html).to.not.match(/>null</);
      expect(html).to.not.match(/Machine id/);
      expect(html).to.match(/Machine and provenance/); // the rest still renders
    });

    it('stays self-contained', function () {
      // the property the whole report is built on, re-checked with the new block
      const html = withMachine({
        adapter: { vendor: 'amd', architecture: 'gcn-4' },
      });

      expect(html).to.not.match(/src="http/);
      expect(html).to.not.match(/href="http/);
    });
  });
});

// Round 65.8: the executor sweep's cpu-baseline pairs.  `pairOf` treats a
// group holding exact-named `cpu` and `gpu` benches as a comparison pair —
// both sides v4 — beside the classic v3/gpu form; a bench merely *containing*
// "cpu" (the mappers suite's 'cpu eval') must stay a plain row.
describe('cpu-baseline pairs (the algorithms-gpu profile, 65.8)', function () {
  const cpuFixture = () => ({
    meta: {
      date: '2026-08-10T18:00:00.000Z',
      commit: 'abc1234',
      branch: 'v4',
      profile: 'algorithms-gpu',
      totalMs: 60000,
      failures: [],
    },
    jobs: [
      {
        suite: 'algorithms-gpu',
        n: 1024,
        op: null,
        durationMs: 9000,
        context: { arch: null, runtime: 'chromium', cpu: null },
        groups: [
          {
            name: 'markovClustering',
            benches: [
              { name: 'cpu', stats: stats(31e9) },
              { name: 'gpu', stats: stats(47e6) },
              { name: 'gpu first call', stats: stats(65e6) },
            ],
          },
        ],
      },
    ],
  });

  it('renders a cpu/gpu group as a pair with its speedup', function () {
    const html = renderReport(cpuFixture());

    expect(html).to.include('660×'); // 31e9 / 47e6
    expect(html).to.include('v4 (cpu)'); // the legend names the baseline
    expect(html).to.include('1 cpu-vs-gpu comparisons');
    expect(html).to.include('cpu still ahead');
    expect(html).to.include('cpu p50 ÷ gpu p50');
    expect(html).to.include('algorithms-gpu profile');
    // the tagline names the run's own comparison, not the v3 one
    expect(html).to.include("v4 executor 'cpu' vs 'gpu'");
    expect(html).to.not.include('vs v3 (v3/src/)');
  });

  it('control: an inexact bench name is not a baseline', function () {
    const results = cpuFixture();

    results.jobs[0].groups[0].benches[0].name = 'cpu eval';

    const html = renderReport(results);

    expect(html).to.not.include('660×');
    expect(html).to.not.include('cpu-vs-gpu');
  });

  it('a mixed run counts both pair kinds and hedges the ahead tile', function () {
    const results = cpuFixture();

    results.jobs.push({
      suite: 'traversal',
      n: 2000,
      op: null,
      durationMs: 4000,
      context: { arch: null, runtime: 'node', cpu: null },
      groups: [
        {
          name: 'bfs',
          benches: [
            { name: 'v3', stats: stats(34e6) },
            { name: 'gpu', stats: stats(1e6) },
          ],
        },
      ],
    });

    const html = renderReport(results);

    expect(html).to.include('1 v3-vs-gpu + 1 cpu-vs-gpu comparisons');
    expect(html).to.include('baseline still ahead');
  });
});
