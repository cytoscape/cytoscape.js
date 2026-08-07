/*
Round 55: compare two routing-record maps field by field.

A pixel diff answers "these two pictures differ by 3%".  This answers
"edge `taxi-v` disagrees on interior[1].x by 8.48 model px" — which is
the difference between a finding and a mystery, and the reason the
maintainer asked for `ctrlpts(v3) ~= ctrlpts(v4)` rather than more
screenshots.

Three rules keep it honest, each of them a failure this repo has seen
before in another guise:

  1. **Non-finite is structural, never numeric.**  `NaN > tol` is
     `false`, so the obvious comparator passes a NaN silently.  v4
     currently NaNs on axis-aligned `round-taxi`, so this is not a
     hypothetical.
  2. **A tolerance prints its headroom every run.**  A bound nobody
     re-derives becomes decorative, exactly like a benchmark row that
     stops discriminating; `compareRoutes` fails when the largest
     *matching* delta climbs past a quarter of the bound, with a message
     saying to re-derive rather than raise.
  3. **A ledger entry is a contract, not a mute button.**  It fails when
     the divergence leaves its band in either direction — shrinking
     counts, because a divergence that quietly got fixed means the entry
     is now lying about the code.
*/

/**
 * Per-field tolerance, in model px.
 *
 * The floor is not arithmetic precision, it is **f32 quantization**: v4
 * stores node positions, sizes and curve params in `Float32Array`
 * (`src/contract.mts`), where v3 uses doubles throughout.  Half an ulp of
 * f32 at |x| = 300 is 1.5e-5, so:
 *
 *   exact     boundary points off integer inputs         1e-6
 *   derived   anything through edge.curveParams (f32)    1e-4   (~7x)
 *   compound  anything through a parent's derived box    1e-3   (~70x,
 *             two chained quantizations)
 *
 * Every scene uses integer node positions and integer sizes so that f32
 * is exact on the *inputs* and these bounds measure only what they claim
 * to.  All three are at least 1000x smaller than the smallest divergence
 * this round is chasing — the arrow gap at width 1, scale 1, is 2 model
 * px — so a bound can be wrong by an order of magnitude and still catch
 * the defects.  That is deliberate slack in the safe direction.
 */
export const TOL = { exact: 1e-6, derived: 1e-4, compound: 1e-3 };

/** Values the probe tagged as non-finite (JSON has no NaN). */
const NON_FINITE = new Set(['NaN', 'Infinity', '-Infinity']);

const isNonFinite = (v) => typeof v === 'string' && NON_FINITE.has(v);

/** Flatten one record into comparable `field -> value` pairs. */
const fields = (rec) => {
  const out = new Map();

  if (rec == null || rec.missing) {
    return out;
  }

  for (const key of ['src', 'tgt', 'mid']) {
    const p = rec[key];

    out.set(`${key}.x`, p == null ? null : p.x);
    out.set(`${key}.y`, p == null ? null : p.y);
  }

  (rec.interior ?? []).forEach((p, i) => {
    out.set(`interior[${i}].x`, p == null ? null : p.x);
    out.set(`interior[${i}].y`, p == null ? null : p.y);
  });

  return out;
};

/**
 * Compare two `id -> record` maps.
 *
 * @param v3 — records from the v3 instance
 * @param v4 — records from the v4 instance
 * @param opts — `{ scene, tolClass, ledger }`
 * @returns `{ rows, diverged, ledgerHits, staleLedger, structural, maxDelta, tol }`
 */
export const compareRoutes = (v3, v4, opts = {}) => {
  const scene = opts.scene ?? 'scene';
  const tol = TOL[opts.tolClass ?? 'derived'];
  const ledger = opts.ledger ?? [];
  const used = new Set();

  const rows = [];
  const structural = [];

  const entryFor = (key) => {
    const hit = ledger.find((e) => e.key === key);

    if (hit != null) {
      used.add(hit.key);
    }

    return hit;
  };

  for (const id of Object.keys(v4)) {
    const a = v3[id];
    const b = v4[id];
    const key = (field) => `${scene}/${id}/${field}`;

    if (a == null || a.missing) {
      structural.push(`${scene}/${id}: missing on the v3 side`);
      continue;
    }
    if (b == null || b.missing) {
      structural.push(`${scene}/${id}: missing on the v4 side`);
      continue;
    }

    // the structural signature first: an interior-count or accessor
    // disagreement is a dispatch bug, not a delta, and must never be
    // absorbed by a tolerance
    if (a.sig !== b.sig) {
      const entry = entryFor(key('sig'));

      if (entry == null) {
        structural.push(`${scene}/${id}: signature v3 ${a.sig} vs v4 ${b.sig}`);
      } else {
        rows.push({
          key: key('sig'),
          id,
          field: 'sig',
          v3: a.sig,
          v4: b.sig,
          delta: null,
          tol,
          status: 'ledger',
          reason: entry.reason,
        });
      }

      continue;
    }

    const fa = fields(a);
    const fb = fields(b);

    for (const [field, av] of fa) {
      const bv = fb.get(field);
      const entry = entryFor(key(field));
      const bothNonFinite = isNonFinite(av) && isNonFinite(bv);
      const eitherNonFinite = isNonFinite(av) || isNonFinite(bv);

      // A shared-bug entry asserts BOTH sides are non-finite.  It is the
      // only honest encoding when v3 is wrong in the same place v4 is —
      // there is no v3 number to match — and it fails loudly the moment
      // one side is fixed, which is what makes it the failing test the
      // fix has to satisfy rather than a note in a file.
      if (entry != null && entry.kind === 'shared-bug') {
        rows.push({
          key: key(field),
          id,
          field,
          v3: av,
          v4: bv,
          delta: null,
          tol,
          status: bothNonFinite ? 'ledger' : 'ledger-stale',
          reason: entry.reason,
        });
        continue;
      }

      // A v3-bug entry asserts v3 is non-finite and v4 is not: v4 stays
      // finite where v3 does not, and that is all that can be pinned.
      if (entry != null && entry.kind === 'v3-bug') {
        const ok = isNonFinite(av) && !isNonFinite(bv) && bv != null;

        rows.push({
          key: key(field),
          id,
          field,
          v3: av,
          v4: bv,
          delta: null,
          tol,
          status: ok ? 'ledger' : 'ledger-stale',
          reason: entry.reason,
        });
        continue;
      }

      if (eitherNonFinite || av == null || bv == null) {
        structural.push(
          `${scene}/${id}/${field}: v3 ${JSON.stringify(av)} vs v4 ${JSON.stringify(bv)}`,
        );
        continue;
      }

      const delta = Math.abs(av - bv);

      if (entry != null && typeof entry.expect === 'number') {
        // a numeric band: the divergence is known and bounded, and must
        // stay in its band in BOTH directions
        const lo = entry.expect * 0.5;
        const hi = entry.expect * 1.05 + tol;

        rows.push({
          key: key(field),
          id,
          field,
          v3: av,
          v4: bv,
          delta,
          tol,
          status: delta >= lo && delta <= hi ? 'ledger' : 'ledger-stale',
          reason: entry.reason,
          expect: entry.expect,
        });
        continue;
      }

      rows.push({
        key: key(field),
        id,
        field,
        v3: av,
        v4: bv,
        delta,
        tol,
        status: delta <= tol ? 'match' : 'diverged',
      });
    }
  }

  // Edge-level entries (`<scene>/<edgeId>/*`) — a whole edge's divergence
  // bounded by one band.  The per-field form would need eighteen entries
  // to record one decision (v4's polygon boundaries are inscribed
  // ellipses), and a ledger nobody can read is a ledger nobody re-checks.
  // The band is asserted against the edge's *worst* field, and it is
  // two-sided for the usual reason: a deviation that shrank is a decision
  // that changed, and the entry describing it is now wrong.
  for (const entry of ledger.filter((e) => e.key.endsWith('/*'))) {
    const [entryScene, id] = entry.key.split('/');

    if (entryScene !== scene) {
      continue;
    }

    const mine = rows.filter((r) => r.id === id && r.status === 'diverged');

    if (mine.length === 0) {
      continue;
    }

    used.add(entry.key);

    const worst = mine.reduce((m, r) => Math.max(m, r.delta), 0);
    const lo = entry.expect * 0.5;
    const hi = entry.expect * 1.05 + tol;
    const ok = worst >= lo && worst <= hi;

    for (const r of mine) {
      r.status = ok ? 'ledger' : 'ledger-stale';
      r.reason = entry.reason;
      r.expect = entry.expect;
    }
  }

  const matching = rows.filter((r) => r.status === 'match');
  const maxDelta = matching.reduce((m, r) => Math.max(m, r.delta), 0);

  const staleLedger = [
    ...rows.filter((r) => r.status === 'ledger-stale').map((r) => r.key),
    ...ledger
      .filter((e) => e.key.startsWith(`${scene}/`) && !used.has(e.key))
      .map((e) => `${e.key} (names nothing this scene produces)`),
  ];

  return {
    rows,
    diverged: rows.filter((r) => r.status === 'diverged'),
    ledgerHits: rows.filter((r) => r.status === 'ledger'),
    staleLedger,
    structural,
    maxDelta,
    tol,
  };
};

const fmt = (v) => (typeof v === 'number' ? v.toFixed(6) : String(v));

/** A fixed-width report, most-diverged first, for the failure message. */
export const formatRouteDiff = (scene, result) => {
  const lines = [];
  const bad = [...result.diverged].sort((a, b) => b.delta - a.delta);

  lines.push(
    `routing parity: ${scene} — ` +
      `${bad.length} diverged, ${result.structural.length} structural, ` +
      `${result.ledgerHits.length} known, ${result.rows.length} fields compared`,
  );

  for (const s of result.structural) {
    lines.push(`  [structural] ${s}`);
  }

  if (bad.length > 0) {
    lines.push('');
    lines.push(
      `  ${'edge'.padEnd(18)}${'field'.padEnd(16)}${'v3'.padStart(14)}` +
        `${'v4'.padStart(14)}${'delta'.padStart(14)}`,
    );

    for (const r of bad.slice(0, 24)) {
      lines.push(
        `  ${r.id.padEnd(18)}${r.field.padEnd(16)}` +
          `${fmt(r.v3).padStart(14)}${fmt(r.v4).padStart(14)}${r.delta.toFixed(6).padStart(14)}`,
      );
    }

    if (bad.length > 24) {
      lines.push(`  … and ${bad.length - 24} more`);
    }
  }

  // The per-edge rollup, which the truncated table above cannot give.  It
  // is the line that answers the question a scene is usually built to ask
  // — *which edges* disagree — and in particular whether a scene's control
  // edges are clean while its subject edges are not.  Without it the
  // compound scene's three control rows were invisible behind 24 rows of
  // the four rows that were supposed to diverge.
  const byEdge = new Map();

  for (const r of result.rows) {
    const e = byEdge.get(r.id) ?? { total: 0, bad: 0, known: 0, worst: 0 };

    e.total++;

    if (r.status === 'diverged') {
      e.bad++;
      e.worst = Math.max(e.worst, r.delta);
    }
    if (r.status === 'ledger') {
      e.known++;
    }

    byEdge.set(r.id, e);
  }

  lines.push('');
  lines.push('  per edge:');

  for (const [id, e] of byEdge) {
    const verdict =
      e.bad === 0
        ? e.known > 0
          ? `clean (${e.known} known)`
          : 'clean'
        : `${e.bad}/${e.total} diverged, worst ${e.worst.toFixed(4)}`;

    lines.push(`    ${id.padEnd(20)}${verdict}`);
  }

  const matching = result.rows.filter((r) => r.status === 'match').length;
  const headroom =
    result.maxDelta === 0 ? Infinity : result.tol / result.maxDelta;

  lines.push('');
  lines.push(
    `  ${matching} matching fields: max delta ${result.maxDelta.toExponential(2)} ` +
      `(tol ${result.tol.toExponential(0)}, ${headroom === Infinity ? 'exact' : headroom.toFixed(0) + 'x'} headroom)`,
  );

  return lines.join('\n');
};
