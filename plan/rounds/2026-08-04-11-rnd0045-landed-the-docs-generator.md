## The docs generator

Round 26's deliberately deferred half, now due: the release docs are
*generated* from the JSDoc the gates have kept complete.  Nineteen rounds
of gating paid for itself here — the generator needed no content written,
because `@param`, `@returns` and `@throws` have been complete and gated
since rounds 32, 36/37.1 and 31.2.  Reading is **362 documented members
over 48 sections in 7 namespaces**, `npm run docs:api`.

- [x] **45.1 The generator** (2026-08-04) — `scripts/docs-generate.mjs`,
  emitting docmaker's shape (`{ name, descr, formats: [ { descr, args:
  [ { name, descr } ] } ] }`) grouped into the `// -- section --`
  banners, with `pureAliases` carrying v4's 84 `declare x: this['y']`
  aliases the way v3's docmaker carries its own.
  It **extends the existing scanner rather than adding a second one**:
  `auditFile` now returns each member's doc block and banner beside its
  name, so generator and audits cannot disagree about what a member is.
  This repo has had five plan figures come from throwaway scans; a
  generator with its own regexes would have been the sixth.
  Three shape calls, each recorded in the file:
  - **`descr` is the first paragraph, `formats[i].descr` the whole
    block.**  docmaker's `descr` is a summary sentence and round 26's
    convention puts one first; an overload's full contract then rides
    its own format rather than being flattened into its sibling's.
  - **`@returns`/`@throws`/`@see` are emitted as their own fields**, not
    folded into the description as this plan said they would "ride" it.
    docmaker has no field for them, but folding is lossy in a way a
    template cannot undo, and a template ignores a field it does not know.
  - **What is published is derived, not listed.**  An exported function
    is documented iff `src/index.mts` hangs it on the factory — which is
    what separates `serializeElements` from the type predicates beside
    it in the same file — read from the assignment lines, so a fourth
    static cannot be silently undocumented.
  Deliberately absent: prose sections (hand-written, round 46) and any
  `md` field (in v3 that names a markdown file holding a member's long
  prose; in v4 the long prose *is* the doc comment, which is round 26's
  whole point).
- [x] **45.2 The gate** (2026-08-04) — `test/docs-generate.mjs`, 9 specs,
  checking the model against **`dist/cytoscape.d.ts`**.  The choice of
  witness is the point: generator and audit read the same files with the
  same scanner, so checking one against the other proves only that a
  regex is self-consistent.  The declaration is a different artifact,
  produced by a different tool from the same source, and it is what a
  consumer holds.  Both directions fail — a **phantom** entry sends a
  reader to a method that does not ship, and a **dropped** entry
  reintroduces silently exactly what round 26's coverage gate exists to
  prevent.

  Note this runs the *opposite* way to the `test:types:docs`
  precedent the plan cites: that one is **v3's**
  (`v3/test/types-docmaker-surface.mjs`), where the docs are hand-written
  and the types are the source of truth; here the docs are generated and
  the shipped types are the independent check.
  The stranded-block precondition is scoped rather than global: round 36
  left that audit reporting-only because it cannot tell a deliberately
  free-standing module note from a displaced block, and the one standing
  hit is exactly such a note — but **inside a published file the
  ambiguity is gone**, since a displaced block there would now ship
  twice, under the wrong name both times.

  Gated at zero there, still
  report-only everywhere else.
  Controls, four, each failing exactly one spec: a documented source
  member the declaration lacks; a shipped member the model drops; a
  banner placed so it strands a doc block; and a member emitted twice.
- [x] **45.3 The parser's fixtures** (2026-08-04) —
  `test/modules/docs-generate.mjs`, 11 specs on the precedent that a
  tool's parser gets a fixture rather than trust.  They pin paragraph
  unwrapping (doc comments are hard-wrapped; a reader of the reference
  must not see the column limit), the em-dash `@param` split (an
  argument description routinely contains dashes and colons of its own),
  tag continuation lines, and the banner normalization.  Written in the
  shape the sources actually use — round 36.1's fixtures were one-liners
  the scanner never matched, and two specs passed with the behaviour
  under test deliberately broken.  Three controls, each failing its own
  spec.

**What the round found, which is more than it built.**

- **`src/event.mts` was outside the audit's public tier** while `Event`
  is a named type export and the object handed to every handler a
  consumer writes.  Found because the generator could not place a
  namespace the tier did not enumerate.  This is the **fourth** instance
  of one failure: round 32 walked class bodies only, round 36 missed
  exported functions, round 37.3 missed `export default function`, and
  this one missed a *file*.  Widened; coverage stayed 100%/100% because
  the file was already fully documented in the internal tier.
- **Optional members were invisible to every audit.**  `MEMBER_RE` did
  not allow `?` between a member's name and its colon, so
  `target?: EventTarget` — and five siblings on `Event` alone — had
  never been counted by coverage, `@param`, `@returns` or `@throws`.
  Fixed; the public tier went 421 → 427, still 100%, so nothing was
  undocumented behind the gap.  It is the same lesson a fifth time, and
  worth stating in its general form: **every widening of this audit so
  far has found the surface already documented and the *count* wrong**,
  which is precisely why the count cannot be the thing you trust.
- **The layout-extension contract shipped no types at all.**  Round 17
  made `cy.layout({ impl })` the whole extension story and round 34.6
  noticed in passing that `LayoutContext` "is not in the shipped
  declarations at all — it appears only inside a doc comment", but the
  consequence was never drawn: `CustomLayoutOptions` shipped while the
  two types an external author actually writes against did not, so
  `run( ctx )` typed `ctx` as `any` in the one surface the contract
  exists to make obvious.

  `LayoutContext`, `LayoutImpl` and
  `CustomLayout` are now exported — **a public-surface addition, made
  deliberately and flagged here rather than buried**, on the precedent of
  round 41.6 exporting the event types for the identical reason.  The
  type-surface audit caught it as an unexpected export, which is that
  audit doing its job; 42 → 45 type exports, 1148 → 1164 doc blocks.
- **The banners needed completing, which round 26 said would be this
  round's job** ("a generator reads the existing banners for placement,
  so this round's job is to make the banners complete and consistent").
  `Animation`, `LayoutContext`, `CustomLayout` and `Event` had none or
  nearly none, so their whole surfaces would have rendered as one
  undifferentiated section; `Core` and `Collection` each had two members
  above their first banner.  Eleven banners added, all comment-only, and
  one renamed — `graph algorithms (slot-native implementations in
  ./algorithms/)` reads as a code comment in a heading, so the
  implementation note moved to its own line above it.

  **The hazard here is this codebase's most repeated defect**, and it
  bit once during the work: a banner placed between a doc block and its
  member *strands* the block.  Every banner is above its group's doc
  block, and the gate's precondition is what proves it — one control
  does exactly this and fails.

**Risks tracked**: the generator reads the *committed* `dist/cytoscape.d.ts`,
so the gate also quietly enforces "you regenerated the declaration when you
changed the surface" — a feature, but it means a source change that widens
the surface fails this gate until `build:types` is re-run, and the failure
names the member rather than the cause.  The section titles are the source's
banners, which were written as code-navigation aids and read like it in a
few places; making them reader-facing is editorial and belongs to round 46,
along with everything else about how this model is rendered.
