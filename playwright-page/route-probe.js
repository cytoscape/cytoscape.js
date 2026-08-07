/*
Round 55: the numeric routing probe, loaded by parity.html beside the two
libraries.

Why a page and not Node: v3 computes edge routing **only inside its
renderer**.  Its headless renderer is a 23-line stub whose
`getControlPoints`/`getSegmentPoints`/`getSourceEndpoint`/`getEdgeMidpoint`
do not exist, so a Node comparison would have to monkey-patch v3's base
renderer prototype — and, worse, importing v3's entry from `test/` would
make the Node tier depend on a v3 install, which `ci-node` deliberately
does not do.  On this page v3's canvas renderer is real and unpatched.

The probe is deliberately **symmetric**: one function, applied to either
instance, asking only public accessors that both libraries expose under
the same names.  Nothing here special-cases v3 or v4 beyond the one
cache-flush v3 needs.  That is the point — if the two sides answer the
same public question differently, that difference is the finding, and a
probe with a per-side fixup would be the place such a finding goes to
die.

Two semantics worth knowing before reading a diff, both v3's and both
deliberate:

  - `sourceEndpoint()`/`targetEndpoint()` return v3's **arrow** points
    (`rs.arrowStartX/Y`, `rs.arrowEndX/Y` — the `spacing`-shortened
    points), not the line ends `rs.startX/Y`.  For every head except
    `tee`, `spacing` is 0, so these are the node-boundary points.
  - `segmentPoints()` covers **taxi as well as segments** — v3's
    `findTaxiPoints` sets `rs.edgeType = 'segments'` — while
    `controlPoints()` is undefined outside the bezier family.
*/

(function () {
  'use strict';

  /** [x1,y1,x2,y2,…] or [{x,y},…] → [{x,y},…]; null/undefined → []. */
  function toPoints(raw) {
    if (raw == null) {
      return [];
    }

    var out = [];
    var i;

    if (typeof raw[0] === 'number') {
      for (i = 0; i + 1 < raw.length; i += 2) {
        out.push({ x: raw[i], y: raw[i + 1] });
      }

      return out;
    }

    for (i = 0; i < raw.length; i++) {
      out.push({ x: raw[i].x, y: raw[i].y });
    }

    return out;
  }

  /** A point that survives JSON and keeps non-finite values visible. */
  function pt(p) {
    if (p == null) {
      return null;
    }

    return { x: num(p.x), y: num(p.y) };
  }

  /** JSON drops NaN/Infinity to null, which would make a NaN look like a
   * missing value — and a missing value is a different defect.  Send
   * non-finite numbers as tagged strings so the comparator can tell them
   * apart and report both as structural rather than numeric. */
  function num(v) {
    if (typeof v !== 'number') {
      return null;
    }
    if (Number.isNaN(v)) {
      return 'NaN';
    }
    if (!Number.isFinite(v)) {
      return v > 0 ? 'Infinity' : '-Infinity';
    }

    return v;
  }

  function callOrNull(fn) {
    try {
      return fn();
    } catch (e) {
      return { __error: String((e && e.message) || e) };
    }
  }

  /** Is this a real point — both components finite numbers? */
  function finite2(p) {
    return (
      p != null &&
      typeof p.x === 'number' &&
      typeof p.y === 'number' &&
      Number.isFinite(p.x) &&
      Number.isFinite(p.y)
    );
  }

  /** Is this a real box?  v4 answers `{x1: null, …}` when its geometry
   * went NaN, because the min/max fold never took a comparable value. */
  function finiteBox(bb) {
    if (bb == null || bb.__error) {
      return false;
    }

    return ['x1', 'y1', 'x2', 'y2'].every(function (k) {
      return typeof bb[k] === 'number' && Number.isFinite(bb[k]);
    });
  }

  /**
   * One routing record per edge, from public accessors only.
   *
   * @param cy — either library's instance
   * @param ids — edge ids to probe, in order
   */
  window.probeRoutes = function (cy, ids) {
    // v3 caches rendered style per element and this page reuses instances
    // across scenes; without the explicit invalidation a scene can read the
    // previous scene's geometry and agree with itself.  v4 has no such
    // method — its accessors flush the derivation on read.
    var eles = cy.elements();

    if (typeof eles.recalculateRenderedStyle === 'function') {
      eles.recalculateRenderedStyle(false);
    }

    var out = {};

    for (var k = 0; k < ids.length; k++) {
      var id = ids[k];
      var e = cy.$id(id);

      if (e.length === 0) {
        out[id] = { id: id, missing: true };
        continue;
      }

      var ctrl = callOrNull(function () {
        return e.controlPoints();
      });
      var seg = callOrNull(function () {
        return e.segmentPoints();
      });
      var interior = toPoints(ctrl && ctrl.__error ? null : ctrl);
      var segPts = toPoints(seg && seg.__error ? null : seg);

      // The structural signature, computed identically on both sides.  It
      // is *not* v3's `rs.edgeType` vocabulary: mapping v4 onto that would
      // mean inventing the correspondence this harness exists to check.
      // What both libraries genuinely publish is which accessor answers
      // and with how many points, so that is what is compared.
      var sig;

      if (interior.length > 0) {
        sig = 'ctrl:' + interior.length;
      } else if (segPts.length > 0) {
        sig = 'seg:' + segPts.length;
        interior = segPts;
      } else {
        sig = 'none';
      }

      var rec = {
        id: id,
        sig: sig,
        src: pt(
          callOrNull(function () {
            return e.sourceEndpoint();
          }),
        ),
        tgt: pt(
          callOrNull(function () {
            return e.targetEndpoint();
          }),
        ),
        mid: pt(
          callOrNull(function () {
            return e.midpoint();
          }),
        ),
        interior: interior.map(pt),
      };

      // Finiteness is tracked separately from the compared values, and
      // `bb` is only ever read here.  Two reasons.  The bounding box is
      // not comparable across the libraries — v3's edge bb folds in terms
      // v4's does not — so putting it in the diff would be permanent
      // noise.  And the defect that motivated it is v4-only in its
      // *consequence*: on axis-aligned round-taxi both libraries divide
      // by a zero leg, but v4's NaN propagates all the way out to
      // `boundingBox()`, which answers `{x1: null, …}`.  Comparing that
      // against v3 would call two broken values a match; asserting it is
      // finite is the check with teeth.
      rec.finite = {
        src: finite2(rec.src),
        tgt: finite2(rec.tgt),
        mid: finite2(rec.mid),
        interior: rec.interior.every(finite2),
        bb: finiteBox(
          callOrNull(function () {
            return e.boundingBox();
          }),
        ),
      };

      out[id] = rec;
    }

    return out;
  };

  /**
   * Build both instances for a scene and probe them.
   *
   * Instances are destroyed first: `makeV3`/`makeV4` overwrite the globals
   * without tearing down the previous graph, and a scene that silently read
   * the previous scene's numbers would agree with itself perfectly.
   */
  window.probeScene = async function (scene) {
    if (window.cy3) {
      window.cy3.destroy();
      window.cy3 = null;
    }
    if (window.cy4) {
      window.cy4.destroy();
      window.cy4 = null;
    }

    var clone = function () {
      return JSON.parse(JSON.stringify(scene.elements));
    };

    // v3's default layout is grid, which would move every node; `preset`
    // with `fit: false` keeps the authored positions and the viewport
    var cy3 = window.makeV3({
      elements: clone(),
      style: scene.v3Style,
      layout: { name: 'preset', fit: false },
    });
    var cy4 = window.makeV4({ elements: clone(), style: scene.v4Style });

    await cy4.ready;

    return {
      v3: window.probeRoutes(cy3, scene.edges),
      v4: window.probeRoutes(cy4, scene.edges),
    };
  };
})();
