## The sixth design sitting — the backlog sweep

Prompted by a full read of this file: the ledger's numbered items were all
closed, but decisions had accumulated in round records against the standing
rule that every open question surfaces in "Open calls for the maintainer" —
round 52's two calls, 53.1's warm-up judgement — and the three logged
public-surface changes (items 14–16) had never been ratified.  Every call
below was taken with the maintainer; the per-item annotations are in the
ledger, and this is the sitting's own record.

1. **Round 38's three sub-calls, taken** (open call 1 — the round is
   unblocked):
   - **`double` ports v3's erase.**  Alpha-0 stripe fragments (fill and
     border are one draw); double-bordered nodes are excluded from the
     opaque depth prepass on the gradient-fill precedent.  The tier's live
     parity diff is the gate; if the prepass interaction turns out worse
     than expected, the fall-back is the inner band with the deviation
     recorded — but the erase is the intent.
   - **`border-dash-pattern` / `border-dash-offset` both port** — full v3
     parity for dashed borders, on the plumbing v4 already has for the edge
     twins, rather than a hardcoded `[4, 2]` and a recorded drop.
   - **`border-cap` / `border-join` drop**, recorded as a deviation beside
     the existing edge-layer butt-cut note, with migration-guide rows.
2. **Items 14–16 reviewed individually and ratified**: the layout-contract
   type exports stay (14), the cross-instance comparison throw stays (15),
   and the tighter compound `fit()` stays (16).  With 16's ratification the
   logged bounds round is **scheduled as round 54**, before round 49 — the
   residual ~1.8× over-fit is visible in every compound app, and the
   43.13 soundness-sweep method is already the round's gate.
3. **Open call 12 gains its direction; the enumeration holds for 41.5's
   docs-first.**  The maintainer's rule: gestures get **explicit toggles
   first** (the `panningEnabled()` pattern exists precisely to make gesture
   control easy and explicit), and no gesture default may be controllable
   *only* through `preventDefault()`.  Both mechanisms may coexist, toggle
   primary.  41.5's docs-first therefore maps each candidate default to its
   explicit toggle — existing or to be added — before proposing any
   preventDefault rows; the sitting tabled a four-row candidate table
   (recorded in item 12) for that stage to react to.
4. **Round 40 proceeds taxonomy-first.**  Before the sitting proper, an
   autonomous classification pass sorts all 197 throw sites (the
   throw-coverage script already enumerates them) into *contract errors*
   (always throw) vs *recoverable runtime conditions* (today's warn tier),
   producing the candidate list demotion would actually touch.  The sitting
   then reacts to a concrete proposal — `cytoscape.warnings( boolean )` as
   the global toggle plus a per-instance ctor override, with the demotion
   option (`errorPolicy` demoting recoverable-tier throws only, never
   contract-tier) decided on the measured size of that list.
5. **Round 52's call 1 taken: the 52.1 comment-strip build step builds**,
   before round 50 cuts the alpha (17.8 KiB gzipped — 10% of the download —
   for ~30 lines and no dependency, gated by 52.2's pixel diff).  Call 2
   (miniray) is held as ledger item 17, measure-first, expected never
   taken.
6. **53.1's warm-up judgement joins the ledger as item 18**: logged,
   revisit with data — and the maintainer noted the larger future direction
   to keep beside it, a possible **WebGL fallback renderer** for platforms
   that cannot support WebGPU.  Logged as a direction, not scoped.

**Sequencing after the sitting**: 38 → 40 → 46 (decision-free and
unblocked — may be pulled forward) → 52 (before 50) → 54 + round 48's limit
edges → 49 → 50 (`4.0.0-alpha.1`) → 51 (**4.0.0**).

**Amended 2026-08-06, after the sitting**: round 55 was inserted ahead of
38 at the maintainer's request — the edge-routing and arrow parity round,
prompted by opening `debug/?network=v3-default`.  It is a prerequisite
rather than a queue-jump: 38's verification plan is per-tier live parity
diffs, and 55 is what makes such a diff able to fail (twelve of the 29
parity scenes had no ink floor, and the curve scenes deliberately drew no
arrows).  55 landed its harness and one fix; **its fix 3 — the arrow gap
port — is unlanded and carries into the next round**, with failing tests
and verified constants in place.

So the sequencing now reads:
55's remainder → 38 → 40 → 46 → 52 → 54 → 49 → 50 → 51.

Process note, on the fifth sitting's precedent: this sitting lands as a
PLAN.md edit plus the derived `EXECUTIVE_SUMMARY.md` open-questions update
(an item leaves that table when it is *decided*, which several did today);
the `src/README.md` true-up rides round 38's docs-first commit.
