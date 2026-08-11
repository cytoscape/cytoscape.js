import { expect } from 'chai';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  normaliseInput,
  harnessInputs,
  harnessHash,
  scanSuiteFiles,
  suiteFileOf,
  sameEpoch,
  auditEquivalences,
  stampHarness,
  EQUIVALENT_HARNESSES,
} from '../../benchmark/harness-id.mjs';
import { mergeRepeats } from '../../benchmark/repeat-merge.mjs';

/*
Round 65.12: the harness fingerprint and the repeat merge.

These two decide what a published number *is* and whether two of them may be
compared, so the specs pin the judgements rather than the plumbing:

  - what counts as a harness change (and, just as important, what does not);
  - which files a suite's hash covers;
  - that a merged row is one repeat's stats, not a Frankenstein of several;
  - that the equivalence ledger cannot rot into blanket permission.

Controls run while writing, each failing exactly the spec named:
  - the punctuation-whitespace rule dropped from `normaliseInput` — fails the
    reformat spec (a formatter change reads as a methodology change);
  - comment stripping dropped — fails the comment spec;
  - the import walk removed from `harnessInputs` — fails the closure spec
    (index.mjs stops answering for collection.mjs, so editing the file that
    holds the benches changes nothing);
  - `mergeRepeats` taking a per-key median instead of the median repeat whole —
    fails the internally-consistent spec (p50 and p99 come from different
    processes and the row describes no measurement that happened);
  - `auditEquivalences` returning [] — fails both ledger-audit specs.
*/

describe('the harness fingerprint (round 65.12)', () => {
  describe('normaliseInput', () => {
    it('is blind to formatting — round 57.2 reformatted every bench file and moved no number', () => {
      const before = `const K = 8;   // pool size\nfunction cmp( name, setup ){\n  return setup( name );\n}\n`;
      const after = `const K = 8; // pool size\nfunction cmp(name, setup) {\n  return setup(name);\n}\n`;

      expect(normaliseInput(before)).to.equal(normaliseInput(after));
    });

    it('is blind to comments — prose about a measurement is not the measurement', () => {
      expect(normaliseInput('a();  // one story\n')).to.equal(
        normaliseInput('a(); /* quite a different story */\n'),
      );
    });

    it('is not blind to a changed value, a rename, or a new call', () => {
      const base = 'const K = 8; cmp(a);';

      expect(normaliseInput(base)).to.not.equal(
        normaliseInput('const K = 9; cmp(a);'),
      );
      expect(normaliseInput(base)).to.not.equal(
        normaliseInput('const K = 8; cmp(b);'),
      );
      expect(normaliseInput(base)).to.not.equal(
        normaliseInput('const K = 8; cmp(a); cmp(c);'),
      );
    });

    it('leaves a URL alone rather than eating the rest of its line', () => {
      expect(normaliseInput('const u = "http://x/y"; const v = 1;')).to.include(
        'http://x/y',
      );
    });
  });

  describe('harnessInputs', () => {
    it("covers a suite's import closure — index.mjs answers for the files its benches live in", () => {
      const inputs = harnessInputs('index.mjs').map(([p]) => p);

      expect(inputs).to.include('benchmark/collection.mjs');
      expect(inputs).to.include('benchmark/core.mjs');
      // and the shared inputs every suite's numbers depend on
      expect(inputs).to.include('benchmark/graph.mjs');
      expect(inputs).to.include('benchmark/bench-size.mjs');
    });

    it('excludes the modules that render a run rather than measure it', () => {
      // render-bench.mjs imports report-html.mjs for its own report; a change
      // to the report's HTML must not break the renderer's epoch
      const inputs = harnessInputs('render-bench.mjs').map(([p]) => p);

      expect(inputs).to.not.include('benchmark/report-html.mjs');
      expect(inputs).to.not.include('benchmark/run-meta.mjs');
      // the page it drives *is* the instrument, though
      expect(inputs).to.include('benchmark/render-bench.html');
    });

    it('does not follow ../ imports — src/ is the subject, not the instrument', () => {
      const inputs = harnessInputs('style-bundle.mjs').map(([p]) => p);

      expect(inputs.every((p) => p.startsWith('benchmark/'))).to.equal(true);
    });

    it('hashes to 8 hex characters, and differs between suites', () => {
      const a = harnessHash('collection.mjs');
      const b = harnessHash('curves.mjs');

      expect(a).to.match(/^[0-9a-f]{8}$/);
      expect(b).to.match(/^[0-9a-f]{8}$/);
      expect(a).to.not.equal(b);
    });

    it('changes when an input changes, through the injected reader', () => {
      const real = harnessInputs('collection.mjs');
      const map = new Map(real);
      const read = (p) => map.get(p) ?? null;
      const before = harnessHash('collection.mjs', read);

      map.set(
        'benchmark/graph.mjs',
        `${map.get('benchmark/graph.mjs')}\nconst x = 1;`,
      );

      expect(harnessHash('collection.mjs', read)).to.not.equal(before);
    });

    it('is null for a file that does not exist rather than hashing nothing', () => {
      expect(harnessHash('no-such-suite.mjs')).to.equal(null);
    });
  });

  describe('suiteFileOf', () => {
    it('maps a suite display name to the file that declares it', () => {
      // the display name is not the file name, which is the whole reason this
      // is scanned rather than assumed
      expect(suiteFileOf('core+collection')).to.equal('index.mjs');
      expect(suiteFileOf('curves')).to.equal('curves.mjs');
    });

    it('matches the two dynamic families by prefix', () => {
      expect(suiteFileOf('render — generated 25k × 50k')).to.equal(
        'render-bench.mjs',
      );
      expect(suiteFileOf('algorithms-gpu')).to.equal(
        'algorithms-gpu-bench.mjs',
      );
    });

    it('answers null for a suite nothing claims, rather than guessing', () => {
      expect(suiteFileOf('a suite that does not exist')).to.equal(null);
    });

    it('finds a suite whose finishRun call is wrapped across lines', () => {
      const dir = mkdtempSync(join(tmpdir(), 'harness-scan-'));

      try {
        writeFileSync(
          join(dir, 'curves.mjs'),
          "finishManualRun(\n  'wrapped-suite',\n  groups,\n);\n",
        );

        expect(scanSuiteFiles(dir).get('wrapped-suite')).to.equal('curves.mjs');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe('sameEpoch and the equivalence ledger', () => {
    it('compares within one hash and refuses across two', () => {
      expect(sameEpoch('aaaa', 'aaaa')).to.equal(true);
      expect(sameEpoch('aaaa', 'bbbb')).to.equal(false);
    });

    it('treats a missing hash as unknown, never as unchanged', () => {
      expect(sameEpoch(null, 'aaaa')).to.equal(false);
      expect(sameEpoch('aaaa', null)).to.equal(false);
      expect(sameEpoch(null, null)).to.equal(false);
    });

    it('follows a declared chain in both directions', () => {
      const ledger = [
        { from: 'a', to: 'b', reason: 'reformat' },
        { from: 'b', to: 'c', reason: 'comment' },
      ];

      expect(sameEpoch('a', 'c', ledger)).to.equal(true);
      expect(sameEpoch('c', 'a', ledger)).to.equal(true);
      expect(sameEpoch('a', 'd', ledger)).to.equal(false);
    });

    it('audits an entry that names a hash the archive no longer carries', () => {
      const ledger = [{ from: 'gone', to: 'bbbb', reason: 'reformat' }];
      const stale = auditEquivalences(['bbbb', 'cccc'], ledger);

      expect(stale).to.have.length(1);
      expect(stale[0].why).to.include('from');
    });

    it('audits an entry with no reason — the next reader has nothing else', () => {
      const ledger = [{ from: 'aaaa', to: 'bbbb', reason: '  ' }];

      expect(auditEquivalences(['aaaa', 'bbbb'], ledger)[0].why).to.include(
        'no reason',
      );
    });

    it('the shipped ledger holds only entries that describe the archive', async () => {
      const { loadPublished } =
        await import('../../scripts/benchmark-publish.mjs');
      const inUse = new Set();

      for (const run of loadPublished()) {
        for (const job of run.results?.jobs ?? []) {
          if (job.harness != null) {
            inUse.add(job.harness);
          }
        }
      }

      expect(
        auditEquivalences([...inUse], EQUIVALENT_HARNESSES),
        'a stale equivalence entry reads as permission nobody granted',
      ).to.deep.equal([]);
    });
  });

  describe('stampHarness', () => {
    it('stamps each job by the suite it names, sharing one hash per file', () => {
      const jobs = [
        { suite: 'core+collection' },
        { suite: 'core+collection' },
        { suite: 'curves' },
        { suite: 'nothing claims this' },
      ];

      stampHarness(jobs);

      expect(jobs[0].harness).to.match(/^[0-9a-f]{8}$/);
      expect(jobs[1].harness).to.equal(jobs[0].harness);
      expect(jobs[2].harness).to.not.equal(jobs[0].harness);
      expect(jobs[3].harness).to.equal(null);
    });
  });
});

describe('merging repeats (round 65.12)', () => {
  const job = (p50, extra = {}) => ({
    suite: 's',
    n: 2000,
    durationMs: 1000,
    groups: [
      {
        name: 'g',
        benches: [
          {
            name: 'gpu',
            stats: { p50, p99: p50 * 10, min: p50 - 1, samples: 100, ...extra },
          },
        ],
      },
    ],
  });
  const statsOf = (merged) => merged.groups[0].benches[0].stats;

  it('publishes the median repeat, not the mean and not the best', () => {
    const merged = mergeRepeats([job(100), job(300), job(200)]);

    expect(statsOf(merged).p50).to.equal(200);
  });

  it("carries that repeat's stats whole, so the percentiles describe one process", () => {
    // a per-key median would take p50 from the 200 run and p99 from the 300
    // run, describing a distribution nothing measured
    const merged = mergeRepeats([job(100), job(300), job(200)]);

    expect(statsOf(merged).p99).to.equal(2000);
    expect(statsOf(merged).min).to.equal(199);
  });

  it('records the band the repeats measured, which is what a screen reads', () => {
    const merged = mergeRepeats([job(100), job(300), job(200)]);

    expect(statsOf(merged).repeats).to.equal(3);
    expect(statsOf(merged).repeatSpread).to.be.closeTo(3, 1e-9);
  });

  it('keeps a row some repeats did not measure, and says how many saw it', () => {
    const partial = job(500);

    partial.groups[0].benches = [];

    const merged = mergeRepeats([job(100), partial, job(200)]);

    expect(statsOf(merged).p50).to.equal(200);
    expect(statsOf(merged).repeats).to.equal(2);
  });

  it('sums the wall time across repeats rather than reporting one pass', () => {
    expect(mergeRepeats([job(100), job(200), job(300)]).durationMs).to.equal(
      3000,
    );
  });

  it('passes a single run through untouched — a --repeat 1 file is the old shape', () => {
    const one = job(100);

    expect(mergeRepeats([one])).to.equal(one);
    expect(statsOf(mergeRepeats([one])).repeats).to.equal(undefined);
  });

  it('is null for no runs at all rather than an empty job that renders as a row', () => {
    expect(mergeRepeats([])).to.equal(null);
    expect(mergeRepeats([null, null])).to.equal(null);
  });
});
