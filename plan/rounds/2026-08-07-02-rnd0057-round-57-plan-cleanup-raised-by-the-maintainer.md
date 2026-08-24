## Round 57 plan — cleanup (raised by the maintainer 2026-08-07)

Six items, all from the maintainer, none blocked on a decision.  *(The
round closed with 57.7 and then reopened four times on 2026-08-08 —
57.8 through 57.11, each also maintainer-raised: the edge-press /
hit-halo / arrowhead-picking arc, and the debug harness moved onto the
default style.  Their entries follow the originals below.)*

1. **The default stylesheet should look like v3's.**  Grey by default for
   both nodes and edges, the same blue on selection for both, and v3's
   **active** style expressed through the overlay props — which v4 has
   (round 13 A2 ported them precisely so the baked-in affordances could
   become styled defaults) and has not yet used for this.
2. **Adopt `oxfmt`, and drop the extra-space call style.**  `cy.foo( bar,
   baz )` becomes `cy.foo(bar, baz)` — a standard format rather than this
   repo's own.  Mechanical, and best done in one commit that touches
   nothing else so it stays reviewable.
3. **The status site's design and record pages each open with one huge
   paragraph.**  Fix the *source* markdown (`src/README.md` and this
   file's header) so both read as prose rather than as a wall — the site
   publishes them verbatim, so there is nothing to fix in the generator.
4. **The documents are too bullish about v4 being close to ready.**  They
   are not, and the planned rounds are only the ones that happen to be
   written down — the maintainer can name several more that are not
   logged yet.  Say both things explicitly: temper the readiness language,
   and state that the round list is the *currently documented* set rather
   than an exhaustive plan.
5. **More demo networks in `debug/`**, ported from v3's demos: node types,
   edge types, edge arrow types, labels.  The harness has ten networks and
   round 46.6 added v3's default debug graph for exactly this reason —
   these four are the next most useful for judging a rendering change by
   eye.
6. **The status build's path checker warns on eight paths that are
   deliberately historical** — round 42's record of the `src/gpu/` → `src/`
   rename, and the AGENTS.md lesson that *quotes* the old spellings as
   examples of what went wrong.  Every one is correct prose; the checker
   cannot tell a pointer from a quotation.  A warning that fires on every
   build and is always to be ignored is worse than none, so either teach
   the checker to skip fenced/quoted historical names or exempt those two
   files' history sections explicitly.

   (Found 2026-08-07 while sweeping
   the docs; the genuinely stale pointers it *did* surface — three v3
   sources that moved under `v3/` and one line-wrapped path — were fixed
   in the same pass.)

### Code investigation (2026-08-07, precedes the passes)

**Item 1's first clause is already true, and measuring it is what says
so.**  Every property v4 accepts was read back from a bare node and a bare
edge on *both* libraries (round 47's method — ask the running code, do not
transcribe the ledger).  72 (group, property) pairs differ, and 68 of them
are **spelling**: `0` against `0px`, `-0.7853981` against `-45deg`,
`rgba(0,0,0,0)` against `rgb(153,153,153)` where v4 folds a zero opacity
into the colour it reads back and the channel is invisible on both sides.

Four are real, and only one of them is this round's:

| | v4 | v3 | |
|---|---|---|---|
| edge `width` | 2 | **3** | v3's default sheet says `edge { width: 3 }` — **fixed here** |
| node `text-valign` | bottom | top | recorded deviation, round 13 D3 — every label golden pins it |
| edge `curve-style` | straight | haystack | signed-off round-12 call 1, performance-first |
| node `font-family` | `sans-serif` | `Helvetica Neue, Helvetica, sans-serif` | one font per atlas; the stack's tail is v4's value |

`background-color` and `line-color` do not appear in that diff at all:
both are `#999` on both sides, and have been since round 1.  So "grey by
default for both" needed nothing, and the item's real content is the two
affordances that are **not** properties — selection and active — which v4
bakes into the shader where v3 spells them in its default stylesheet.

**What v4 actually draws today**, against v3's five default-sheet rules:

- `:selected` — v3 paints the node body, the line and all four arrow
  colours `#0169D9`.  v4 draws a **ring** at the node boundary and gives an
  edge *nothing at all*: `FLAG_SELECTED` is read at exactly one place in
  all of the WGSL (`shaders.mts`, the node fragment shader).  A selected
  edge is indistinguishable from an unselected one.
- `:parent:selected` — v3 tints `#CCE1F9` / `#aec8e5`; v4 has no such case.
- `:active` — v3 lays a black overlay at 25% over 10 px of padding.  v4
  has `FLAG_ACTIVE` and the public `activate()`/`active()` pair, and
  **nothing reads the bit**: the pointer layer never sets it, and no
  shader binds it.  What v4 draws instead is a +0.15 rgb brighten on
  `FLAG_HOVERED | FLAG_GRABBED`, which round 13 A2's own record marked as
  the placeholder ("the existing shader hover/active brighten, accent ring
  and DOM selection box become the styled defaults").
- `:parent` — v4's parents overlay carries v3's five properties exactly
  (round 14.6).  Nothing to do.
- `:loop` / `edge:compound` — v3 forces `bezier` on both; v4 routes loops
  as loops and ancestry edges as `CURVE_CMPD` regardless of declared
  style, which is the same look by a different mechanism.  Nothing to do.

### Design calls (round 57)

1. **The affordances stay shader-drawn; only what they draw changes.**
   v4 has no `:selected` blocks and does not restyle on selection — that is
   decided design, and round 4's select/unselect fast path
   (`dependsOnSelection`) rests on it.  So this round does **not** reopen
   selection-dependent restyling: it changes the *pixels the shader
   produces* for a selected or active element to v3's, and leaves stored
   truth alone.  Consequence, recorded: `style('background-color')` on a
   selected node still reads its own colour, exactly as it does today with
   the ring.

   ***Reversed by the maintainer, and 57.1d implemented the reversal.***
   The call above is wrong in its premise rather than its trade-off: "v4
   has no `:selected` blocks" is true and irrelevant, because v4 has
   *conditions*, and a `{ when: { selected: true } }` case had been
   compilable since round 14.7's structural pair.  The rules live in v4's
   **default stylesheet** now, spread before the user's block.  Round 4's
   fast path survives unchanged and generalised: a flag write reaches the
   style engine only when some condition reads that state, so a sheet
   naming its own colour makes selection free exactly as before.  And
   `style('background-color')` on a selected node reads **blue**, which is
   what v3 answers.  Design calls 3 and 4 below fall with it.
2. **`FLAG_ACTIVE` becomes the press state, as in v3**, set by the pointer
   layer on press and cleared on release/cancel — v3's `near.activate()` /
   `unactivate()` in `load-listeners.mts`.  It is already public API
   (`activate()`, `active()`, `inactive()`), so this makes an existing
   surface mean something rather than adding one.
3. **The active overlay rides the round-13 A2 layer machinery**, which is
   what the item asks for.  The overlay pass draws a synthesized default
   record — black, 25%, padding 10, round-rectangle — for an active
   element that has styled no overlay of its own; an element that *has*
   one keeps it (a user's overlay is not overridden by a press).  That
   needs the cull predicate and the pass gate to admit active elements,
   which is where the work is.

   ***Superseded (57.1d).***  It rides the overlay machinery, but as a
   *style value* rather than a synthesized record: the default sheet sets
   `overlay-opacity` behind `{ active: true }`, and the other two of v3's
   three declarations are already v4's constants.  So the cull predicate
   and the pass gate needed nothing after all — a pressed element simply
   has an overlay — and the "substituted only where nothing is styled"
   rule turned out to be a hand-rolled imitation of stylesheet
   precedence, which the spread does exactly.
4. **The grab half of the brighten goes; the hover half stays.**  A
   pressed element now gets v3's overlay, so brightening it too would be
   two affordances for one state.  Hover is a different state that v3 does
   not style at all and v4 has no other way to express — dropping it would
   remove feedback the maintainer did not ask to remove — so it stays, as
   a recorded deviation from v3 rather than an oversight.

   ***Reversed by the maintainer (57.1d).***  "v4 has no other way to
   express it" was the same false premise one layer down — `hovered` is a
   condition like any other.  The brighten is deleted, and a sheet that
   wants the feedback writes it.  Note what it had been: a hard-coded
   `color.rgb + 0.15` that no spec covered and no stylesheet could turn
   off.
5. **`oxfmt` lands before everything else.**  It rewrites every source
   file, so landing it first means the rest of the round is written in the
   new style once rather than reformatted after the fact.  The one thing
   to watch is that the throw-coverage gate's allowlists are keyed by
   `file:line` (round 37.1) — a reformat that moves a `throw` by one line
   fails the build, correctly, and the fix rides the same commit.
6. **The path checker gets a maintained allowlist, not a heuristic.**  A
   "skip anything that looks historical" rule cannot tell a quotation from
   a stale pointer, which is the distinction that matters — the same sweep
   that found these eight also found four *genuinely* stale ones.  So each
   exempt spelling is listed with its reason, and the list is validated on
   37.1's terms: an entry that no longer appears in any document, or one
   whose path has come back into the tree, fails its spec.  A dead
   exemption is exactly as bad as a false warning.

### Pass split (docs in-commit; each pass its own commit(s))

- [x] **57.0 Docs-first** — this section.
- [x] **57.2 `oxfmt`** (2026-08-07) — 325 files outside `v3/`, two config
  overrides (`singleQuote`, `printWidth: 80`) and the rest of the tool's
  defaults.

  **The reformat is a free control on every tool that reads
  the sources as text, and it found four defects.**  The `@param` gate
  read 232/232 while five public members were invisible to it — it
  captured the argument list with `\(([^)]*)\)`, so a member whose
  parameters wrapped matched nothing and was skipped, and
  `Collection.boundingBoxAt` had no `@param` at all behind that.
  `memberBody` stopped at a wrapped signature's first *parameter* line
  (two-space indented, so it reads as the next member) and again at a
  multi-line return type's `  } {`, dropping `@throws` detection for
  every exported arrow function in `src/algorithms/` and for
  `Collection.boundingBox`.  An `export const f =` that broke after the
  `=` vanished from all four audits.  And the throw gate had a **false
  pass**: `src/style.mts`'s bg-length guard sits in a module-level arrow
  const — the misattribution the script documents as its own blind spot
  — so it read as covered while no spec had ever fired it.  Each is
  fixed by joining the signature before parsing it; the guard got the
  spec round 30.1 would have written, with a message assertion and a
  control.  `@param` is 239/239 now *(240/240 since round 52 added the
  `wgsl` tag)*.  Five `file:line` allowlist entries
  moved and the gate named all five, which is the failure mode 37.1 was
  built for arriving a third time.  Goldens byte-stable, every parity
  scene at its recorded value.
- [x] **57.6 The path checker's allowlist** (2026-08-07) — six
  spellings, `HISTORICAL_PATHS` in `scripts/status/markdown.mjs`, each
  with the rename or the lesson that quotes it.  A quoted span still
  renders marked (`path-historical`, the reason as its title) — a reader
  should see that it names nothing — but it is not a warning, and the
  build now reports **zero** documented-path warnings, which is what
  makes the remaining ones worth reading.
  Checked in both directions, on 37.1's terms: an entry no document
  mentions fails, an entry that starts resolving fails, an entry with no
  reason fails, and the build warning about *any* path fails.  All four
  controls run: dropping one exemption, adding a dead one, adding one
  that resolves (`src/core.mts`) and adding a reasonless one each fail
  exactly the spec written for them.
- [x] **57.3 The document openings, then the documents** (2026-08-07) —
  `src/README.md` opened with a **261-line** paragraph and this file with
  a **182-line** one; the status site publishes both verbatim, so that is
  what a reader arriving at the design page and the record page saw
  first.  Both are now broken at their natural round boundaries — the
  longest header paragraph in either is 22 lines — and both gained a
  short lead that says what the document is, what it is *not*, and which
  two or three sections a reader usually wants.  `src/README.md`'s
  chronology also gained an `h2`, so the site's table of contents offers
  it as something to skip rather than as 250 lines of undifferentiated
  text.

  No prose was dropped: the edit is paragraph breaks, four connective
  sentences where a `;` became a full stop, and the two leads.

  **A second pass took the same treatment through both documents**,
  because fixing the two openings left the walls behind them.  Every text
  block over ~1200 rendered characters is now cut at sentence boundaries
  — this repo writes two spaces after a full stop, which makes the cut
  points unambiguous.  Measured as the site renders it, blocks over 1200
  characters: `src/README.md` **54 -> 12**, this file **179 -> 39**.

  Three things are worth keeping from how it was done.

  - **Cut, do not reflow.**  The first attempt re-wrapped the paragraphs
    it split, which produced a **10,000-line** diff in which the real
    change was unreviewable and the two-space sentence convention was
    destroyed.  The edit that shipped inserts blank lines and changes
    nothing else, so every hunk reads as what it is.
  - **The control is render identity, not a diff.**  Strip the tags from
    `renderMarkdown()`'s output, collapse whitespace, and the before and
    after must be **byte-identical**.  That is what caught a cut landing
    inside a `***bold italic***` span — the two halves stopped being one
    emphasis run, one `<em>` vanished, and nothing else in the document
    or the build would have said so.  (The bug beneath it: the span
    guard counted markers from the enclosing block rather than the list
    item, so an odd `*` in one item made the count even in the next.)
  - **Measure what a reader sees, not what the parser labels.**  The
    first measurement counted `<p>` only, and a tight list item emits
    none — so the biggest walls in both documents were invisible to it,
    including several over 3000 characters.  Count `<p>` *and* tight
    `<li>`.

  What remains long is a handful of dense enumerations whose clauses are
  separated by semicolons rather than sentences (the longest, 4391
  characters, is `src/README.md`'s viewport/event surface list).  Those
  are lists written as prose; breaking them is an editing job, not a
  mechanical one, and is left.
- [x] **57.4 The readiness language** (2026-08-07) — the claim is now
  made in the same words in four places, because a reader arrives at
  whichever one they arrive at: this file's header, `src/README.md`'s
  lead, the status site's landing page (**"Not a release, and not close
  to one"**) and `EXECUTIVE_SUMMARY.md`, which round 56 had already
  tempered.  `README.md`, `CHANGELOG.md` and `MIGRATING.md` — the three
  that ship — were checked and already said "not released; use
  `cytoscape@3`", so they gained nothing.
  Both documents also say *why* they read optimistically, which is the
  part that stops the sentence being decoration: they are assembled from
  rounds that closed green, so "landed", "complete" and "at parity"
  appear on nearly every line and each is true about its own scope
  only.  Those phrases are kept as written — they are accurate history —
  and the caveat is what keeps their sum from reading as a claim.
  **And the sweep found the section that had drifted the other way**:
  `src/README.md`'s follow-up hooks still opened with round 55's unbuilt
  arrow `gap`, the day after round 56 built it, describing v4's largest
  measured divergence from v3 as outstanding when the three scenes it
  cites now read 0.000% / 0.442% / 0 differing pixels.  A list of what is
  still open is worth exactly as much as its freshness, which is now said
  in the list itself.
- [x] **57.5 Four more debug networks** (2026-08-07) —
  `?network=node-types` / `edge-types` / `edge-arrows` / `labels`,
  ported from `v3/documentation/demos/`, built in-page with explicit
  positions (grid's column count depends on the container's aspect
  ratio — the trap round 43.12 recorded) and a hand-authored v4 sheet
  each.  Where v3 writes a class selector these carry a data key and the
  sheet maps it through a `case`, which is v4's answer to per-element
  styling.  The harness goes from ten networks to fourteen, and five of
  them are now about *drawing* rather than scale.

  Three things the port could not take verbatim, each a recorded limit
  rather than a shortcut: v3's `shape-polygon-points: data(points)` has
  no v4 spelling (list props are constants-only), so the cross rides as
  a constant that only the `polygon` node reads; the two
  unbundled-bezier rows share one parameterisation for the same reason
  (round 46.6 hit this porting v3's default graph); and v4 has the 3x3
  label-anchor grid without v3's `-inside` variants (round 13 D3), so
  those cells are dropped rather than faked.

  **The spec is the interesting part.**  "The sheet compiles" is what
  round 43 shipped, and a maintainer found three defects by opening the
  page a day later — so these four get the property they exist for
  instead: *every keyword the fixture names must read back as itself*.
  That is round 56's defect made detectable, where four compound
  arrowheads had been listed in a golden's scene since round 27.6 with
  no mapper clause, drawing as `triangle` for nine rounds under a golden
  that passed throughout.
  It found one on its first run.

  `arrow-fill` never resolved to
  `hollow`: the helper builds its clauses from `Object.keys`, which
  turns the boolean `true` into the string `'true'`, so the comparison
  was `eq: 'true'` against a boolean and every edge read `filled`.  The
  screenshot would have shown twelve identical filled heads — plausible,
  and exactly the failure the spec is named for.
  Controls: unmapping one shape keyword, one curve family, or collapsing
  two cells of the anchor grid each fail exactly one spec.

  And the page was driven, per the standing rule: all four render in a
  real browser at their expected counts with no page errors, and the
  screenshots moved the arrowhead labels above their nodes (a
  left-aligned `triangle-backcurve (hollow)` overhangs the next column)
  — a defect no spec would ever have raised.
- [x] **57.1a The selection look, and edge `width`** (2026-08-07) — the
  node fragment shader draws v3's `:selected` rule instead of v4's accent
  ring: the **fill** goes `#0169D9` and the border keeps its own colour,
  and a selected compound parent takes v3's `#CCE1F9` / `#aec8e5` pair
  (`:parent:selected`, which v4 had recorded as unported).  Deliberately
  outside the LOD branch, so a selected node stays visibly selected at
  far zoom where decorations collapse.

  `FLAG_GRABBED` leaves the hover
  brighten, since 57.1c gives a pressed element v3's overlay instead and
  two affordances for one state is worse than either.  Edge `width`
  default 2 -> 3, v3's default sheet's only element rule.
  **A parity scene that could not have passed before**, which is the
  point of building it: v3 fills a selected node and v4 ringed one, so
  the two disagreed over the whole interior of every selected node and
  no scene covered it.  `parity-selection` reads **0.017%** (20 px) over
  selected leaves, a selected parent and their unselected twins, with
  neither stylesheet mentioning selection — so what it compares is
  precisely the two libraries' defaults.  Two controls, both failing even
  the suite's loose 3% default: **3.147%** with the colour removed and
  **5.883%** with a selected parent taking the leaf colour.
  **And it found a real divergence, recorded rather than hidden.**  The
  scene's first draft styled `background-color` and read 5.18%: in v3
  the selection rules are *default-sheet* rules, so a user block naming a
  colour comes later and beats them — a v3 app with a palette shows no
  selection colour unless it writes its own `:selected`.  v4 has no
  `:selected` to write, so matching that exactly would leave an app no
  way to make selection visible at all.  The shader wins instead; the
  deviation is in `src/README.md` with the mechanism that would reverse
  it (a per-group bit in the Frame uniform, which is *exact* here rather
  than approximate, because a v4 sheet has exactly one block per group).

  ***The deviation was rejected, and 57.1d removed it.***  The premise —
  "v4 has no `:selected` to write" — was wrong when it was written: the
  `case` mappers had carried a `{ selected: ... }` condition since
  earlier the same day, so an app *could* write the rule, and the whole
  question was which sheet the default lived in.  It lives in v4's
  default stylesheet now, spread before the user's block, which is v3's
  precedence exactly.  Read 57.1d, not this paragraph.
  Goldens: **two** moved and eleven did not.  `UPDATE_GOLDENS=1` rewrites
  every golden whether or not it exceeded its bound, so the run was
  re-checked without it — only `selection-accent` (its scene grew a
  parent pair) and `polygon-shapes` (its selected star) actually failed,
  and the other eleven were reverted as sub-tolerance drift.

  That is
  round 27.3's discipline, and it is the difference between a golden
  diff that means something and one that means "a run happened".
  One renderer spec changed and says more for it: the node it adds while
  headless is added `selected: true`, so it now draws blue rather than
  the sheet's red — which pins that the flag survived the re-mount as
  well as the geometry.
- [x] **57.1b Selection reaches edges and arrows** (2026-08-07) — the
  edge, curved-edge and both arrow fragment shaders bind `edge.flags`
  and take v3's `#0169D9` on `line-color` and on all four arrow colours,
  which is what v3's `:selected` does.

  Before this a selected edge in
  v4 was **indistinguishable from an unselected one**: `FLAG_SELECTED`
  was read at exactly one place in all of the WGSL, the node fragment
  shader.
  The binding is the interesting half.  Three of the four shaders had a
  free fragment slot; the straight edge shader had none — eight storage
  buffers in each stage — and the fix was not the layout split open call
  24 names but something cheaper that the split's own reasoning
  suggests: the fragment stage wanted **one number** out of
  `edge.curveParams` (the straight-triangle kind), so it now takes that
  as a flat varying and the column went vertex-only, freeing its slot.
  A binding for a number is what the budget could not afford.
  `parity-selection` grew selected and unselected straight edges, a
  selected `unbundled-bezier`, and circle/triangle heads on all of them,
  and reads **0 differing pixels** — v4's selection look is not close to
  v3's here, it is the same image.  Four controls, each failing the
  scene's 0.1% bound: 3.147% (node colour removed), 5.883% (a selected
  parent taking the leaf colour), **0.690%** (the line left untinted)
  and **0.367%** (the heads left untinted).  The last two are the reason
  the bound is 0.1% and not the suite's 3% default — at 3% both would
  have passed with the feature missing, which is round 27's own
  cautionary case.
- [x] **57.1c v3's `:active`, through the overlay props** (2026-08-07) —
  the item's third clause, and the one round 13 A2 had already written
  the machinery for: "the existing shader hover/active brighten, accent
  ring and DOM selection box become the styled defaults."

  `FLAG_ACTIVE` and the public `activate()`/`active()`/`inactive()` trio
  have existed since round 6 with **nothing reading the bit** — no shader
  bound it and the pointer layer never set it.  Now the pointer sets it
  on press and clears it on every gesture end (v3's `near.activate()` /
  `unactivate()`), and the overlay layer substitutes v3's record — black,
  25%, padding 10, round-rectangle — for an element that has styled no
  overlay of its own.  A user's overlay is never overridden by a press.
  Three pieces had to agree or the affordance appears in some graphs and
  not others: the **pass gate** (the overlay pass is skipped when nothing
  is styled with one, so it now also runs while something is active), the
  **cull predicate** (which rejected a disabled record, so a pressed node
  was culled before it could draw), and the **layer shader**.  The cull's
  substitution and the shader's are the same record for the same reason
  they were in round 12a: a cull that disagrees with a draw either drops
  the element or sizes it wrong.
  One thing needed an entry point rather than a uniform: the same shader
  draws both layers with a different record column bound, so it cannot
  tell overlay from underlay — and synthesising `:active` for both would
  darken the padding ring twice.  `vsLayerPlain`/`fsLayerPlain` are the
  underlay's, chosen at construction where the column already is.
  Verified in the browser, and the sample point is what makes the spec
  discriminate: it sits in the 10 px ring *outside* the node, where only
  an overlay can put ink — a brighten of the body would leave it white.
  Three controls, each failing it: the pointer not setting the flag, the
  cull dropping active nodes, and the pass gate ignoring them.  Four Node
  specs pin the store's active count over its three writers (the
  single-slot path the pointer uses, the bulk path `activate()` uses, and
  removal), because a count leaks: a pressed element removed under the
  cursor would hold the overlay pass alive forever.  Both bookkeeping
  controls fail.
  **Two recorded deviations.**  `:active` reaches nodes only — the
  press target is the synchronous CPU pick, which is nodes-only by round
  17.3's own deviation — so pressing an edge activates nothing, and this
  is that limit rather than a new one.  And v4 keeps a hover brighten
  v3 has no rule for, because v4 has no `:hover` an app could write.

  ***The second one is gone (57.1d).***  "v4 has no `:hover` an app could
  write" was the same false premise as the selection deviation's, one
  layer down: the condition vocabulary is v4's answer to a state
  selector, and it can hold `hovered` as easily as `selected`.  The
  brighten — a hard-coded `color.rgb + 0.15` in the node fragment shader,
  which no spec had ever covered — was deleted, and `{ hovered: true }`
  is what an app writes instead.  Everything this entry says about the
  *machinery* (the pass gate, the cull predicate, the two entry points,
  the active count) also went with it: those existed to make a shader
  constant reachable, and there is no constant.
- [x] **57.1d The states are style, not shader constants** (2026-08-07)
  — 57.1a–c drew v3's `:selected`, `:parent:selected` and `:active` from
  the flags word inside the shaders, and recorded two deviations to
  explain what that cost.  Both were rejected.  This pass makes state a
  **`case` condition**, which is what v4 has instead of a state selector,
  and moves the three rules into v4's **default stylesheet** — spread
  before the user's block, so declaring the prop replaces the rule, which
  is v3's order-based precedence and not an approximation of it.

  What that took, in order of how much of it was new: **nothing much**.
  The condition vocabulary, the reserved `'::'` keys, the value reader,
  the dependency set and the change-driven refresh all existed for round
  14.7's `{ parent }` / `{ child }`.  The round is mostly *deletion*.

  **The vocabulary.**  `selected`, `selectable`, `locked`, `grabbed`,
  `grabbable`, `active`, `hovered`, plus `childless` and `orphan` as the
  two structural negations under their v3 names.  Each is a boolean, so
  v3's six negative selectors (`:unselected`, `:unlocked`, `:free`,
  `:ungrabbable`, `:unselectable`, `:inactive`) are the same key with
  `false` — one key per state rather than a pair.  The binding lives in
  `contract.mts` (`CONDITION_FLAGS`), in one direction for the reader and
  the reverse for the flag-write side, because it is flag semantics and
  both halves have to agree.
  Deliberately absent, each for a reason worth keeping: `:compound` (its
  node meaning is exactly `parent`; its edge meaning — touching a parent
  — is not a bit, and a spelling that silently means less than v3's is
  worse than no spelling), `:loop` / `:simple` (a column compare), and
  `:visible` / `:hidden` / `:transparent` (**computed from style**, so a
  rule conditioned on one would be circular — v3 gets away with it by
  re-running selectors).

  **What came out of the shaders.**  `SELECT_ACCENT`,
  `SELECT_PARENT_FILL`, `SELECT_PARENT_BORDER` and every selection branch
  in `fsNode` / `fsEdge` / `fsCurvedEdge` / both `fsArrow`s; the
  `edge.flags` binding 57.1b had freed a slot for; `ACTIVE_RECORD` and
  `layerRecord()`; the duplicate of that record in `NODE_LAYER_CULL`, the
  one the cull comment said "must agree" with the shader's; the
  `vsLayerPlain` / `fsLayerPlain` entry points and the `node.flags`
  binding the layer pipeline carried for them; `activeCount()` and its
  three writers in the store; and the three widened pass gates in
  `renderer.mts`.  Four shader flag constants are now unread and gone.

  **And the hover brighten, which nothing had ever tested.**  A
  hard-coded `color.rgb + 0.15` in the node fragment shader, for a state
  v3 styles nowhere — no spec covered it, no golden showed it, and no
  sheet could turn it off.  Deleted; `{ hovered: true }` is what an app
  writes now.  It is v4's own condition with no v3 spelling, which is the
  honest form of "v3 has no rule for this".

  **The press affordance is one property.**  v3's `:active` block is
  three declarations, and two of them (`overlay-color: black`,
  `overlay-padding: 10`) are already v4's constant defaults — so only
  `overlay-opacity` moves, as `{ case: [{ when: { active: true }, then:
  0.25 }], else: 0 }`.  That is not brevity for its own sake: it makes
  `overlay-opacity: 0` the way to turn the highlight off, and any other
  `overlay-*` value a restyle rather than a loss.

  **A state condition is not tied to a property**, and a spec says so
  rather than a comment: `{ when: { active: true } }` on `width` changes
  the node's `boundingBox()`, so the cull extent and the pick follow.
  That is the property the shader version could never have had — the
  press could only ever change the one thing the shader chose to draw.

  **The cost, which was the reason to hesitate.**  A default sheet made
  of `case` mappers means every graph pays per-element mapper evaluation
  at load for an affordance almost none of its elements are using:
  measured **~6%** of a 150k-element init (704 ms vs 664 ms against an
  all-constant sheet).  The fix is that such a group is not per-element
  at all.  A def whose mappers read **only** state flags has one computed
  record per distinct combination of the bits it reads — *two* for the
  default sheet at rest — so `applyPartitioned` masks the flags word,
  hits a `Map`, and does the same `write()` the constant path does.
  Re-measured: **675 / 704 / 691 ms against 674 / 680 / 678** — the
  default sheet is now indistinguishable from an all-constant one.
  One data mapper in the group turns the fast path off, because the group
  is on the per-element path anyway and there is nothing left to win.

  Two controls, and both landed where they should: with the partition
  disabled, **only** the three partition specs fail and the other twelve
  pass, which is the claim (an optimisation must be invisible); with the
  partition ignoring the flags word, twelve of fifteen fail, which says
  the specs are actually exercising it.

  **The restyle hook moved to the flag choke point**, which is the
  structural half.  57.1a had written it by hand in `_setSelected`, and
  this round wanted it at six more sites (lock, grab, activate, selectify,
  grabify, hover).  `setFlag` and `flagRefs` notify `store.onStateChange`
  instead, gated twice so an unstyled state costs one `&`: the styleable
  mask rejects the structural and internal bits, and a watched-key set
  registered by the StyleEngine rejects a state no condition mentions.
  That set is deliberately *not* `watchDataKeys` — that one answers
  "which data writes feed the GPU eval kernel" and excludes conditionals
  on principle, while a state condition is always a conditional.

  **The parity scene that could not have existed before.**
  `parity-selection-named` styles a fill on both sides, so in v3 the user
  block beats the default `:selected` and a selected node looks like an
  unselected one — and v4 now does the same, at **0 differing pixels**.
  Its control is the round itself: spreading the default block *after*
  the user's rather than before it (v4's pre-57.1d behaviour) takes the
  scene to **12.333%** against a 0.1% bound.  The scene it partners,
  `parity-selection`, still reads 0 px on the defaults.

  **Two goldens were measuring nothing and said so by passing.**
  `selection-accent` and `polygon-shapes` both declared
  `background-color`, so under the new rule their selected nodes and
  their unselected twins painted identically — a selection golden with no
  selection in it.  The first lost its fill declaration; the second lost
  a `selected: true` left over from the accent-ring era, since it is
  about polygon SDFs.  A new golden, `selection-overridden`, covers the
  override case in three rows (default rule / a flat colour / the app's
  own `{ selected: true }` case), and discriminates because the three
  rows must not look alike.

  **A finding that has nothing to do with this round.**  Regenerating
  turned up **six goldens whose committed PNG does not match what HEAD's
  own code renders** — `label-boxes` by 1.597%, `label-align` by 0.811%,
  and four more between 0.25% and 0.46%.  Confirmed by regenerating at a
  clean HEAD, so it is drift that was already there.  Each of the six
  carries a loosened per-golden `maxDiffRatio` (0.02 for `label-boxes`),
  which is exactly wide enough to hide it: **a golden with a generous
  bound stops answering even "did this change?"**.  The regenerated PNGs
  are committed here because they are the accurate ones; 57.1e is the
  fix.
- [x] **57.1e The goldens are exact** (2026-08-07) — the answer to
  57.1d's finding, and the answer is not a smaller tolerance.  It is
  **no tolerance**: `compareToGolden` defaults to zero differing pixels,
  and the eleven per-golden exemptions are gone.

  The case for it is the measurement, not a principle.  The default was
  0.5% and eleven label scenes carried 2% on top, and under that
  arrangement six goldens' committed pixels had drifted from what the
  code drew — `label-boxes` by **1.597%**, `label-align` by 0.811%, and
  `edge-labels`, `label-visuals`, `labels-open-sans` and
  `curved-edge-labels` between 0.25% and 0.46%.  Note that four of the
  six were under the *default* bound too, so dropping the exemptions
  alone would have fixed two.
  **The drift was real code**, which is what settles it: `label-boxes`
  had not been regenerated since round 13 B6 on 2026-07-31, while
  `label-layer`, `glyph-atlas`, `glyph-buffer`, `label-layout`,
  `label-pipeline` and `shaders.mts` all changed underneath it.  A week
  of green runs over a golden that no longer described the code.

  Exact is affordable because every input is pinned, and each was
  checked rather than assumed: SwiftShader (the visual project pins it),
  the browser (Playwright's version), and the font — vendored through
  `@fontsource/open-sans` in `node_modules`, so it is the same file
  everywhere rather than a system face.  Measured across all 45 goldens,
  four full runs at two worker counts: **zero differing pixels**, at
  pixelmatch threshold 0.  Then the whole `visual` project at the new
  default: 113 passed.

  The one variance source a web font cannot pin is the *platform* —
  Chrome rasters the atlas through CoreText on macOS and FreeType on
  Linux — and this is where the old bound came from.  It is now handled
  by saying where the goldens live rather than by widening them: they are
  generated on Linux and gated on Linux, which is where CI runs the
  `visual` job.  A maintainer on macOS will see the label scenes differ,
  and that is the platform showing; the documented answer is to read the
  diff, not to regenerate on the wrong platform and not to widen the
  bound.  Per-platform goldens stay the reserve escape hatch.

  **The control is the point of the round, so it was run.**  Widening the
  text-border band by 15% — a change to one multiply in the label
  fragment shader — moves `label-boxes` by **12 px, 0.010%**.  The old
  bound was 2% *and* a per-pixel colour threshold of 0.25, so it would
  have swallowed that two hundred times over; the exact bound fails on
  it.  Twelve pixels is the scale of thing a golden ought to notice, and
  is roughly a fortieth of the drift that had already accumulated
  unnoticed.

  So a browser or driver bump that legitimately moves antialiasing will
  now fail the suite.  That is the intended behaviour and the whole
  point: it is a change to the rendered output, which is the only thing
  a golden is for.  `AGENTS.md` and `src/README.md` both say so at the
  point where someone reaching for a wider bound would read them.
- [x] **57.1f One vocabulary for querying and for styling** (2026-08-08)
  — 57.1d gave the stylesheet nine states and left the *query* API with
  three, so `cy.nodes( { locked: true } )` threw on a state you could
  style on.  A hole the round opened, and the fix is not to add six more
  entries to a second list: `matcher.mts` compiles queries from the same
  `STATE_CONDITIONS` table `style-scales.mts` compiles conditions from,
  so the two cannot drift.

  `Query` gains `selectable`, `locked`, `grabbed`, `grabbable`, `active`,
  `hovered`, `childless` and `orphan`.  The last two are the structural
  negations under their v3 names, and they behave as negations because
  the table says so — `{ orphan: true }` and `{ child: false }` compile
  to the same `(mask, want)` pair, which a spec asserts by comparing the
  two result sets rather than by trusting the compiler.

  Two smaller things fall out of the table being the source.  The
  unknown-key error now lists the whole vocabulary rather than a
  hand-written five — with no selector language behind it, that message
  *is* the discoverability surface.  And the nodes-only guard names the
  key the caller actually used (`'orphan'`, not `'parent'/'child'`),
  because it knows which spellings were structural.

  The spec walks the table rather than sampling it: every state, in both
  directions, as a query key and as a `when` condition.  Control: putting
  the query vocabulary back to its old three fails all five specs in that
  suite.
- [x] **57.7 Closing docs sweep** (2026-08-07, re-run 2026-08-08) — both
  documents end to end plus `AGENTS.md`, and the `EXECUTIVE_SUMMARY.md`
  rewrite the standing rule requires when a round closes.

  **It was run twice, and the second run is the one worth reading about.**
  The first closed the round as it stood; then 57.1d–f reversed two of
  the round's own design calls, which meant the sweep had to correct not
  just the summaries but the *plan section above* — a design call that a
  later pass reverses reads exactly like one that still holds.  Both are
  annotated in place now rather than left to be discovered by someone
  building on them, which is this file's own standing warning about its
  stale parts, applied to itself within a day of being written.
  What the second sweep found, in the order a reader would hit it: the
  round-57 header paragraph still described the deviation as the useful
  finding; the "v3 → v4 parity gap analysis" said v4's colour "always
  wins"; the *design direction* section said `:selected` restyling was
  gone; and the perf section said the default sheet never restyles.

  **And `MIGRATING.md`, which ships**, told a porting app that
  `:parent:selected` was "not ported" and that the selection affordance
  was a shader-drawn accent ring — both false, and both in a table
  someone reads *while* porting.  That guide now carries a "Styling
  element state" section with the whole vocabulary, six new
  selector-recipe rows, and the list of v3 state selectors that have no
  v4 form.  `CHANGELOG.md` gained the feature it had no line for.

  The general lesson is the one this file already states about itself and
  had not applied to its own plan sections: **a claim written when it was
  true reads exactly like one that still is.**  A round that reverses its
  own design calls has to go back and mark them, or the next reader
  builds on the version that lost.  The three named drift
  sites were checked: "Suggested sequencing" gains the round-57
  paragraph; the "Needs a call" ledger needed nothing (this round closes
  no design call and opens none — the two ideas it logged are directions,
  items 25 and 26); "Gaps with direction already set" likewise.  The
  "what remains" amendment that added round 57 to the unbuilt list is
  struck with what closed it, which is the entry this file has most often
  left standing.

- [x] **57.8 The press reaches edges** (2026-08-08) — raised by the
  maintainer after 57.1c shipped: pressing an edge activated nothing,
  and the deviation entry recording that ("`:active` reaches nodes
  only") framed it as the CPU pick's reach.  The maintainer's framing is
  the better one: **an edge not being draggable does not make it
  unclickable, and the wash is the signifier of the click in progress**
  — in v3 a press on an edge activates it at mousedown and only falls
  through to a pan once the drag actually starts.

  The reversal is the one 57.1's deviation note already named: the press
  path waits for the async GPU pick.  A press the synchronous node pick
  misses now resolves through `Renderer.pick()` (~a frame; a microtask
  when the cursor sits in the cached pick tile), and the answer decides
  the affordance — an edge carries `FLAG_ACTIVE` and becomes the
  release's tap target (`lastPick`, which a touch press otherwise never
  populates, so touch edge taps gain a target too), while a true
  background press shows the active-bg circle.  The circle *waits* for
  that answer rather than showing at pointerdown, because v3 shows it
  only when nothing is near — the alternative was a one-frame circle
  flash over every edge press.  When the press pans, the two affordances
  swap: v3's mousemove unactivates a *pannable* pressed element
  (`down.pannable() && down.active()`) and anchors the circle at the
  pressed point, and `panStarted` does the same at the tap-threshold
  flip — non-pannable elements keep the flag through the press, as in
  v3.  Three staleness guards, because the answer can outlive the press:
  a press that ended (release, or a touch gesture morphing into
  pinch/cxt, both of which null `this.down`) discards the resolution
  outright.

  Two renderer specs, each with a control run that failed before the fix
  half it names: the press/wash/swap spec (fails with activation
  removed, and again with `panStarted` neutered), and a
  released-before-the-pick spec pinning that a late resolution sets
  nothing (fails with the `this.down !== down` guard removed — the wash
  sticks with no release left to clear it).  Three circle specs moved
  from one-shot reads to `expect.poll`, since the circle is now a pick
  answer late rather than a pointerdown side effect.  What still
  deviates, recorded in the narrowed deviation entry: latency (a
  press-and-release faster than the pick never shows the wash), and
  `tapstart` still targets the core rather than the edge, being emitted
  synchronously at press time.

- [x] **57.9 v3's hit halos** (2026-08-08) — the maintainer's follow-up
  to 57.8: "the edges are too hard to click — are we applying the hit
  thresholds?"  We were not, anywhere: v4 picked exactly the painted
  stroke, so a default 3px edge was a ~3px target, while v3's
  `findNearestElement` counts an edge hit within `width/2 +
  edgeThreshold` of the centerline — 8 rendered px for a mouse, **24
  for touch** (the desktop/touch pair the maintainer pointed at) — and
  inflates node sizes by its 2/8 `nodeThreshold` before every shape
  check.

  The halo rides the pick *frames*.  `Frame` grew its first field since
  round 56 (`pickPadPx`, device px — the struct rounds to 80 bytes, so
  the CPU arrays go to 20 floats): the straight and curved edge pick
  quads extrude wider by it, both pick fragment tests accept
  `halfWidth + pickPadPx`, and both edge cull margins grow by it —
  zero in scene/export frames, so drawing is arithmetically untouched,
  which the exact-golden `visual` project (119 green, zero differing
  pixels) pins rather than asserts.  The CPU node pick takes an
  optional `padPx` (absent means exact, keeping every frame literal in
  specs and benchmarks honest) and inflates before the LOD/radius
  derivations, as v3 pads `outerWidth` before everything downstream;
  the label-box test grows by the same halo (v3's `labelThreshold`
  shares the value).  The pick-tile cache remembers the halo it was
  drawn with — a tile rendered for one pad answers nothing about
  another, so a touch press after a mouse hover re-picks rather than
  reading the narrower tile.

  The pointer layer passes the pads per pointer type (`padsOf(e)`)
  everywhere it picks: press, hover, cxt, touch-cxt and drag-hover.
  **`cy.pick` stays exact deliberately** — the halo belongs to the
  gesture, not the API — and the new spec asserts both halves at one
  point: 8px off a 4px stroke, `cy.pick` answers null while a press
  there activates the edge; 14px off (past 2 + 8) is a background
  press.  A curved-edge twin covers the curved stream's separate pick
  pipeline via `midpoint()`.  Controls: the halo removed from the
  straight pick FS, from the curved pick FS, and a nonzero default pad
  on `cy.pick` — each failed exactly the spec written for it.  Node
  halos are pinned in `test/cpu-pick.mjs`, including that a circle's
  halo scales the shape rather than boxing it (the padded corner
  diagonal still misses), which is v3's own approximation replicated.

  Not padded, recorded: the pick quads do not extend *longitudinally*,
  so a press just past an edge's trimmed tip still misses — that end
  zone is the arrowhead's, and arrowheads are an existing unpickable
  deviation; both belong to whatever round makes arrows pickable.
  ***That round is 57.10, the next entry — the maintainer asked for it
  the same day.***

- [x] **57.10 Arrowheads are hit targets** (2026-08-08) — the maintainer
  asked for the piece 57.9 parked, with three directions: hollow
  hit-tests as filled, triangle approximations are acceptable for the
  arrow-like shapes, and performance decides.  The implementation takes
  the *exact* shapes anyway, because that was the cheapest option on
  this architecture: `fsArrow` already evaluates a true signed distance
  per head (the generated `ARROW_POLY` polygon SDFs + the circle), so
  the pick fragment shader reuses the same switch and tests
  `sd <= frame.pickPadPx` — no new shape code, pick-matches-drawn by
  construction, and the cost is a handful of SDF evaluations in a
  64×64 tile.  An approximation would have been *more* code for less
  agreement.  Hollow-as-filled is v3's own semantics
  (`findNearestElement` runs `shape.collide` against the filled point
  table for all four ends, mid arrows included) and falls out of using
  `sd` rather than the scene's stroke coverage.

  Structure: each arrow pipeline (straight + curved) gains pick twins
  (same vertex shaders, id-writing fragment, r32uint target, no depth —
  the pick pass has no depth attachment); the four arrow quads grow by
  `pickPadPx` exactly as the edge quads did in 57.9; the pick pass
  draws heads after lines with the *same* pick id, so order cannot
  matter — heads add coverage, which since round 56's trim is exactly
  the zone the line vacated.  The curved stream's pick FS drops
  no-arrow ends by alpha (that stream rasterizes a transparent quad
  where the straight VS collapses).  Gating rides `arrowEnds` /
  `midArrowCount`, so an arrowless sheet pays nothing.

  Three renderer specs: a hollow triangle's unpainted interior picks
  and presses as its edge while a point past the head + halo stays
  background (the probe's pixel is asserted white first — the hit is
  the head's *area*, not its ink); a mid arrow picks through an exact
  `cy.pick` at a point the line cannot answer, with its mirror point in
  front of the tip answering null; a curved-end head picks via
  `targetEndpoint()`.  Controls: the four pick draws removed failed all
  three; the pick FS switched to outline-only (`abs(sd)`) failed
  exactly the hollow spec, which is the user-visible requirement.  The
  `visual` project stayed at zero differing pixels — the scene
  arithmetic is untouched at pad 0.

  What remains unpicked, deliberately: labels (edge and node — the
  round-16 deviation), ghosts and outlines, each recorded where they
  live.  Arrows also stay out of `boundingBox()` — 57.10 changes
  picking only.

- [x] **57.11 The default style carries the show** (2026-08-08) — the
  maintainer restated v3's style philosophy as two rules and asked the
  debug page to follow them.  Rule one: the default style is minimal
  and carries the affordances — grey nodes and edges, blue on
  selection, the active-overlay press wash.  That has been v4's default
  sheet since 57.1, verified live this round (`#999`, `#0169D9`,
  overlay 0.25) — the work was everything sitting *on top* of it.
  Rule two: a custom sheet must not bury those affordances.

  What changed, all in `debug/`:

  - **The 'plain' style kind is now 'default', and it is an empty
    sheet.**  The old hand-written "plain" sheet (small blue discs) was
    itself a style, so it demonstrated neither the defaults nor the
    renderer alone.  The dropdown says "Default (v4's default
    stylesheet)"; the legacy `?style=plain` URL still resolves.
  - **The four v3 demo ports are v3-minimal.**  v3's own demo sheets
    style *nothing but the demoed feature* — node-types is `shape:
    data(type)` + a label + a 40px body; edge-types is the curve
    families and `width: 3` (10 for straight-triangle, v3's own value);
    edge-arrows is the head mappers on a 16px body; labels styles only
    label channels.  The v4 ports had grown blue-grey house colours,
    borders and fonts on all four; those are gone, so every demo now
    shows default grey with working selection blue.
  - **Every production sheet re-states selection.**  Selection blue is
    a default-sheet conditional, so a sheet naming a colour channel
    replaces it — v3's own precedence.  Constant colours wrap in
    `selectable()` (a `{ selected }` case over the constant); case
    mappers prepend the selected clause via `withSelected()`; and
    scale-mapped colours — where a `then` cannot nest a mapper — route
    selection through another channel: EnrichmentMap fills its reserved
    12px border (the web app's own affordance), NDEx-large brightens
    its border, and the 465k-edge scene gives its diverging-coloured
    edges a blue selected underlay.
  - **edge-types lays out in two columns** like edge-arrows, band
    height stretched by the tallest taxi drop so cells cannot collide.

  Two specs enforce the rules in `test/modules/debug-harness.mjs`: the
  'default' kind must be `{}` for every network (both spellings), and —
  behavioural, not structural — selecting a node and an edge under
  every production sheet must change the computed style.  Controls: a
  buried edge (constant line colour *and* constant opacity) failed
  em-web; a constant `background-color` added to node-types failed it;
  a non-empty default sheet failed the first spec.  A control that
  buried only the line *colour* did not fail — the opacity conditional
  still signalled, which is the rule holding, not the spec missing.
  The page itself was driven (six screenshots, including a
  box-selection over each half of the rework) per the standing
  "something has to open the page" rule.
