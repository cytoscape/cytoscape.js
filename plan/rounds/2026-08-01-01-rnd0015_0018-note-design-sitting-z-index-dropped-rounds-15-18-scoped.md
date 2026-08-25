## Design sitting — z-index dropped, rounds 15–18 scoped

Decided with the user in one sitting.  Every round below runs under
the round-10 process rules plus the round-14 amendments, now standing
policy: **docs land first** (each round's 0-item commits its plan
section + README pointer before any implementation) and every item is
**tests-first** (specs written and seen red before the implementation
brings them green, landing together as the item's isolated commit).

**The z-index call — dropped outright.**  v4 ships no `z-index`, no
`z-compound-depth`, no `z-index-compare`, and no built-in grab-raise
either.  Reasoning, recorded: element stacking is a document/UI
concept without a strong graph use case — node overlap is a layout
artifact rather than an authored arrangement, layered emphasis is
already served structurally (parents under edges under leaves under
labels; overlay/underlay props; opacity dimming), and v3 carried the
prop triple at the cost of a whole-scene comparator sort per frame.

The compound worry raised in the sitting (edges into child nodes must
stay visible) is already answered by the round-14 stream split:
parent *bodies* draw under all edges, leaves above them.
Consequences, now permanent (all were already recorded deviations):
draw order is structural + slot order within a stream; a grabbed node
does not pop above later-inserted nodes; parent decorations
(ghost/underlay/overlay/label bands) keep their post-edge positions.
`sortByZIndex`/`zDepth` close with the props.

The only logged future
extension, if real demand ever appears, is a single boolean
**elevated tier** (one extra batch per group drawn over the leaf
stream) — never arbitrary integer stacking; logged, not planned.

**Queue after the sitting**: background images (round 15) →
multiline labels + label bb (round 16) → event vocabulary + the
extension contract (round 17) → GPU force layout (round 18).
