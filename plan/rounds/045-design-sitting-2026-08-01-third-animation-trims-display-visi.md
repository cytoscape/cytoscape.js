## Design sitting (2026-08-01, third) — animation trims; display/visibility; charts

Three calls taken with the user (quick answers, follow-up expected on
the finer points), scoping rounds 21–23:

1. **v4 animations do not have to match v3, and the queue goes.**
   The per-element animation queue exists to sequence animations —
   which promises already do better (`await a.promise()`); it was
   valuable pre-promises, not now.  v4 drops queueing outright (there
   is no `queue: false` option because there is no queue), and the
   v3 `step` callback stays out (v4 never had it; `onRender` +
   promises cover progress observation).  The rest of the v3 surface
   (`pause`/`progress`/`reverse`/`apply`, style transitions) stays
   **logged open for follow-up** — not built, not dropped.
   Scoped as **round 21**.
2. **`display` and `visibility` both exist — the distinction is
   useful.**  Two tiers with different use cases: structural hiding
   (no space) vs paint-only invisibility (space kept).  The
   motivating cases: **bundled beziers** — structurally hiding a
   bundle member should re-fan its siblings, while making it
   invisible must keep every rank stable (no sibling jump) — and
   **compound nodes** — a display-hidden child leaves its parent's
   auto-bounds, an invisible child still sizes it.  Scoped as
   **round 22**.
3. **Pie/stripe backgrounds: yes — designed as a charts surface.**
   Ported not as v3's 101 numbered props but as a lean list-valued
   `chart` family designed to grow into other chart kinds later
   (the pie hole is a first instance: donuts fall out of the same
   surface).  Scoped as **round 23**.

Gap-list updates: item 9 (animation surface) partially resolved by
call 1 (queue/step decided; controls + transitions remain the open
follow-up — since scoped and landed as round 24, fourth sitting);
item 11 (display vs visibility) resolved by call 2;
item 3 (pie/stripe) resolved by call 3.
