## Round 66 — the definition-form load takes the columnar path (raised by the maintainer 2026-08-11)

The question that started it was about the debug harness: *why aren't
"Columnar load" and "Binary wire round trip" checked by default, and
would they speed up first load?*  The answer to the first half is that
they are instrumentation — the harness's default should be the compat
path most apps use, and the two boxes exist so a person can A/B the three
ingest forms in a browser.  The second half is where the round came from.

**What the demo measured.**  ndex-x-large (19,607 nodes / 464,657 edges)
in Chromium on a real adapter (AMD GCN-4, not SwiftShader), fetch start
to first rendered frame, p50 of 3 fresh page loads, all paths
fingerprint-checked identical (counts, positions, `data()`, computed
`background-color`/`line-color`, post-`fit` zoom):

| path | fetch+decode | convert | init | ready | fit+frame | total |
|---|---|---|---|---|---|---|
| JSON (`npm run watch`) | 268 | 104 | 2018 | 87 | 400 | **2899** |
| wire (the status build) | 37 | 95 | 2101 | 91 | 420 | **2754** |
| wire → columnar, no `fromColumnar` | 37 | 17 | 1215 | 86 | 401 | **1762** |

The harness change that motivated the table — stop converting the
decoded columnar payload *back* to definition form for the sheet builders
— was worth 78 ms of it.  The other **886 ms** was the factory ingesting
definitions instead of columns, and that is not the demo's, it is the
library's.  Confirmed on synthetic graphs with no `debug/` code:
converting to columnar and ingesting that beat ingesting the definitions
at every size from 4k to 800k elements, with and without data columns
(1.28–1.70×), the conversion costing 7–10% of what it saved.

**Why, from a CPU profile of a 50k/150k load** (924 ms defs vs 580 ms
columnar), as self time the def path pays and the columnar path does not:
`Table.alloc` **159 ms**, `_addDefs` 54, the `IdIndex` (`allocSlot`,
`get`, `probe`) 76, `addEdge` 38, `setDefData`/`markDataWrite` 21 —
against ~85 ms for the whole conversion.  It is structural, not a
micro-optimisation: ~350 ms of *per-element* work (a slot allocation each,
two id lookups per edge, whose `get` allocates a result object per hit)
traded for one pass that hands the store columns.  GC is the same on both
sides (134 vs 127 ms), so this is not allocation pressure in general.

Landed:

- [x] **`buildColumnar( part, strict )`** in `columnar.mts` — the
  conversion over already-partitioned defs, in two modes.  The public
  `toColumnarElements` is the strict one and still throws on an endpoint
  it cannot resolve; the loader's is not, and answers `null` instead, so
  a payload that is not self-contained simply is not this route's and the
  definition path raises the error **in its own words**.  No `try`/`catch`
  around the converter, deliberately: a real bug in it must not read as
  "not a candidate" and silently cost 1.3× forever.
- [x] **The flag deviations no column can carry.**  A def may set
  `locked`, `grabbable` and `pannable`; the columnar form has columns for
  `selected` and `selectable` only.  Converting blindly would have
  dropped three flags silently — the exact shape of 46.5's lost dictionary
  column.  `buildColumnar` returns the deviating defs by index and
  `_addColumnar` writes them, **before** the style pass (`::locked` and
  `::grabbable` are styleable conditions, and that is where the def path
  has them).  This also leaves `toColumnarElements` lossy for those three,
  which its doc comment now says out loud.
- [x] **`_bulkAdd` routes**, `_addPartition` splits `_addDefs` so one
  partition serves whichever route is taken, and `cy.add()` is untouched:
  adding into a populated graph may legitimately name nodes already there.

**Measured after** (same machine, order alternated, each side its own
process, 5 reps): definition-form `cytoscape({ elements })` 23.6→19.3 ms
at 1k/3k, 173.7→146.5 at 10k/30k, 848→624 at 50k/150k, 4134→3173 at
200k/600k — **1.19–1.36×**, models identical at every size.
`benchmark/load.mjs`'s warmed init row (N=2000) moves 24.95→16.64 ms,
taking it from 6.28× to 8.87× v3 on this machine.  The debug page, with
no harness change at all: JSON 2899→**2163 ms**, wire 2754→**1944 ms**.
And `benchmark:renderer`'s ndex-x-large scene — lean defs, no edge ids,
a real adapter — **1696 → 980 ms**, which is 11.4× → **19.0×** v3 and
the figure `EXECUTIVE_SUMMARY.md`'s headline quotes.

**The spread is the payload's, and one guess about it was wrong.**  The
gain runs 1.19× (200k/600k with data on both groups) to 1.78× (the lean
ndex shape). The first hypothesis — that auto-generated ids would
*shrink* the gain, since both paths must mint 465k strings — was
refuted by measuring it: dropping edge ids at 200k/600k took the ratio
to **1.66×**, the largest of the three variants, not the smallest.

**A near-miss worth recording, because it nearly published a wrong
number.**  The first baseline for that renderer row read 977 ms against
945 — a 3% gain that contradicted everything else, and was taken as a
finding to explain.  It was `git stash push -- src/` followed by a
benchmark that serves `build/cytoscape.umd.js`: **stashing source does
not rebuild the bundle**, so both runs measured the same code.  The trap
is the one `AGENTS.md` already documents for Playwright ("rebuild the
bundle before trusting a run"), and it applies to every browser harness
here, not just that one.  A baseline for a browser measurement has to
swap *bundles*, not sources.

Verification: 14 new specs (13 in `test/bulk-load.mjs`, parity between
the two routes over a fixture carrying every def feature — including a
column-for-column comparison over *every* column in `columnSpecsForGroup`
rather than a hand-picked four; 1 in `test/columnar.mjs`, below), 2181
test:js, 394 test:modules, 24 test:soak, 250 Playwright across every
project, all audits at 100%.

**Three controls, and two of them found something.**

- Not writing the flag overrides fails exactly three specs — including
  the column-for-column parity — which is also the proof that the new
  route is the one being taken.
- Making the converter throw instead of answering `null` fails exactly
  the fallback spec, on the message.
- Moving the flag write *after* the style pass **failed to fail**.  The
  spec was named for the ordering and could not observe it: `setFlag`
  notes a condition-flag change and the slot restyles, so a late write is
  correct, merely wasteful.  The spec has been renamed to what it
  actually asserts and the comment now says which control does land.
- The throw gate went red on `graph-store.mts:1313`, the columnar
  positions-length guard.  It was **never run before this round either**:
  instrumented, it executes zero times across the whole Node suite on
  both sides of the change, so its previous green was line-coverage
  misattribution — the gate's documented blind spot — and routing def
  loads through `addNodesColumnar` moved the attribution and exposed it.
  It now has a deterministic spec (ids must be unique, or the duplicate-id
  guard fires first).

**Not done, and now smaller.**  The harness change that raised all this —
have `debug/init.js` hand the decoded columnar payload straight to the
factory instead of `fixtures.fromColumnar`, with a columnar-aware
`extent`/`magnitude` for the two sheets that scan node data (em-web,
em-desktop; 569 and 1260 nodes) and `fromColumnar` kept for the one
network declaring a `derive` — is worth **167 ms** of the hosted page's
1944 now, not the ~990 it would have been.  (Restated after 66.1, which
moved the page underneath this sentence: ~160 ms of 1756.  The rule this
file keeps tripping on is that a forward-looking number reads exactly
like a measured one a week later.)

### 66.1 — the mapped apply costs per distinct value, not per element (2026-08-11)

Round 66's own decomposition left one item standing: of the harness
page's remaining init, **340 ms was style mappers over 465k edges**.
Asked which mapper, the answer was *one* — and it is not the one the
figure suggests.

**What each clause costs**, same fixture and payload, only the sheet
varying (headless, median of 3):

| sheet | init | delta |
|---|---|---|
| the production sheet, as shipped | 1340 ms | — |
| edges: `line-color` constant | 986 | **−354** |
| edges: both `onSelected` opacities constant | 1290 | −50 |
| nodes: width/height/background constant (3 `case` mappers) | 1372 | +32 |
| nodes: no label | 1345 | −5 |

The three node `case` mappers and 19.6k labels cost nothing measurable;
the whole 340 ms is the edge `line-color` diverging mapper, at **762 ns
per edge**.  A profile diff said where that goes, and the surprise is
that the colour arithmetic is the *small* half: `linearToByte` 31 ms,
`oklabToSrgb` 17, `continuousEval` 20 — against ~218 ms of per-element
apply machinery (`applyMapped`, `applyGroupDef`, `bindCase`,
`writeChannels`, `setStyle`) and 29 ms of GC.  The reason is
`partitionOf`: one data-driven mapper denies the *whole group* the
round-57.1 flag partition, so the two `{ selected: true }` opacity
clauses are evaluated per edge as well.

Landed, both exact — every computed value identical, goldens and parity
untouched:

- [x] **A per-value memo** on continuous/discrete evaluation over a
  numeric column (`style-scales.mts`).  The fixture has **1,920 distinct
  `Mechanism_of_Action` values over 464,657 edges**, its two commonest
  covering 43% of them, so the work was being redone ~242× per distinct
  input.  Sharing one evaluated array across elements is safe for the
  same reason the channel defaults already are: the write path folds into
  fresh arrays and never mutates what it was handed.
- [x] **The state hoist** (`style.mts`): a group without a partition
  still evaluates its state-only `case` mappers only when `flags & mask`
  changes from the previous slot.  `partitionOf`'s comment had said there
  was "nothing to win by partitioning the rest" once a data mapper is
  present; measured, there was — and more than expected, because what
  goes away is not just the evaluation but the per-element closure calls
  and condition reads behind it.

**Measured** (same machine, alternated, own process, 5 reps): the
fixture's init **1364 → 1149 ms (1.19×)**; the hoist is ~219 ms of that
and the memo ~23–58 on top (they overlap).  In the browser, the harness
page's fetch-to-first-frame: JSON **2129 → 2022 ms**, wire **1914 →
1756**.  `benchmark:renderer`'s ndex scene does not move (936 → 930),
correctly: its defs are lean and its sheet has **no mappers at all**, so
there is nothing there for either change to improve — which is also why
that scene could not have found this.

**The memo's own control decided its shape.**  A first version memoized
unconditionally: +8% where data repeats, **−3% where every value is
distinct**.  A second gave up adaptively once misses ran ahead of hits —
and measured *no better*, because the wrapper costs ~5% on 200k distinct
values whether or not it still consults its map.  The shipped version
decides **once, from a 512-value sample**, and returns the original
direct closure when a memo will not pay: all-distinct back to parity,
repeating still ~9% ahead.

Verification: 8 new specs (4 in `test/mappers.mjs` for the memo — same
values as an uncached evaluator, no value carried across an auto-domain
change, fallback for an absent value; 4 in `test/state-conditions.mjs`
for the hoist, interleaved and in runs, plus the control that a sheet
whose state mapper *cannot* be hoisted agrees element for element).
2189 test:js, 394 test:modules, 24 test:soak, 250 Playwright, all audits
100%.  Both controls land: making the hoist never notice a changed word
fails exactly the three per-element specs, and making the memo answer
with any cached value fails the continuous-scale suite wholesale.

### 66.2 — deferring the CPU eval of GPU-owned paint: measured, and not landed (2026-08-11)

The third idea from 66.1's investigation: at construction the CPU
evaluates every mapper, including the paint channels the eval kernel is
about to own — and `mapperRuntime.update()` "configures + fully
evaluates" before the first scene pass reads them, so for a rendered
instance that CPU work is redundant.  Deferring it would serve all three
of the round's goals at once, most directly the third (the main thread
free sooner).

**It is worth ~5%, for a sheet this repo does not have.**  Prototyped by
skipping exactly the props the packer ends up owning, on ndex-x-large
with a sheet whose `line-color` *is* owned: init **996 → 932 ms**,
fetch-to-first-frame **1487 → 1417 ms**, the screenshot **byte-identical**
and `style()` still answering correctly (the getter re-evaluates for an
owned prop).  Real, and small.

**And on the sheets that exist, it is worth nothing at all.**  Nine of
the harness's networks, driven in Chromium on a real adapter, reporting
what the kernel actually owns:

| network | mapped paint props | GPU-owned | dispatches |
|---|---|---|---|
| em-web (569/6899) | 12 | `background-color` | 1 |
| em-desktop (1260/16030) | 12 | `background-color` | 1 |
| em-web-clustered (610/6899) | 12 | `background-color` | 1 |
| white-matter (1499/18288) | 9 | — | 0 |
| ndex-large (3238/68641) | 12 | — | 0 |
| ndex-x-large (19607/464657) | 8 | — | 0 |
| v3-default, node-types, edge-types, labels | 12–18 | — | 0 |

Where ownership happens the graph is small (a `background-color` over
569–1260 nodes, microseconds); where the graph is large, **nothing is
owned**.  Both halves have the same cause: these sheets map
`line-opacity` for the round-57.11 selection affordance, and a mapped
channel opacity demotes `line-color` and the arrow colours (the B1 fold —
a kernel colour program would overwrite the folded bytes); node colour is
a state `case`, which is not packable at all.

So the deferral was **not landed**.  It would buy 0 ms on every sheet
here, and a correct version is not free: candidates are a *superset* of
what the packer owns, so it needs a reconciliation at `setGpuOwned`, a
recovery path for when no adapter arrives, and getters that treat a
deferred prop as lazily evaluated — three new failure paths and a window
in which stored paint is neither correct nor stale but absent.  The
prototype demonstrated exactly that hazard: skipping *candidates*
(rather than owned props) left the node `case` mapper evaluated
**nowhere**, and the graph rendered with grey default nodes — a picture
that looks plausible, which is this repo's recurring failure mode.

**The finding that outlives it**: the blocker on the big sheets is the
demotion rule, not the deferral.  The kernel already folds a mapped
opacity into colour alpha (`FLAG_MUL_ALPHA`, `opacityNow` from an opacity
program packed first), so a *continuous* line-opacity need not demote its
colours.  What it cannot fold is a **state** `case` opacity — exactly
what these sheets use — because a conditional is not packable.  Teaching
the kernel a flag-conditioned constant (a state `case` over conditions
alone has one value per masked flag word, which is what round 57.1's
partition already computes on the CPU) would hand it the 465k-edge
colour mapper: ~160 ms of CPU work per apply on this fixture, and it
would make the deferral above worth having as well.  That is a round,
not a follow-up.

**Amendment (same day): the blocker is the alpha fold, not the `case`.**
66.2 above closed by naming the state-`case` opacity as what keeps the
kernel off these sheets' colour mappers.  That reading was challenged and
does not survive measurement.  Same fixture, same sheet, only
`line-opacity` varying, ownership read *after the first frame* (it is
configured on the first `update()`, not by `cy.ready` — the first version
of this probe read it too early and reported nothing owned anywhere):

| `line-opacity` | GPU-owned edge props |
|---|---|
| `case` (as shipped) | — |
| constant **1** | `line-color` |
| constant **0.25** | — |

A plain constant 0.25, with no conditional anywhere in the sheet, demotes
exactly as the `case` does: the trigger is `computed.lineOpacity !== 1 ||
mapped('line-opacity')`, i.e. **any** non-1 alpha, however it is spelled.

**And `case` mappers are not the expense.**  Priced on the same 464,657
edges, as the cost of the `line-color` clause over a constant baseline:

| clause | cost | per edge |
|---|---|---|
| state-only `case`, 1 clause | −34 ms | ~0 (at the noise floor) |
| state-only `case`, 3 clauses | −26 ms | ~0 |
| mixed `case` (state + data) | +31 ms | 67 ns |
| `case` on a data condition | +40 ms | 85 ns |
| continuous `diverging` mapper | +129 ms | 277 ns |

A state-only `case` is free since 66.1's hoist — it measures at the
constant baseline — and even a data-conditional one is a third of what
the continuous mapper costs.  Moving conditionals into the kernel is
therefore not where the value is; the continuous data mapper is.

**The nearest real opportunity, then**, is narrower and better founded
than what 66.2 first named: the kernel *already* folds a constant edge
opacity into colour alpha through `domain.w`, and the packer already
wires it — but only for arrow props (`isArrowProp( m.prop )`).
`line-color` itself never gets an `alphaMul`, which is why a constant
0.25 has to demote.  Extending that fold to `line-color` (and the node
fill/border pair with their own constant opacities) would make every
constant-opacity sheet's colour mapper kernel-owned, and `FLAG_MUL_ALPHA`
already covers the *mapped*-opacity case for arrows the same way.  What
neither mechanism reaches is a **state-case** opacity, which is what this
repo's sheets use — so ndex-x-large stays CPU-evaluated either way, and
that remains a question about per-element alpha in the kernel rather than
about `case` being slow.

**And the cost is on the update path, not on load** (measured after the
amendment above, in answer to *why should anyone care*).  Ownership does
**not** save CPU at construction — the initial apply evaluates every
mapper whatever the kernel is about to own, which is exactly what 66.2's
rejected deferral would have changed — so the two opacity spellings load
indistinguishably (985 vs 968 ms).  Where it shows is a data write to a
mapped key, which an owned channel re-derives on the GPU and a demoted
one re-derives per element on the CPU.  50,000 writes of
`Mechanism_of_Action` on ndex-x-large, timed to the next rendered frame:

| `line-opacity` | `line-color` | 50k writes → frame |
|---|---|---|
| `1` | kernel-owned | **20–27 ms** |
| `0.25` | demoted | **92–119 ms** |

**4–5×, for changing one constant.**  That is the argument for the fold,
and it is a *principle of least surprise* argument as much as a
performance one: opacity is the property a web developer expects to be
the cheap one — compositing, not layout — and in v4 today setting it to
anything but 1 quietly moves a whole colour channel off the GPU.  Note
what this also says about ordering: the fold and the deferral are
complementary, and the fold is the one that pays on its own.  Deferral
without it saves ~64 ms once; the fold without deferral is worth 4–5× on
every restyle for the rest of the session.

### 66.3 — a constant channel opacity stops demoting its colour (2026-08-11)

The amendment above ended with a claim to act on: the kernel already
folds a constant edge opacity into colour alpha through `domain.w`, and
the packer already wires it — but only for arrow props, so `line-color`
and the node fill/border pair had to demote whenever their channel
opacity was anything but 1.  That is now fixed.

- [x] **The demotion is `mapped(...)` only.**  `paintInputs` demoted on
  `computed.<channel>Opacity !== 1 || mapped(...)`; the constant half is
  gone.  A mapped channel opacity still demotes — its value varies per
  element, and the state `case` form this repo's sheets use is not
  packable at all.
- [x] **Every colour program carries its own fold.**  `PackInput` gains
  `alphaMul`, resolved per prop by `constOpacityFor` (background ←
  `background-opacity`, border ← `border-opacity`, line ←
  `line-opacity`); arrow programs keep overriding it from
  `paintContext`, which also covers their mapped case.
- [x] **The owned-prop getter folds too.**  `readProp` re-evaluates a
  kernel-owned mapper and formatted it *unfolded* — correct only while a
  non-1 opacity was guaranteed to demote.  It now applies the same
  constant, so stored, drawn and reported alpha agree.

**Measured, on the update path this was about**: 50,000 data writes to a
mapped key on ndex-x-large with `line-opacity: 0.25`, timed to the next
rendered frame — **91 → 26 ms, 3.5×** (three reps each side, bundles
swapped).  Load time does not move, and should not: the initial apply is
CPU either way (see 66.2).

**Exactness is the whole claim, so it is a spec rather than a golden.**
`visual.spec.js` renders one scene twice — once with constant opacities
(kernel-folded) and once with the *same* values written as mappers with a
constant range (which demotes, so the CPU folds) — asserts the two really
did take different paths, and diffs the exports: **zero differing
pixels**, `style()` equal on both.  Degrading the fold (`alphaMul`
dropped in `packPrograms`) fails it, on the pixel count.  The whole
suite is unmoved: 251 Playwright including 46 exact goldens and every
v3-parity scene, 2192 test:js, 394 test:modules, 24 test:soak.

**What it does *not* change: this repo's own sheets.**  Re-driving the
nine harness networks shows ownership exactly as 66.2 recorded it —
three `background-color`s on small graphs, nothing on the large ones —
because those sheets *map* `line-opacity` for the round-57.11 selection
affordance rather than setting it constant.  The beneficiary is the
ordinary app idiom (`line-opacity: 0.4` to dim edges), which is why this
landed and 66.2's deferral did not: same zero on the harness, but this
one is exact, has no correctness window, and pays 3.5× wherever the
pattern occurs.

**Still open** (unchanged by this): a *mapped* channel opacity.  A
continuous one could ride `FLAG_MUL_ALPHA`, which the shader already has
and nothing currently reaches, since the demotion removes the colour
before the packer sees it.  A **state `case`** one — what these sheets
use — needs the kernel to resolve a flag-conditioned constant, which is
round 57.1's partition expressed device-side.
