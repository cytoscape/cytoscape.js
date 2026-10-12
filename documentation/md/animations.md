# Animations

v4 animations start immediately and have no queue. Animations on disjoint
channels can run together. When a new animation overlaps a running animation's
channels, the older one stops in place, its values freeze, and the new tween
captures from those values. To sequence work, wait for a handle's promise and
then create or play the next handle.

```js
const node = cy.getElementById('a');

const move = node.animation(
  { position: { x: 180, y: 60 } },
  { duration: 300, easing: 'ease-in-out' },
);

await move.play();
await node.animation(
  { style: { 'background-color': '#d73027' } },
  { duration: 180 },
).play();
```

`animate()` is the chaining form and returns the core/collection. `animation()`
builds a handle without starting it. Handles expose `play()`, `stop()`,
`promise()`, `playing()`, `pause()`, `resume()`, `reverse()` and read-only
`progress()`. `promise()` resolves when the animation completes or is stopped;
it is not a boolean completion-state query. Progress cannot be assigned or
scrubbed.

Collection animations target model-space `position`, the supported style
channels and compound collapse state. Core animations target viewport state
such as zoom and pan. Today the animatable style channels are opacity, selected
node fills/borders, edge line color, node width/height, edge width, compound
padding and font size, alongside position. Consult the API reference for the
exact target shape and which channels apply to nodes, edges, parents or core.

Easing is declarative: use the documented named forms, a CSS `cubic-bezier(… )`
or `linear(… )`, or a `spring( bounce )` specification. Easing callback
functions are rejected so animation curves do not depend on whether a run is
offloaded to a GPU. Colors interpolate in OKLab, which differs from v3's
channel-wise sRGB interpolation.

`delay(duration)` is a no-op timed tween that composes with other channels;
`delayAnimation(duration)` returns a handle for promise sequencing. These
methods belong to collections. The v3 viewport members `cy.delay()` and
`cy.delayAnimation()` have no current v4 entry and remain explicit audit
questions; do not infer viewport equivalents from collection delay methods.
`clearQueue()` has no v4 counterpart because there is no queue. Use
`stop()`/handle methods to stop work that is actually running.

Stylesheet transitions use `transition-property`, `transition-duration`,
`transition-delay` and `transition-timing-function`. Their transitionable set
matches the documented animated channels. A sheet update supplies the new
target style and animates the listed properties; the same channel concurrency
rules apply. See [styling](style.md) for how declarative styles are resolved.
