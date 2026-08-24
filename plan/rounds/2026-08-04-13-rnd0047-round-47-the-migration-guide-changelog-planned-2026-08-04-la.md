## Round 47 — the migration guide + CHANGELOG (planned 2026-08-04; landed 2026-08-04)

The guide is the payoff for a discipline this file has kept for forty
rounds: the decided-design ledger, the deviations lists and the recorded
"why" behind each removal were written down *as they were decided*, so
this round is compilation rather than archaeology.

- [x] **47.1 `MIGRATING.md`** (2026-08-04) — the v3 → v4 porting
  reference: the five changes that touch every app (selector strings,
  classes, the sheet shape, the animation queue, terminally-dead
  elements), a **selector recipe table** with a v4 line per v3 form, the
  style-property diff, the event vocabulary with its silent-failure
  hazard, a "behaviour to re-check" table for the things that compile and
  then differ, the constructor options, layouts and extensions, and what
  is not ported.  It ships in the package (44.1's pack spec extended to
  require it): someone who has just installed v4 and found their
  selectors throwing should have it locally, not on a website.
- [x] **47.2 `CHANGELOG.md`** (2026-08-04) — Keep a Changelog shape,
  starting at the 4.0 line, with Added / Changed / Removed / Not yet
  implemented / Known deviations.  It points at `MIGRATING.md` for the
  detail rather than restating it.
- [x] **47.3 The guide checks itself** (2026-08-04) —
  `test/modules/migration-guide.mjs`, 8 specs.  This is documentation
  that makes claims about *runtime behaviour*, in prose, in a file no
  other test opens; round 31.1 is the cautionary case in the mirror
  image (the markdown was right and the runtime message was wrong).  So
  every property named in the table's left column must actually be
  rejected, every replacement offered must actually compile, the counts
  must add up, and the defaults the guide tells readers to re-check must
  still be what it says.

  Controls: naming a property v4 still accepts
  fails 1, a stale plural replacement fails 1, breaking the arithmetic
  fails 2, and renaming the section fails the whole file loudly.

**The property table was measured, not transcribed**, and that is the
round's method note.  The obvious way to write it is to read the ledger
and list what one remembers being dropped; instead both libraries were
asked.  v3's registry was enumerated from a live v3 instance (291
property names, properties plus aliases) and each was offered to v4's
sheet in all four groups, classifying on the *property-name* rejection
message specifically — which matters, because v4 says "unsupported" for
an invalid keyword too, and a first pass that matched the word alone
reported `shape`, `text-justification` and `source-arrow-fill` as
dropped.

Reading: **153 accepted** (7 only in the `core` group), **138 rejected**,
of which 96 are the numbered `pie-N-*`/`stripe-N-*` families that became
the round-23 `chart` family, leaving **42** real entries — the table.

Four of those 42 a from-memory guide would likely have missed, and all
four are the kind that cost an afternoon:

- **The singular list-property spellings are gone.**  v3's
  `control-point-distance`, `segment-distance`, `segment-weight` and
  `segment-radius` are aliases of its plural forms; v4 has only the
  plurals (`segment-radii` for the last), and no alias.
- **`display` is rejected**, not renamed: the structural tier is
  `show()`/`hide()` and the paint tier is the `visibility` property, so
  there is no property called `display` to port to.
- **`position` was a v3 style property** and is not one in v4.
- **`mid-source-arrow-fill`/`-width` and their target twins** are
  rejected where the non-mid versions are accepted — mid arrows are
  always filled at standard width, a scope note from round 13 C1 that
  reads as an inconsistency if you meet it without the reason.

*(A method note worth keeping for anyone probing v3 from a script: a
headless v3 instance leaves live timers behind — round 14.12 recorded
this for the compound benchmark — so a probe that enumerates its registry
must `process.exit()` or it hangs forever, printing nothing.  Two runs
were lost to that before it was recognised.)*
