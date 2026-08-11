import { expect } from 'chai';

import {
  rowsOf,
  buildComparison,
  comparePageName,
  renderComparison,
  fmtChange,
  screenOf,
  NOTABLE_CHANGE,
} from '../../benchmark/report-compare.mjs';
import { EQUIVALENT_HARNESSES } from '../../benchmark/harness-id.mjs';
import { planComparisons } from '../../scripts/status/bench-pages.mjs';

/*
The cross-commit comparison (benchmark/report-compare.mjs + the status site's
comparison pages).

The module's whole job is a join over published runs, so the specs pin the
join's judgements: which rows exist, what a change is when a run skipped a
row, which rows count as movers, and the one rule that runs from different
machines never share a page.

Controls run while writing (each failed the spec named):
  - change computed prev/latest instead of latest/prev — fails the
    regression spec (the 1.5× slower row reads as an improvement);
  - the gap fallback removed (change only between *adjacent* runs) — fails
    the gap spec (the row measured in runs 1 and 3 loses its change);
  - v3 rows admitted into the movers — fails the frozen-v3 spec;
  - the fingerprint guard removed — fails the mixed-machines spec;
  - `planComparisons` grouping all profiles together — fails the
    per-profile spec (one page appears where none may).
*/

// round 65.12: a bench carries the evidence a screen reads.  The default is a
// row measured by three processes that agreed to within 2%, which is what a
// `--repeat 3` run produces — so the fixtures below exercise the screened path,
// and the specs that want the unscreened path say so explicitly.
const bench = (name, p50, stats = {}) => ({
  name,
  stats: {
    p50,
    min: p50,
    max: p50,
    avg: p50,
    samples: 10,
    repeats: 3,
    repeatSpread: 1.02,
    ...stats,
  },
});

const run = ({
  commit,
  date,
  groups,
  fingerprint = 'aaaa1111',
  profile = 'quick',
  suiteFilter = null,
  harness = 'hhhh0001',
}) => ({
  file: `results-${date}.json`,
  date,
  commit,
  dirty: false,
  note: null,
  fingerprint,
  profile,
  suiteFilter,
  results: {
    meta: { commit, date },
    jobs: [{ suite: 'style', n: 2000, op: null, groups, harness }],
  },
});

// three runs of one machine: a real regression with a flat v3 control, a
// row with a gap, and a sub-threshold wobble
const fixtureRuns = () => [
  run({
    commit: 'aaa0001',
    date: '2026-08-01T00-00-00-000Z',
    groups: [
      {
        name: 'read: background-color',
        benches: [bench('v3', 101), bench('gpu', 100)],
      },
      { name: 'apply: sheet', benches: [bench('gpu', 200)] },
      { name: 'tiny move', benches: [bench('gpu', 100)] },
    ],
  }),
  run({
    commit: 'bbb0002',
    date: '2026-08-02T00-00-00-000Z',
    groups: [
      {
        name: 'read: background-color',
        benches: [bench('v3', 100), bench('gpu', 100)],
      },
      // 'apply: sheet' deliberately unmeasured here (a --suite filter run)
      { name: 'tiny move', benches: [bench('gpu', 100)] },
    ],
    suiteFilter: 'style-read',
  }),
  run({
    commit: 'ccc0003',
    date: '2026-08-03T00-00-00-000Z',
    groups: [
      {
        name: 'read: background-color',
        benches: [bench('v3', 99), bench('gpu', 150)],
      },
      { name: 'apply: sheet', benches: [bench('gpu', 100)] },
      { name: 'tiny move', benches: [bench('gpu', 105)] },
    ],
  }),
];

describe('benchmark cross-commit comparison', () => {
  describe('rowsOf', () => {
    it('flattens jobs to (suite, n, group, bench) rows and keeps the first-seen duplicate', () => {
      const rows = rowsOf({
        jobs: [
          {
            suite: 's',
            n: 2000,
            groups: [{ name: 'g', benches: [bench('gpu', 10)] }],
          },
          // the per-BENCH_OP split re-lists the same group; first seen wins,
          // exactly as the report's own section merge does
          {
            suite: 's',
            n: 2000,
            groups: [{ name: 'g', benches: [bench('gpu', 999)] }],
          },
        ],
      });

      expect(rows.size).to.equal(1);
      expect([...rows.values()][0].p50).to.equal(10);
    });

    it('skips a bench with no usable p50 rather than comparing garbage', () => {
      const rows = rowsOf({
        jobs: [
          {
            suite: 's',
            n: 1,
            groups: [
              {
                name: 'g',
                benches: [{ name: 'gpu', stats: { p50: 0 } }, { name: 'x' }],
              },
            ],
          },
        ],
      });

      expect(rows.size).to.equal(0);
    });
  });

  describe('buildComparison', () => {
    it('reports a regression as latest over previous, with the frozen v3 twin as its control', () => {
      const c = buildComparison(fixtureRuns());
      const reg = c.movers.regressions.find(
        (m) => m.row.group === 'read: background-color',
      );

      expect(reg, 'the 1.5x row must be listed').to.not.equal(undefined);
      expect(reg.row.bench).to.equal('gpu');
      expect(reg.row.change).to.be.closeTo(1.5, 1e-9);
      // v3 moved 99/100 over the same span — near 1, the machine held still
      expect(reg.control).to.be.closeTo(0.99, 1e-9);
    });

    it('bridges a gap: a row unmeasured by the middle run compares latest against the nearest earlier run', () => {
      const c = buildComparison(fixtureRuns());
      const row = c.rows.find((r) => r.group === 'apply: sheet');

      expect(row.series).to.deep.equal([200, null, 100]);
      expect(row.change).to.be.closeTo(0.5, 1e-9);
      // and it lands in the improvements, since it got faster
      const imp = c.movers.improvements.find(
        (m) => m.row.group === 'apply: sheet',
      );

      expect(imp).to.not.equal(undefined);
    });

    it('does not list a sub-threshold wobble as a mover', () => {
      const c = buildComparison(fixtureRuns());
      const all = [...c.movers.regressions, ...c.movers.improvements];

      // 105/100 is 5%, inside NOTABLE_CHANGE — flat, not news
      expect(NOTABLE_CHANGE).to.be.greaterThan(0.05);
      expect(all.some((m) => m.row.group === 'tiny move')).to.equal(false);
    });

    it('never lists a v3 row as a mover — v3 is frozen code, so its movement is the machine', () => {
      const runs = fixtureRuns();

      // make the v3 side move 2x, which would top any movers list it joined
      runs[2].results.jobs[0].groups[0].benches[0] = bench('v3', 200);

      const c = buildComparison(runs);
      const all = [...c.movers.regressions, ...c.movers.improvements];

      expect(all.some((m) => m.row.bench === 'v3')).to.equal(false);
      // it still counts toward drift, though — that is what drift is for
      expect(c.drift).to.be.greaterThan(1);
    });

    it('refuses runs from different machines', () => {
      const runs = fixtureRuns();

      runs[1].fingerprint = 'bbbb2222';

      expect(() => buildComparison(runs)).to.throw(/machine/);
    });

    it('computes drift as the geometric mean change over every row, v3 included', () => {
      const c = buildComparison(fixtureRuns());
      // changes: v3 99/100, gpu 150/100, sheet 100/200, tiny 105/100
      const expected = Math.exp(
        [0.99, 1.5, 0.5, 1.05].reduce((s, x) => s + Math.log(x), 0) / 4,
      );

      expect(c.sharedRows).to.equal(4);
      expect(c.drift).to.be.closeTo(expected, 1e-9);
    });
  });

  // Round 65.12.  Controls run while writing, each failing exactly the spec
  // named: `sameEpoch` forced to true — fails the break spec (the row is
  // compared across the harness change and reappears as a mover); `screenOf`
  // forced to `{ screened: true }` — fails all three screening specs; the cpu
  // fallback removed from `twinOf` — fails the cpu-twin spec.
  describe('the harness epoch (65.12)', () => {
    const withHarness = (runs, hashes) =>
      runs.map((r, i) => {
        r.results.jobs[0].harness = hashes[i];

        return r;
      });

    it('refuses to compare a row across a harness change, and says how many', () => {
      const c = buildComparison(
        withHarness(fixtureRuns(), ['h1', 'h1', 'h2-different']),
      );
      const row = c.rows.find(
        (r) => r.group === 'read: background-color' && r.bench === 'gpu',
      );

      expect(row.change, 'a cross-epoch change must not be computed').to.equal(
        null,
      );
      expect(row.epochBreak).to.equal(true);
      expect(c.epochBreaks).to.be.greaterThan(0);
      // and the 1.5x row is not a regression, because it is not a comparison
      expect(
        c.movers.regressions.some(
          (m) => m.row.group === 'read: background-color',
        ),
      ).to.equal(false);
    });

    it('renders the break in the matrix and leads the page with it, rather than claiming nothing regressed', () => {
      const html = renderComparison(
        buildComparison(withHarness(fixtureRuns(), ['h1', 'h1', 'h2'])),
        { machine: 'Test CPU' },
      );

      expect(html).to.include('⋮ harness');
      expect(html).to.include('could not be compared at all');
    });

    it('compares across a change the equivalence ledger declares non-substantive', () => {
      EQUIVALENT_HARNESSES.push({
        from: 'h1',
        to: 'h2',
        reason: 'spec fixture: a declared-cosmetic change',
      });

      try {
        const c = buildComparison(
          withHarness(fixtureRuns(), ['h1', 'h1', 'h2']),
        );
        const row = c.rows.find(
          (r) => r.group === 'read: background-color' && r.bench === 'gpu',
        );

        expect(row.epochBreak).to.equal(false);
        expect(row.change).to.be.closeTo(1.5, 1e-9);
      } finally {
        EQUIVALENT_HARNESSES.pop();
      }
    });

    it('treats an unstamped run as unknown, not as unchanged', () => {
      const c = buildComparison(withHarness(fixtureRuns(), ['h1', 'h1', null]));

      expect(c.rows.find((r) => r.group === 'tiny move').epochBreak).to.equal(
        true,
      );
    });
  });

  describe('screening a mover (65.12)', () => {
    const rowWith = (evidence, change = 1.5) => ({
      change,
      prevAt: 0,
      latestAt: 1,
      evidence,
    });

    it("screens a change that clears the row's own measured band", () => {
      const s = screenOf(
        rowWith([
          { samples: 10, repeats: 3, repeatSpread: 1.05 },
          { samples: 10, repeats: 3, repeatSpread: 1.05 },
        ]),
      );

      expect(s.screened).to.equal(true);
      expect(s.band).to.be.closeTo(1.05, 1e-9);
    });

    it('does not screen a change inside the band, and says which band', () => {
      const s = screenOf(
        rowWith(
          [
            { samples: 10, repeats: 3, repeatSpread: 1.3 },
            { samples: 10, repeats: 3, repeatSpread: 1.2 },
          ],
          1.25,
        ),
      );

      expect(s.screened).to.equal(false);
      // the wider of the two bands is the one that matters
      expect(s.why).to.include('30%');
    });

    it('does not screen a one-shot row — the class round 62.7 already ruled out', () => {
      const s = screenOf(
        rowWith([
          { samples: 1, repeats: 1, repeatSpread: null },
          { samples: 1, repeats: 1, repeatSpread: null },
        ]),
      );

      expect(s.screened).to.equal(false);
      expect(s.why).to.include('one-shot');
    });

    it('does not screen a row with no repeats on either side', () => {
      const s = screenOf(
        rowWith([
          { samples: 10, repeats: 1, repeatSpread: null },
          { samples: 10, repeats: 1, repeatSpread: null },
        ]),
      );

      expect(s.screened).to.equal(false);
      expect(s.why).to.include('no repeats');
    });

    it('lists an unscreened mover separately rather than dropping or ranking it', () => {
      const runs = fixtureRuns();

      for (const r of runs) {
        r.results.jobs[0].groups[0].benches[1].stats.repeats = 1;
        r.results.jobs[0].groups[0].benches[1].stats.repeatSpread = null;
      }

      const c = buildComparison(runs);

      expect(
        c.movers.regressions.some(
          (m) => m.row.group === 'read: background-color',
        ),
      ).to.equal(false);
      expect(
        c.movers.unscreened.some(
          (m) => m.row.group === 'read: background-color',
        ),
        'an unscreened mover must still be visible',
      ).to.equal(true);
    });
  });

  it('falls back to the cpu twin where a group has no v3 side (the executor sweep)', () => {
    const runs = fixtureRuns().map((r) => {
      r.results.jobs[0].groups[0].benches[0].name = 'cpu';

      return r;
    });
    const c = buildComparison(runs);
    const reg = c.movers.regressions.find(
      (m) => m.row.group === 'read: background-color',
    );

    expect(reg.controlBench).to.equal('cpu');
    expect(reg.control).to.be.closeTo(0.99, 1e-9);
  });

  describe('rendering', () => {
    it('names the page by machine and profile, slugged', () => {
      expect(comparePageName('2d2ea233', 'renderer')).to.equal(
        'benchmark/compare-2d2ea233-renderer.html',
      );
      expect(comparePageName(null, null)).to.equal(
        'benchmark/compare-unknown-unknown.html',
      );
    });

    it('formats a change as a signed percent, or a factor when past 2x', () => {
      expect(fmtChange(1.18)).to.equal('+18%');
      expect(fmtChange(0.93)).to.equal('−7.0%');
      expect(fmtChange(2.5)).to.equal('×2.50');
      expect(fmtChange(null)).to.equal('–');
    });

    it('renders the runs, the movers, and a dash for a gap — never dropping the row', () => {
      const html = renderComparison(buildComparison(fixtureRuns()), {
        machine: 'Test CPU',
        fingerprint: 'aaaa1111',
      });

      expect(html).to.include('aaa0001');
      expect(html).to.include('ccc0003');
      expect(html).to.include('apply: sheet'); // the gap row is present
      expect(html).to.include('>–</td>'); // and its gap renders as a dash
      expect(html).to.include('Slower than the previous run');
      expect(html).to.include('--suite style-read'); // the filter is disclosed
    });

    it('escapes markup in group names', () => {
      const runs = fixtureRuns();
      const evil = {
        name: '<script>alert(1)</script>',
        benches: [bench('gpu', 5)],
      };

      runs[0].results.jobs[0].groups.push(evil);
      runs[2].results.jobs[0].groups.push({
        ...evil,
        benches: [bench('gpu', 50)],
      });

      const html = renderComparison(buildComparison(runs), {});

      expect(html).to.not.include('<script>alert');
      expect(html).to.include('&lt;script&gt;');
    });
  });

  describe('planComparisons (the status site)', () => {
    it('emits one page per profile with two or more runs, and none for a lone run', () => {
      const runs = [
        run({
          commit: 'c3',
          date: '2026-08-03T00-00-00-000Z',
          groups: [],
          profile: 'quick',
        }),
        run({
          commit: 'c2',
          date: '2026-08-02T00-00-00-000Z',
          groups: [],
          profile: 'quick',
        }),
        run({
          commit: 'c1',
          date: '2026-08-01T00-00-00-000Z',
          groups: [],
          profile: 'renderer',
        }),
      ];
      const plans = planComparisons({
        fingerprint: 'aaaa1111',
        machine: 'Test CPU',
        runs, // newest first, as the archive lists them
      });

      expect(plans).to.have.length(1);
      expect(plans[0].profile).to.equal('quick');
      expect(plans[0].page).to.equal('benchmark/compare-aaaa1111-quick.html');
      expect(plans[0].op.kind).to.equal('write');
    });

    it('orders the comparison oldest first even though the archive lists newest first', () => {
      const runs = [
        run({
          commit: 'newer00',
          date: '2026-08-02T00-00-00-000Z',
          groups: [{ name: 'g', benches: [bench('gpu', 150)] }],
        }),
        run({
          commit: 'older00',
          date: '2026-08-01T00-00-00-000Z',
          groups: [{ name: 'g', benches: [bench('gpu', 100)] }],
        }),
      ];
      const [plan] = planComparisons({
        fingerprint: 'aaaa1111',
        machine: 'Test CPU',
        runs,
      });

      // 150 over 100 is a regression; the reversed order would read ×0.67
      expect(plan.op.text).to.include('+50%');
      expect(plan.op.text).to.not.include('−33%');
    });

    it('offers no comparison for unfingerprinted runs — nothing says they share hardware', () => {
      const runs = [
        run({
          commit: 'c1',
          date: '2026-08-01T00-00-00-000Z',
          groups: [],
          fingerprint: null,
        }),
        run({
          commit: 'c2',
          date: '2026-08-02T00-00-00-000Z',
          groups: [],
          fingerprint: null,
        }),
      ];

      expect(
        planComparisons({ fingerprint: null, machine: null, runs }),
      ).to.deep.equal([]);
    });
  });
});
