/*
Pointer cursors (round 89): the canvas says what a gesture will do.

v3 set no CSS cursor at all — the affordance was userland's, and the
standard recipe was a `mouseover`/`mouseout` pair writing
`container.style.cursor`.  v4's canvas fills its container, so an inline
*canvas* cursor overrides exactly that recipe; the defaults below are
shaped around keeping it working:

- **idle over background is `''`** (inherit), deliberately not `default`
  — a v4 instance with nothing to say leaves the app's own container
  cursor in force, so a ported v3 app is unchanged where v4 is silent;
- **touch never yields a cursor keyword**: there is nothing to show, and
  a keyword written for a finger would stick after it lifts;
- **`pointerCursors: false` yields `''` for every cell**, which is what
  makes the option the spec suite's own control — with the feature off,
  every positive assertion must invert.

This module is pure: it maps state to a cursor keyword and writes
nothing.  `PointerHandler` owns the single DOM writer, applying this at
the transitions it already tracks.
*/
import type { CursorMap, CursorState } from '../public-types.mjs';

/**
 * The default cursor per state (round 89.1).  A press wins over hover —
 * the gesture is decided at pointerdown and the affordance is immediate
 * — and `grab`/`grabbing` are the standard pair around a drag.
 */
export const DEFAULT_CURSORS: CursorMap = {
  idle: '',
  hoverElement: 'pointer',
  hoverNode: 'grab',
  pan: 'grabbing',
  grab: 'grabbing',
  box: 'crosshair',
};

/** The map key a state resolves to; a press outranks whatever it is over. */
const keyFor = (state: CursorState): keyof CursorMap => {
  if (state.gesture !== 'idle') {
    return state.gesture;
  }

  if (state.hover === 'draggable-node') {
    return 'hoverNode';
  }

  return state.hover === 'element' ? 'hoverElement' : 'idle';
};

/**
 * The CSS cursor for a gesture/hover state, under an instance's
 * `pointerCursors` setting.
 *
 * Pure — no DOM, no side effects — which is the whole reason the map is
 * its own module: every cell of gesture × hover × pointer type is
 * assertable from Node, where there is no canvas to write to.
 *
 * @param state — what the pointer is doing and what it is over
 * @param cursors — the instance setting: `true` for the defaults,
 *   `false` to yield `''` everywhere, or a partial map overriding
 *   individual entries (an explicit `''` hands that state back to the
 *   app, and an omitted key falls back to {@link DEFAULT_CURSORS})
 * @returns a CSS cursor keyword, or `''` meaning inherit — never
 *   anything else, and always `''` for a touch pointer
 */
export const cursorFor = (
  state: CursorState,
  cursors: boolean | Partial<CursorMap> = true,
): string => {
  if (cursors === false) {
    return '';
  }

  // a finger has no cursor: writing one here would outlive the touch
  if (state.pointerType === 'touch') {
    return '';
  }

  const key = keyFor(state);

  if (cursors === true) {
    return DEFAULT_CURSORS[key];
  }

  return cursors[key] ?? DEFAULT_CURSORS[key];
};
