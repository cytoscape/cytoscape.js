## Logged direction — edge labels (built in round 10 B5, exactly this shape)

Needed regardless (discussion, 2026-07-27).  A generalization, not new
architecture: a **second glyph stream** parallel to the node one (own
instance buffer + cull group + draw); edge glyphs anchor at the edge
midpoint computed in the VS from the two endpoint positions, so edge
labels follow drags/layouts/position tweens on-GPU with zero rebuild —
the node-label trick extended to labels whose *endpoints* move.  Cull
predicate mirrors the edge cull (edge SHOWN + both endpoints SHOWN);
the atlas is shared (keyed by char, so the 9.7 font work is
owner-agnostic); the model side group-keys the label sidecar,
label-dirty channel and StyleEngine label channels.

Pass-1 scope:
horizontal at the midpoint (v3's default); autorotate — cheap in the VS
via the endpoint delta, but with flip-when-upside-down readability
rules — is a separate follow-up call (since landed 2026-07-29).  Sequencing: after 9.7, so the
label goldens/WYSIWYG harness exists to verify it; the edge-label round
then just adds a golden scene.
