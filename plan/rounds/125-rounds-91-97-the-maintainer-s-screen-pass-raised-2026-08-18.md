## Rounds 91–97 — the maintainer's screen pass (raised 2026-08-18)

Seven defects from driving the debug harness, one round each.  Every
mechanism below was **verified before planning** — reproduced in a
served page against the built UMD bundle (the round-27.9 rule: probe
from a served page, never `about:blank`), with the v3-vs-v4 cases
diffed live on `playwright-page/parity.html`.  The repro scripts are
throwaway; what each round keeps is the pinned mechanism and the spec
that will hold it.  Performance trade-offs are named per round — most
of these sit on hot paths (the frame loop, the whole-graph fit scan,
the per-vertex curve evaluation, the glyph atlas, the pick path), so
each fix carries its measurement, not just its scene.

