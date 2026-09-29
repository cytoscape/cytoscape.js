import fs from 'node:fs';
import path from 'node:path';
import { decodePng } from './image-diff.mjs';

/*
Round 143 (item 30, tier 2): the degrade control.

Tier 1 (round 135) records which style properties each golden sets to a
non-default value, and counts the properties no golden sets.  "Set" is
an upper bound on "seen": a property can carry a non-default value and
still move no pixel — painted over, zero-sized, gated off by another
property.  The degrade control measures the difference.  For each
(scene, property) pair tier 1 recorded, it resets that one property to
its default on every element that set it, re-exports the scene, and
counts the pixels that moved.  A pair that moves none is decoration in
that scene: deleting the property from the sheet would leave the golden
passing.

It runs inside the golden pass, from `checkGolden`, when
`DEGRADE_CONTROL=1` is set — after the PNG and the coverage record have
both matched, on the same live scene — and writes one record per golden
to `playwright-tests/golden-degrade/<name>.json`.  The Node tier
(`scripts/golden-coverage.mjs`, gated by `test/modules/golden-coverage.mjs`)
reads them: a record that no longer covers exactly its golden's
exercised pairs is stale, and the counts are pinned.

**The reset.**  The property is bypassed, per element, to the value a
default-sheet element of the same kind reads back (a leaf, a compound
parent — v3's `:parent` defaults — or an edge, the references tier 1
judged "non-default" against), which is the resolved value the element
would have if the sheet never named the property.  Only elements whose
value differs are touched.  The read-back is checked, so a value the
bypass cannot take is reported, not silently measured as zero.

**The restore is checked too.**  The bypass is removed (and an element
whose own value came from a scene bypass gets it back), every value is
read back, and the scene is re-exported.  A value that did not come back
stops the scene there — every pair after it would measure a different
scene — and the record says so.  A frame that did not quite come back
with every value restored (a background image re-decodes into another
atlas slot) is recorded as the pair's `residue`, and the pairs after it
are measured against the restored frame.

**Counting.**  Raw RGBA bytes, not pixelmatch — its anti-aliasing
detection would drop exactly the one-pixel fringes a thin border or
outline change moves.  Each export is repeated until two consecutive
ones agree, since a label change re-rasters the glyph atlas a frame or
more later.
*/

/** Where the records live (cwd-anchored, as `style-coverage.mjs`). */
export const DEGRADE_DIR = path.resolve(
  process.cwd(),
  'playwright-tests',
  'golden-degrade',
);

/** The groups a pair can be in (core props are reset differently, and no golden sets one). */
export const DEGRADE_GROUPS = ['nodes', 'parents', 'edges'];

/** The (group, property) pairs a coverage record exercises. */
export const pairsOf = (coverage) =>
  DEGRADE_GROUPS.flatMap((group) =>
    Object.keys(coverage[group] ?? {})
      .sort()
      .map((prop) => `${group}/${prop}`),
  );

/** Pixels whose RGBA bytes differ between two decoded PNGs of one size. */
export const countMoved = (a, b) => {
  if (a.width !== b.width || a.height !== b.height) {
    return a.width * a.height;
  }

  let n = 0;

  for (let i = 0; i < a.data.length; i += 4) {
    if (
      a.data[i] !== b.data[i] ||
      a.data[i + 1] !== b.data[i + 1] ||
      a.data[i + 2] !== b.data[i + 2] ||
      a.data[i + 3] !== b.data[i + 3]
    ) {
      n++;
    }
  }

  return n;
};

/**
 * Reset one property to its default on the group's elements.  **Runs in
 * the page** (self-contained, against `window.cy` and
 * `window.cytoscape`), and leaves what it changed in `window.__degrade`
 * for {@link restoreInPage}.
 *
 * Per-element bypasses first.  A few properties refuse one — the label
 * font is global (one glyph atlas), and a default that reads back as
 * `''` (no gradient stops, no colour scheme) is not a value a bypass
 * accepts — and those are reset in the sheet instead: the property is
 * deleted from the group's block (every condition in it included) and
 * from the scene's bypasses, and the sheet is re-set.
 *
 * @returns `{ changed, via, unresettable }` — the elements touched (for
 *   the sheet path, those whose value moved), `'bypass'` or `'sheet'`,
 *   and the ids whose value the reset did not move
 */
export const resetInPage = ({ group, prop }) => {
  const cy = globalThis.cy;
  const text = (v) => (typeof v === 'string' ? v : JSON.stringify(v));
  const ref = globalThis.cytoscape({
    elements: [
      { data: { id: 'p' } },
      { data: { id: 'c', parent: 'p' } },
      { data: { id: 'n' } },
      { data: { id: 'e', source: 'c', target: 'n' } },
    ],
  });
  const read = (id) => {
    try {
      return ref.$id(id).style(prop);
    } catch {
      return undefined; // a property the kind does not read
    }
  };
  const defaults = { leaf: read('n'), parent: read('p'), edge: read('e') };

  ref.destroy();

  const eles =
    group === 'edges'
      ? cy.edges()
      : group === 'parents'
        ? cy.nodes().filter((n) => n.isParent())
        : cy.nodes();
  const defOf = (ele) =>
    ele.isEdge()
      ? defaults.edge
      : ele.isParent()
        ? defaults.parent
        : defaults.leaf;
  const saved = [];
  const unresettable = [];

  try {
    eles.forEach((ele) => {
      const def = defOf(ele);
      const cur = ele.style(prop);

      if (text(cur) === text(def)) {
        return;
      }

      if (def === undefined) {
        // a property the default leaves unset (a straight edge's control
        // points): nothing to bypass it to, so the sheet path unsets it
        throw new Error(`no default value for '${prop}'`);
      }

      saved.push({ ele, cur });
      ele.style(prop, def);

      // a reset that reads back unchanged did not take; the read-back is
      // not compared with the default, since some reads fold an opacity
      // in (a labelled element's label-box colours)
      if (text(ele.style(prop)) === text(cur)) {
        unresettable.push(ele.id());
      }
    });

    globalThis.__degrade = { prop, saved };

    return { changed: saved.length, via: 'bypass', unresettable };
  } catch {
    // the bypass refused: undo what it took, and reset in the sheet
    for (const { ele } of saved) {
      ele.removeStyle(prop);
    }
  }

  const before = new Map();

  eles.forEach((ele) => before.set(ele.id(), text(ele.style(prop))));

  const sheet = cy.style().json();
  const strip = (o) => {
    if (Array.isArray(o)) {
      return o.map(strip);
    }

    if (o != null && typeof o === 'object') {
      const out = {};

      for (const [k, v] of Object.entries(o)) {
        if (k !== prop) {
          out[k] = strip(v);
        }
      }

      return out;
    }

    return o;
  };
  const next = { ...sheet };

  for (const block of ['nodes', 'parents', 'edges', 'bypasses']) {
    if (sheet[block] != null) {
      next[block] = strip(sheet[block]);
    }
  }

  cy.style(next);
  globalThis.__degrade = { sheet };

  let changed = 0;

  eles.forEach((ele) => {
    const was = before.get(ele.id());
    const now = text(ele.style(prop));

    if (now !== was) {
      changed++;
    } else if (was !== text(defOf(ele))) {
      unresettable.push(ele.id()); // it had a value and still has it
    }
  });

  return { changed, via: 'sheet', unresettable };
};

/**
 * Undo {@link resetInPage}: remove the bypass, and give back a scene
 * bypass the removal took with it — or re-set the sheet the sheet path
 * replaced.  **Runs in the page.**
 *
 * @returns the ids whose value could not be put back
 */
export const restoreInPage = () => {
  const state = globalThis.__degrade;
  const text = (v) => (typeof v === 'string' ? v : JSON.stringify(v));
  const lost = [];

  globalThis.__degrade = null;

  if (state.sheet != null) {
    globalThis.cy.style(state.sheet);

    return lost;
  }

  const { prop, saved } = state;

  for (const { ele, cur } of saved) {
    ele.removeStyle(prop);

    if (text(ele.style(prop)) !== text(cur)) {
      ele.style(prop, cur); // the scene had bypassed it itself

      if (text(ele.style(prop)) !== text(cur)) {
        lost.push(ele.id());
      }
    }
  }

  return lost;
};

/**
 * Export until two consecutive exports agree (a label change re-rasters
 * the atlas a frame or more later), and decode it.
 */
const stableExport = async (page, opts) => {
  let last = null;

  for (let i = 0; i < 6; i++) {
    const png = decodePng(
      await page.evaluate(async (opts) => {
        for (let k = 0; k < 2; k++) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }

        return await window.cy.png(opts);
      }, opts),
    );

    if (last != null && countMoved(last, png) === 0) {
      return png;
    }

    last = png;
  }

  return last;
};

/**
 * Run the degrade control over one golden's live scene and write its
 * record.
 *
 * @param page — the Playwright page, the golden's scene live on it
 * @param name — the golden's name
 * @param coverage — its tier-1 capture (`collectStyleCoverage`'s result)
 * @param opts — the export options the golden used
 * @returns the record written
 */
export const degradeScene = async (page, name, coverage, opts) => {
  let baseline = await stableExport(page, opts);
  const pairs = {};
  let stopped = null;

  for (const pair of pairsOf(coverage)) {
    const [group, prop] = pair.split('/');
    const { changed, via, unresettable } = await page.evaluate(resetInPage, {
      group,
      prop,
    });
    const degraded = await stableExport(page, opts);
    const moved = countMoved(baseline, degraded);
    const lost = await page.evaluate(restoreInPage);
    // a restored image re-decodes asynchronously, so the scene may take
    // a moment to come back; poll, and give up only on a real residue
    const deadline = Date.now() + 5000;
    let back = countMoved(baseline, await stableExport(page, opts));

    while (back > 0 && Date.now() < deadline) {
      await page.waitForTimeout(100);
      back = countMoved(baseline, await stableExport(page, opts));
    }

    pairs[pair] = { moved, elements: changed };

    if (via !== 'bypass') {
      pairs[pair].via = via;
    }

    if (unresettable.length > 0) {
      pairs[pair].unresettable = unresettable;
    }

    if (lost.length > 0) {
      stopped = `${pair}: the restore lost ${lost.length} values`;
      break;
    }

    if (back > 0) {
      // every value came back and the frame did not, quite (a restored
      // image re-decodes into another atlas slot): measure what follows
      // against the restored frame, and say so
      pairs[pair].residue = back;
      baseline = await stableExport(page, opts);
    }
  }

  const record = {
    golden: name,
    pixels: baseline.width * baseline.height,
    pairs,
    ...(stopped != null ? { stopped } : {}),
  };

  fs.mkdirSync(DEGRADE_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(DEGRADE_DIR, `${name}.json`),
    JSON.stringify(record, null, 2) + '\n',
  );

  return record;
};
