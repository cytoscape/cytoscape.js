## Edge-label autorotate

The last item on the autonomous shelf, cleared while planning round 12:
`text-rotation: autorotate` for edge labels, one isolated commit.

- **API**: `text-rotation` is an edge style prop — keywords `none`
  (default, horizontal) | `autorotate`, constants or mappers (enum
  kind, so `case` conditionals work, matching the other label
  channels).  Numeric rotations throw (per-element numeric
  `text-rotation` stays in the label-parity needs-a-call batch), and
  the prop throws on the nodes group (node labels don't rotate in v4).
  Readback follows the stored-truth rule: the sidecar entry when
  labelled, else the sheet.
- **The flip-rule call** (the one that was open): **v3's verbatim** —
  the label angle is the edge's *undirected* slope, v3's
  `atan(dy/dx)` (`labels.mts:95`), so the baseline stays within
  (−90°, 90°] and text never reads upside-down; vertical edges read
  top-to-bottom at +90° either direction.  The WGSL implements the
  same rule with no trig: it sign-normalizes the endpoint delta
  (negated when it points left, or straight up at dx = 0) and uses
  the unit vector as the rotation frame (`autorotateFrame`).
- **Mechanism**: rotation happens in the vertex shader from the live
  endpoint positions, so autorotate inherits the edge-label
  zero-rebuild property — drags, layouts and position tweens re-angle
  the label on-GPU (spec-pinned: making a vertical edge horizontal
  re-uploads ≤ 64 B, one position row).  The model bakes only a flag:
  bit 31 of the glyph instance's owner word (element slots stay far
  below 2³¹; the dead sentinel is the full-ones word, so no
  collision).  The background quad carries the flag too — a text box
  rotates with its text — and the edge-glyph cull kernel tests the
  exact rotated-rect AABB in the same rotation frame as the VS, so
  cull and draw can't disagree.

  Node glyph paths are untouched, and
  the non-rotated edge path keeps its original arithmetic —
  pre-existing goldens pass unchanged.
- **Verification**: typecheck + lint clean; 1650 Node tests (5 new in
  `test/edge-labels.mjs`: entry + readback, defaults +
  sheet-resolution, throws for numbers/unknown keywords/nodes-group,
  case mappers, node-entries-never-rotate); 40/40 `webgpu` Playwright
  specs (new: a vertical-edge spec pinning the dark-pixel bounding box
  flipping from wide to tall under autorotate, plus the ≤ 64 B
  re-angle on an endpoint move); 13/13 `visual` (new
  `edge-label-autorotate` golden: a downhill run, a direction-flipped
  uphill run with its background box rotated along, and a vertical
  top-to-bottom run — all pre-existing goldens unchanged).
