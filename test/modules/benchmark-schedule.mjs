// Round 68: the benchmark runner's scheduling policy.
//
// Pure, so every rule is asserted here rather than inferred from a 45-minute
// run.  The rules under test are the three in `benchmark/schedule.mjs`'s
// header, and each spec below names the wrong schedule it exists to rule out.

import { expect } from 'chai';

import {
  AUTO_WORKER_CAP,
  canPin,
  criticalKeys,
  expandCpuList,
  hintKey,
  parsePhysicalCores,
  physicalCores,
  pickNext,
  planUnits,
  resolveWorkers,
} from '../../benchmark/schedule.mjs';

const JOBS = [
  { file: 'index.mjs', n: 2000 },
  { file: 'surface.mjs', n: 2000 },
  { file: 'algorithms.mjs', n: 500 },
];

/** Run the picker to exhaustion against `workers` slots, returning the order. */
function simulate(units, { workers = 2, durations = new Map() } = {}) {
  const pending = [...units];
  const running = [];
  const order = [];
  const overlaps = [];
  const hints = new Map();

  // a step is "start what fits, then retire the first-started" — enough to
  // exercise the picker's collision and exclusivity rules without a clock
  while (pending.length > 0 || running.length > 0) {
    let progressed = false;

    while (running.length < workers) {
      const at = pickNext(pending, { running, hints });

      if (at < 0) {
        break;
      }

      const [unit] = pending.splice(at, 1);

      order.push(unit);
      overlaps.push(running.map((u) => u.key));
      running.push(unit);
      progressed = true;
    }

    if (running.length === 0 && !progressed) {
      throw new Error('deadlock: nothing running and nothing startable');
    }

    const done = running.shift();

    if (durations.has(done.key)) {
      hints.set(done.key, durations.get(done.key));
    }
  }

  return { order, overlaps };
}

describe('the benchmark scheduler (round 68)', () => {
  describe('hintKey', () => {
    it('separates the same file at different sizes and ops', () => {
      const select = hintKey({ file: 'mutators.mjs', n: 200000, op: 'select' });
      const remove = hintKey({ file: 'mutators.mjs', n: 200000, op: 'remove' });

      // the eight 200k op-splits differ by an order of magnitude in length;
      // one key for all of them would make the hints worse than none
      expect(select).to.not.equal(remove);
      expect(hintKey({ file: 'mutators.mjs', n: 2000 })).to.not.equal(
        hintKey({ file: 'mutators.mjs', n: 20000 }),
      );
    });
  });

  describe('planUnits', () => {
    it('keeps the serial order the archive was measured in — job-major', () => {
      const units = planUnits(JOBS, 3, false);

      expect(units.map((u) => `${u.index}.${u.pass}`)).to.deep.equal([
        '0.0',
        '0.1',
        '0.2',
        '1.0',
        '1.1',
        '1.2',
        '2.0',
        '2.1',
        '2.2',
      ]);
    });

    it('runs every job once before any job twice — pass-major', () => {
      const units = planUnits(JOBS, 3, true);

      expect(units.map((u) => `${u.index}.${u.pass}`)).to.deep.equal([
        '0.0',
        '1.0',
        '2.0',
        '0.1',
        '1.1',
        '2.1',
        '0.2',
        '1.2',
        '2.2',
      ]);
    });

    it('marks a browser job exclusive and a node job not', () => {
      const units = planUnits(
        [
          { file: 'index.mjs', n: 2000 },
          { file: 'render-bench.mjs', browser: true },
        ],
        1,
        true,
      );

      expect(units.map((u) => u.exclusive)).to.deep.equal([false, true]);
    });
  });

  describe('pickNext', () => {
    it('starts the longest known job first — LPT, not queue order', () => {
      const units = planUnits(JOBS, 1, true);
      const hints = new Map([
        ['index.mjs@2000', 58_000],
        ['surface.mjs@2000', 175_000],
        ['algorithms.mjs@500', 206_000],
      ]);

      expect(pickNext(units, { hints })).to.equal(2);
    });

    it('starts an unmeasured job before a measured one — explore, then exploit', () => {
      // without this, a 206 s job discovered late lands last and owns the tail
      const units = planUnits(JOBS, 1, true);
      const hints = new Map([['index.mjs@2000', 58_000]]);

      expect(pickNext(units, { hints })).to.equal(1);
    });

    it('avoids running two repeats of one job at once', () => {
      // the colliding unit is also the one LPT would take first, so this
      // fails if the collision rule is dropped rather than passing by luck
      const units = planUnits(JOBS, 2, true);
      const hints = new Map([
        ['index.mjs@2000', 58_000],
        ['surface.mjs@2000', 175_000],
        ['algorithms.mjs@500', 206_000],
      ]);
      const running = [units[2]]; // algorithms pass 1 — the longest job
      const pending = units.filter((u) => u !== units[2]);
      const at = pickNext(pending, { running, hints });

      expect(pending[at].key).to.equal('surface.mjs@2000');
    });

    it('lets the critical chain overlap its own repeats, and nothing else', () => {
      // round 68.4: rule 3 kept `algorithms @ 500`'s three 226 s passes
      // end-to-end, and that chain — not the packing — was the whole run's
      // wall clock.  It yields for the job that is holding the clock, and
      // only for that job.
      const units = planUnits(JOBS, 3, true);
      const hints = new Map([
        ['index.mjs@2000', 10_000],
        ['surface.mjs@2000', 10_000],
        ['algorithms.mjs@500', 200_000],
      ]);
      const critical = criticalKeys(units, hints, 6);

      expect([...critical]).to.deep.equal(['algorithms.mjs@500']);

      const running = [units[2]]; // algorithms pass 1
      const pending = units.filter((u) => u !== units[2]);
      const at = pickNext(pending, { running, hints, critical });

      expect(pending[at].key).to.equal('algorithms.mjs@500');
    });

    it('calls nothing critical when the work divides evenly', () => {
      // the control for the rule above: equal jobs over enough workers means
      // no chain binds, and every repeat stays apart
      const units = planUnits(JOBS, 3, true);
      const hints = new Map([
        ['index.mjs@2000', 50_000],
        ['surface.mjs@2000', 50_000],
        ['algorithms.mjs@500', 50_000],
      ]);

      expect([...criticalKeys(units, hints, 2)]).to.deep.equal([]);
    });

    it('calls nothing critical while the durations are still unknown', () => {
      const units = planUnits(JOBS, 3, true);

      expect([...criticalKeys(units, new Map(), 6)]).to.deep.equal([]);
    });

    it('takes the collision rather than idling when nothing else is left', () => {
      // the rule is soft on purpose: at the tail, parking a worker to keep
      // two repeats apart costs more than the correlation it avoids
      const units = planUnits([JOBS[0]], 3, true);
      const running = [units[0]];

      expect(pickNext(units.slice(1), { running })).to.equal(0);
    });

    it('holds the queue while an exclusive unit waits, and runs it alone', () => {
      const jobs = [JOBS[0], { file: 'render-bench.mjs', browser: true }];
      const units = planUnits(jobs, 1, true);
      const browser = units.filter((u) => u.exclusive);

      // something running: the browser job may not start beside it
      expect(pickNext(browser, { running: [units[0]] })).to.equal(-1);
      // nothing running: it goes
      expect(pickNext(browser, { running: [] })).to.equal(0);
    });

    it('starts nothing beside a running exclusive unit', () => {
      const jobs = [JOBS[0], { file: 'render-bench.mjs', browser: true }];
      const units = planUnits(jobs, 1, true);

      expect(pickNext([units[0]], { running: [units[1]] })).to.equal(-1);
    });

    it('answers -1 for an empty queue rather than throwing', () => {
      expect(pickNext([], {})).to.equal(-1);
    });

    it('drains every unit exactly once, whatever the worker count', () => {
      const jobs = [...JOBS, { file: 'render-bench.mjs', browser: true }];
      const units = planUnits(jobs, 3, true);
      const durations = new Map([
        ['index.mjs@2000', 58_000],
        ['surface.mjs@2000', 175_000],
        ['algorithms.mjs@500', 206_000],
      ]);

      for (const workers of [1, 2, 4, 8]) {
        const { order } = simulate(units, { workers, durations });

        expect(order).to.have.length(units.length);
        expect(new Set(order.map((u) => `${u.index}.${u.pass}`)).size).to.equal(
          units.length,
        );
      }
    });

    it('never overlaps the exclusive unit with anything, over a whole run', () => {
      const jobs = [...JOBS, { file: 'render-bench.mjs', browser: true }];
      const units = planUnits(jobs, 2, true);
      const { order, overlaps } = simulate(units, { workers: 4 });

      order.forEach((unit, i) => {
        if (unit.exclusive) {
          expect(
            overlaps[i],
            'exclusive started beside running work',
          ).to.deep.equal([]);
        }
      });
    });
  });

  describe('resolveWorkers', () => {
    it('is serial without the flag — the archive condition stays the default', () => {
      expect(resolveWorkers(null)).to.equal(1);
    });

    it('leaves a core for the OS and the V8 helper threads on auto', () => {
      expect(resolveWorkers('auto', [0, 1, 2, 3])).to.equal(3);
    });

    it('caps auto however many cores there are', () => {
      const many = Array.from({ length: 64 }, (_, i) => i);

      expect(resolveWorkers('auto', many)).to.equal(AUTO_WORKER_CAP);
    });

    it('never answers zero on a machine it could not probe', () => {
      expect(resolveWorkers('auto', [])).to.equal(1);
      expect(resolveWorkers('0')).to.equal(1);
      expect(resolveWorkers('nonsense')).to.equal(1);
    });

    it('takes an explicit count as given', () => {
      expect(resolveWorkers('4')).to.equal(4);
    });
  });

  describe('cpu topology', () => {
    it('expands a sysfs cpu list, ranges and all', () => {
      expect(expandCpuList('0-3,8')).to.deep.equal([0, 1, 2, 3, 8]);
      expect(expandCpuList('0,8')).to.deep.equal([0, 8]);
      expect(expandCpuList('')).to.deep.equal([]);
    });

    it('takes one cpu per physical core, not the first N cpus', () => {
      // an 8-core / 16-thread box: cpu i and i+8 are one core, so pinning
      // 0..5 naively would put two jobs on cores 0 and 1 and idle four
      const siblings = Array.from({ length: 16 }, (_, i) =>
        i < 8 ? `${i},${i + 8}` : `${i - 8},${i}`,
      );

      expect(parsePhysicalCores(siblings)).to.deep.equal([
        0, 1, 2, 3, 4, 5, 6, 7,
      ]);
    });

    it('handles a machine with hyperthreading off', () => {
      expect(parsePhysicalCores(['0', '1', '2', '3'])).to.deep.equal([
        0, 1, 2, 3,
      ]);
    });

    it('skips cpus it could not read rather than inventing cores', () => {
      expect(parsePhysicalCores(['0,4', null, undefined, '1,5'])).to.deep.equal(
        [0, 1],
      );
    });

    it('probes without throwing where sysfs does not exist', () => {
      expect(() => physicalCores(() => null, 4)).to.not.throw();
      expect(physicalCores(() => null, 4)).to.deep.equal([]);
    });

    it('reports pinning unavailable rather than throwing when taskset is absent', () => {
      expect(canPin(() => null)).to.equal(false);
      expect(canPin(() => 'taskset (util-linux) 2.40')).to.equal(true);
    });
  });
});
