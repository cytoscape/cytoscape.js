/*
Animation — the CPU-canonical tween layer.

An animation interpolates element style channels and/or position (or the
viewport) from their captured start values to explicit targets over a
duration, easing the normalized time.  Each tick writes the store columns
(scheduling a redraw through the dirty tracker), so animation works
headless and is fully Node-testable.

Every tween is a pure function of time, so the CPU stays the reference even
when the GPU evaluates it: `capture()` resolves the animation into a list
of per-slot `ChannelWrite`s that the CPU lerps directly and the GPU tween
runtime (render/gpu-tween.mts) consumes verbatim.  One set of numbers, two
executors.

Ownership: a GPU-driven animation leases its columns for the duration —
CPU reads go stale mid-flight and `settleGpu` re-derives the exact value on
the CPU when it ends (no readback).  Elements can't be grabbed while
animating (the core checks `animated()` before starting a drag), so an
interactive override can't fight the tween.

Animatable: `position`, `opacity` (both groups), `background-color`,
`border-color`, `line-color`, `border-width`, and — round 25 — node
`width`/`height` (two lanes of the size pair column; the store's lane
writer runs the per-tick cascade: outerHalf, label re-anchor, compound
auto-bounds), edge `width` (its style-write-baked derivatives — casing
and overlay/underlay strokes, match-line/percent arrow widths — ride
along), compound `padding` (parents only; the declared value in its
declared unit) and `font-size` (the label sidecar, patched per tick).
Colours interpolate in OKLab — the same space mappers ramp in by
default — so an animation to a colour and a mapper ramp to it take the
same path.  Geometry tweens never offload and are never stale: every
tick is a CPU column write, so `width()`/`bb()`/pick mid-tween read
the mid-flight value.

Style transitions (round 24) ride this layer as *preset* animations:
the style engine diffs stored truth around a restyle into per-column
ChannelWrites and `Animation.preset` wraps them — capture is a no-op,
and eligibility/columns derive from the writes.  Controls (round 24.3):
`pause`/`resume`/`reverse` freeze, continue (excluding the paused
span) and swap-the-ends in place, with read-only `progress`; a
GPU-driven animation settles its lease for a pause/reverse and
re-acquires on the next advance.

Easing curves live in easing.mts, which compiles a name (or
`cubic-bezier()`/`linear()`/`spring()`) into the one form both executors
evaluate.  A spring's `duration` is perceptual, so `durationMs` is the
requested duration times the easing's `durationScale`.
*/
// buildChannelWrite is @internal (stripInternal drops it from the d.ts), so
// its one importer reaches it in ./animation/channels.mjs directly
export { TWEEN_COL, STRIDE } from './animation/channels.mjs';
export type {
  RGBA,
  WriteKind,
  TweenColumn,
  ChannelWrite,
} from './animation/channels.mjs';
export { AnimationHandleImpl } from './animation/handle.mjs';
export type { Position, AnimationHandle } from './animation/handle.mjs';
export { Animation } from './animation/animation.mjs';
export type { AnimateOptions } from './animation/animation.mjs';
export { AnimationManager } from './animation/manager.mjs';
export type { GpuTweenSink } from './animation/manager.mjs';
