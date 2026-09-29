import { expect } from 'chai';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NOT_GESTURES,
  TRACES,
  scanEvents,
} from '../../playwright-tests/lib/gesture-inventory.mjs';
import {
  EVENT_TYPES,
  HOSTS,
  SCRIPTS,
  STREAM_TYPES,
  V3_DIVERGENCES,
  V3_FIELDS,
  V3_SHARED,
  compareSnapshots,
  normalizeLog,
  phasesOf,
  readRecord,
  sortRuns,
  v3PhasesOf,
} from '../../playwright-tests/lib/gesture-traces.mjs';

/*
Round 142 (item 31, the trace tier): the traces, their records and the
comparator, held to each other without a browser.

The Playwright spec (`playwright-tests/gestures.spec.js`) replays each
script and diffs it against its checked-in record.  What it cannot check
is that the record, the script and the inventory still describe the
same thing — a phase renamed in a script, a field added to a trace, a
divergence entry naming a phase v3 never reaches — and that the
comparator can fail at all.  This file does, from the files.
*/

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const INTERACT = join(ROOT, 'src', 'interact');

/** The step kinds the replayer knows, by their identifying key. */
const STEP_KEYS = [
  'hover',
  'leave',
  'down',
  'up',
  'drag',
  'key',
  'wheel',
  'touch',
  'touches',
  'set',
  'viewport',
  'wait',
  'mark',
];

/** The events a trace records beyond the gesture layer's: the model's. */
const MODEL_EVENTS = [
  'pan',
  'position',
  'select',
  'unselect',
  'viewport',
  'zoom',
];

describe('gesture traces (round 142)', function () {
  it('scripts exactly the inventory’s traces', () => {
    expect(Object.keys(SCRIPTS).sort()).to.deep.equal(
      Object.keys(TRACES).sort(),
    );
  });

  it('writes every step in a shape the replayer knows', () => {
    for (const [trace, script] of Object.entries(SCRIPTS)) {
      for (const step of script.steps) {
        const kinds = STEP_KEYS.filter((k) => k in step);

        expect(kinds, `${trace}: ${JSON.stringify(step)}`).to.have.length(1);
      }

      const marks = phasesOf(script);

      expect(new Set(marks).size, `${trace}: unique marks`).to.equal(
        marks.length,
      );
    }
  });

  it('bounds each v3 replay by a mark, all of it, or a reason', () => {
    for (const [trace, script] of Object.entries(SCRIPTS)) {
      if (script.v3 === true) {
        continue;
      }

      expect(script.v3, trace).to.be.a('string');

      const marks = phasesOf(script);

      if (!marks.includes(script.v3)) {
        // a reason, not a mark: then no phase is replayed
        expect(v3PhasesOf(script), trace).to.deep.equal([]);
        expect(script.v3.length, trace).to.be.greaterThan(20);
      }
    }

    // the touch traces are the ones v3 cannot replay (TouchEvents)
    expect(
      Object.keys(SCRIPTS).filter((t) => v3PhasesOf(SCRIPTS[t]).length === 0),
    ).to.deep.equal(['pinch', 'touch-tap-drag']);
  });

  it('has a record per trace, phase for phase and field for field', () => {
    for (const [trace, script] of Object.entries(SCRIPTS)) {
      const record = readRecord(trace);

      expect(record, `${trace}: no record`).to.not.equal(null);
      expect(record.trace).to.equal(trace);
      expect(Object.keys(record.phases), trace).to.deep.equal(phasesOf(script));

      for (const [phase, snap] of Object.entries(record.phases)) {
        expect(Object.keys(snap), `${trace}/${phase}`).to.deep.equal(
          TRACES[trace].endState,
        );
      }
    }

    const files = readdirSync(join(ROOT, 'playwright-tests', 'gesture-traces'))
      .map((f) => f.replace(/\.json$/, ''))
      .sort();

    expect(files, 'a record with no trace').to.deep.equal(
      Object.keys(SCRIPTS).sort(),
    );
  });

  it('records only the vocabulary, with the stream collapsed', () => {
    const known = new Set(EVENT_TYPES);

    for (const trace of Object.keys(SCRIPTS)) {
      for (const [phase, snap] of Object.entries(readRecord(trace).phases)) {
        for (const entry of snap.events ?? []) {
          const pairs = entry.startsWith('~')
            ? entry.slice(1).split(' ')
            : [entry];

          for (const pair of pairs) {
            const type = pair.split(':')[0];

            expect(known.has(type), `${trace}/${phase}: ${pair}`).to.equal(
              true,
            );
            expect(
              STREAM_TYPES.has(type),
              `${trace}/${phase}: ${pair} in the right place`,
            ).to.equal(entry.startsWith('~'));
          }
        }
      }
    }
  });

  it('records every event src/interact emits but the timer-fired onetap', () => {
    const emitted = new Set();

    for (const f of readdirSync(INTERACT).filter((f) => f.endsWith('.mts'))) {
      for (const n of scanEvents(readFileSync(join(INTERACT, f), 'utf8'))) {
        emitted.add(n);
      }
    }

    emitted.delete('onetap');

    expect([...EVENT_TYPES].sort()).to.deep.equal(
      [...emitted, ...MODEL_EVENTS].sort(),
    );

    for (const type of [...STREAM_TYPES, ...V3_SHARED]) {
      expect(EVENT_TYPES, type).to.include(type);
    }
  });

  it('keys every v3 divergence to a phase and field v3 is compared on', () => {
    for (const key of Object.keys(V3_DIVERGENCES)) {
      const [trace, phase, field] = key.split('/');

      expect(SCRIPTS, key).to.have.property(trace);
      expect(v3PhasesOf(SCRIPTS[trace]), key).to.include(phase);
      expect(V3_FIELDS, key).to.include(field);
      expect(TRACES[trace].endState, key).to.include(field);
      expect(V3_DIVERGENCES[key].length, key).to.be.greaterThan(20);
    }
  });

  it('runs every v4 host on the same record, the same-thread host first', () => {
    expect(HOSTS[0].id).to.equal('webgpu');
    expect(new Set(HOSTS.map((h) => h.id)).size).to.equal(HOSTS.length);
  });

  it('pins the grab-and-throw absence, not a behaviour', () => {
    // item 31 listed a throw; v4 has none (NOT_GESTURES says so), and the
    // record says the node rests where the release left it
    expect(NOT_GESTURES).to.have.property('grab-and-throw');

    const { end } = readRecord('grab-and-throw').phases;

    expect(end.positions.b).to.deep.equal({ x: 60, y: 10 });
    expect(end.viewport).to.deep.equal({ zoom: 1, pan: { x: 200, y: 150 } });
  });

  describe('normalizeLog', () => {
    it('keeps discrete events in order and collapses each stream run to its set', () => {
      expect(
        normalizeLog([
          'pointermove:cy',
          'pointermove:cy',
          'pointerdown:a',
          'pointermove:a',
          'drag:a',
          'pointermove:a',
          'position:a',
          'pointerup:a',
        ]),
      ).to.deep.equal([
        '~pointermove:cy',
        'pointerdown:a',
        '~drag:a pointermove:a position:a',
        'pointerup:a',
      ]);
    });

    it('filters to a vocabulary, dropping the stream (control: without it the stream stays)', () => {
      const log = ['pointermove:cy', 'tapstart:cy', 'mousedown:cy', 'tap:cy'];

      expect(normalizeLog(log, new Set(['tapstart', 'tap']))).to.deep.equal([
        'tapstart:cy',
        'tap:cy',
      ]);
      expect(normalizeLog(log)).to.include('~pointermove:cy');
    });

    it('sorts only runs of one type', () => {
      expect(
        sortRuns(['box:b', 'box:a', 'select:b', 'select:a', 'box:c']),
      ).to.deep.equal(['box:a', 'box:b', 'select:a', 'select:b', 'box:c']);
    });
  });

  describe('compareSnapshots', () => {
    const base = {
      positions: { a: { x: 1, y: 2 } },
      viewport: { zoom: 1, pan: { x: 0, y: 0 } },
      selection: ['a'],
      events: ['tap:a', 'select:a'],
    };
    const fields = ['positions', 'viewport', 'selection', 'events'];

    it('finds nothing in a copy, and nothing under the tolerance', () => {
      expect(
        compareSnapshots(base, structuredClone(base), fields),
      ).to.deep.equal([]);

      const near = structuredClone(base);

      near.positions.a.x += 1e-7;
      expect(compareSnapshots(base, near, fields)).to.deep.equal([]);
    });

    it('names the number that moved and both values (control)', () => {
      const moved = structuredClone(base);

      moved.positions.a.y = 2.5;
      moved.viewport.pan.x = 3;

      expect(compareSnapshots(base, moved, fields)).to.deep.equal([
        { field: 'positions', key: 'a.y', expected: 2, actual: 2.5 },
        { field: 'viewport', key: 'pan.x', expected: 0, actual: 3 },
      ]);
    });

    it('reports a missing node and the first event that diverges', () => {
      const other = structuredClone(base);

      other.positions = {};
      other.events = ['tap:a', 'unselect:a', 'select:a'];

      const diffs = compareSnapshots(base, other, fields);

      expect(diffs.map((d) => `${d.field}[${d.key}]`)).to.deep.equal([
        'positions[a.x]',
        'positions[a.y]',
        'events[1]',
      ]);
    });

    it('compares only the fields asked for', () => {
      const other = structuredClone(base);

      other.selection = [];

      expect(compareSnapshots(base, other, ['events'])).to.deep.equal([]);
      expect(compareSnapshots(base, other, ['selection'])).to.have.length(1);
    });
  });
});
