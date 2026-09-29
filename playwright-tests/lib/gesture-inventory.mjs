/*
Round 136 (item 31, the inventory): every gesture v4 handles, the public
events it emits, the state it changes, and which specs hold it — the
table the scripted-trace tier (item 31's second half, before the WebGL
implementation) is built from.

Why a module rather than a document: the trace tier replays traces and
diffs end states, so it needs the gesture list, the end-state fields and
the traces as data it can import; and a coverage claim written as prose
rots silently.  `test/modules/gesture-inventory.mjs` holds this table to
the tree — every cited spec title exists verbatim in its file, every
cited source file exists, every gesture event name `src/interact/` emits
is named by some entry, and the coverage tallies are pinned — so a spec
renamed or deleted, or a new gesture event, turns it red.

What "covered" means here.  `browser` cites Playwright specs that drive
the gesture through the real `PointerHandler` in a real browser — with
trusted Playwright input (`input: 'real'`, `page.mouse` / `page.keyboard`)
or with `PointerEvent`s dispatched in the page (`'synthetic'`; every touch
spec, since `page.touchscreen` is never used).  `headless` cites Node
specs, which come in two kinds: `'driven'` — test/pointer-cursors.mjs's
stub-canvas harness, the only Node spec that runs the real handler, and
it asserts cursors only — and `'api'`, which reproduces a gesture's
consequence through the public API (`ele.emit('grab')`, `position()`,
`select()`) without any pointer at all.  A gesture whose only Node cover
is `'api'` has no headless *gesture* coverage.

Read from the sources and the specs on 2026-09-29, at round 134's head.
*/

/** The end-state fields a trace can diff numerically (routing.spec.js's method, not pixels). */
export const END_STATE = [
  'positions', // every node's model position
  'selection', // the selected ids
  'viewport', // pan and zoom
  'grabbed', // the grabbed ids (empty at rest)
  'events', // the ordered public events, type + target id
];

/**
 * The traces the tier replays: item 31's six, as v4 has them, plus the
 * three gestures whose end state the six do not reach.  Each names its
 * end-state fields and the input it needs.  Replayed against each
 * renderer on the same page, diffed numerically against each other and
 * against v3 where v3 has the gesture.
 */
export const TRACES = {
  drag: {
    input: 'real',
    endState: ['positions', 'grabbed', 'events'],
    what: 'press a node, move past the threshold in steps, release',
  },
  'box-select': {
    input: 'real',
    endState: ['selection', 'events'],
    what: 'shift-press the background, drag a band over part of the graph, release',
  },
  'wheel-zoom': {
    input: 'real',
    endState: ['viewport', 'events'],
    what: 'wheel ticks over a node and over the background, in each wheelBehavior',
  },
  pinch: {
    input: 'synthetic',
    endState: ['viewport', 'events'],
    what: 'two touch pointers 200 px or more apart, spread and translated',
  },
  'cxt-press': {
    input: 'real',
    endState: ['events'],
    what: 'right-button press and release on a node, then a right-drag across two',
  },
  'grab-and-throw': {
    input: 'real',
    endState: ['positions', 'viewport', 'events'],
    what:
      'a fast drag released mid-motion.  v4 has no throw or inertia (nothing in ' +
      'src/ carries momentum), so this trace pins the absence: nothing moves ' +
      'after the release, on either renderer',
  },
  'tap-select': {
    input: 'real',
    endState: ['selection', 'events'],
    what: 'tap a node, tap another, shift-tap a third, tap the background',
  },
  'drag-pan': {
    input: 'real',
    endState: ['viewport', 'positions', 'events'],
    what: 'press the background (and a locked node), drag, release',
  },
  'touch-tap-drag': {
    input: 'synthetic',
    endState: ['positions', 'selection', 'viewport', 'events'],
    what: 'one touch pointer: tap a node, drag a node, pan the background',
  },
};

/**
 * One row per gesture.
 *
 * - `input`: what the user does
 * - `gates`: the options and element states that decide whether it runs
 * - `events`: the public events, in emission order (bracketed = conditional)
 * - `state`: what it leaves changed
 * - `src`: the files the handler lives in
 * - `browser` / `headless`: `[file, title, kind]` — kind is `'real'` or
 *   `'synthetic'` input for the browser, `'driven'` or `'api'` for Node
 * - `gaps`: sub-cases no spec at either tier reaches
 * - `trace`: the TRACES entry that will replay it, or null with `noTrace`
 */
export const GESTURES = [
  {
    id: 'hover',
    input: 'pointermove with no button down (mouse or pen)',
    gates: ["the element's `events: 'no'` (pick-transparent)"],
    events: [
      'pointermove',
      '[mouseout, pointerout]',
      '[mouseover, pointerover]',
    ],
    state: ['the hovered flag', 'the cursor'],
    src: [
      'src/interact/pointer-handlers.mts',
      'src/interact/pointer-hover.mts',
    ],
    browser: [
      [
        'playwright-tests/renderer.spec.js',
        'pointer re-emits + the tap family (round 17.1)',
        'real',
      ],
      [
        'playwright-tests/renderer.spec.js',
        'mouseout fires when the hover leaves the node (the mouseover sibling)',
        'real',
      ],
      [
        'playwright-tests/renderer.spec.js',
        "events: 'no' elements are pointer-transparent but still render (round 20.2)",
        'real',
      ],
    ],
    headless: [],
    gaps: ['hover across an edge-over-node overlap', 'the 200 ms wheel settle'],
    trace: null,
    noTrace:
      'transient: the end state of a hover is the cursor, which round 89.3 already drives',
  },
  {
    id: 'pointer-leave',
    input: 'the pointer leaves the canvas',
    gates: [],
    events: ['mouseout', 'pointerout'],
    state: ['the hovered flag'],
    src: ['src/interact/pointer.mts'],
    browser: [],
    headless: [],
    gaps: ['all of it'],
    trace: null,
    noTrace: 'transient, no end state beyond the hover flag',
  },
  {
    id: 'tap-select',
    input:
      'press and release on a node or edge, moving less than the tap threshold',
    gates: [
      'autounselectify',
      'selectable / unselectify',
      'selectionType',
      'desktopTapThreshold / touchTapThreshold',
    ],
    events: [
      '[grabon, grab]',
      'pointerdown',
      'tapstart',
      'pointerup',
      'tapend',
      '[free, freeon]',
      'tap',
      '[unselect on the others]',
      'select',
      'tapselect',
      '[onetap, after the debounce]',
    ],
    state: ['selection'],
    src: [
      'src/interact/pointer-handlers.mts',
      'src/interact/pointer-press.mts',
    ],
    browser: [
      [
        'playwright-tests/renderer.spec.js',
        'tap selects and background tap clears',
        'real',
      ],
      [
        'playwright-tests/renderer.spec.js',
        'tapselect/tapunselect + hover-during-drag events (round 17.3)',
        'real',
      ],
      [
        'playwright-tests/renderer.spec.js',
        'a press inside a compound body selects the edge under it, not the parent',
        'real',
      ],
      [
        'playwright-tests/renderer.spec.js',
        "text-events: 'yes' makes the label box tap the node (round 20.3)",
        'real',
      ],
    ],
    headless: [
      [
        'test/selection.mjs',
        'emits select and unselect per state change only',
        'api',
      ],
    ],
    gaps: ['a tap under autounselectify or on an unselectable element'],
    trace: 'tap-select',
  },
  {
    id: 'tap-toggle',
    input: 'tap on a selected element (additive)',
    gates: ['selectionType', 'the multiple-select key'],
    events: ['tap', 'unselect', 'tapunselect'],
    state: ['selection'],
    src: ['src/interact/pointer-press.mts'],
    browser: [
      [
        'playwright-tests/renderer.spec.js',
        'tapselect/tapunselect + hover-during-drag events (round 17.3)',
        'real',
      ],
    ],
    headless: [],
    gaps: [],
    trace: 'tap-select',
  },
  {
    id: 'background-tap',
    input: 'press and release on the background',
    gates: ['selectionType', 'the multiple-select key'],
    events: [
      'pointerdown',
      'tapstart',
      'pointerup',
      'tapend',
      'tap (core)',
      '[dbltap]',
      '[unselect per selected element]',
    ],
    state: ['selection'],
    src: ['src/interact/pointer-press.mts'],
    browser: [
      [
        'playwright-tests/renderer.spec.js',
        'tap selects and background tap clears',
        'real',
      ],
      [
        'playwright-tests/renderer.spec.js',
        'pointer re-emits + the tap family (round 17.1)',
        'real',
      ],
      [
        'playwright-tests/renderer.spec.js',
        "visibility: 'hidden' blanks pixels but keeps space (round 22)",
        'real',
      ],
    ],
    headless: [],
    gaps: [],
    trace: 'tap-select',
  },
  {
    id: 'additive-tap',
    input: "shift / ctrl / meta tap, or any tap under selectionType 'additive'",
    gates: ['selectionType', 'the multiple-select key'],
    events: ['tap', 'select', 'tapselect'],
    state: ['selection (the others kept)'],
    src: ['src/interact/pointer-press.mts', 'src/interact/pointer.mts'],
    browser: [],
    headless: [],
    gaps: ['all of it: no spec holds that the others stay selected'],
    trace: 'tap-select',
  },
  {
    id: 'dbltap',
    input: 'a second tap on the same target within multiClickDebounceTime',
    gates: ['multiClickDebounceTime'],
    events: ['tap', 'dbltap', '[onetap for a lone tap, from a timer]'],
    state: [],
    src: ['src/interact/pointer-press.mts'],
    browser: [
      [
        'playwright-tests/renderer.spec.js',
        'gesture parity: cxttap family, dbltap, taphold (round 10)',
        'real',
      ],
    ],
    headless: [],
    gaps: [
      'onetap (subscribed, never asserted)',
      'background dbltap',
      'the debounce window',
    ],
    trace: 'tap-select',
  },
  {
    id: 'taphold',
    input: 'a press held without moving for tapholdDuration',
    gates: ['tapholdDuration'],
    events: ['taphold (no originalEvent: a timer fires it)'],
    state: [],
    src: ['src/interact/pointer-handlers.mts'],
    browser: [
      [
        'playwright-tests/renderer.spec.js',
        'gesture parity: cxttap family, dbltap, taphold (round 10)',
        'real',
      ],
      [
        'playwright-tests/renderer.spec.js',
        'interaction options: wheelSensitivity, desktopTapThreshold, tapholdDuration (round 20.1)',
        'real',
      ],
    ],
    headless: [
      [
        'test/interaction-options.mjs',
        'tapholdDuration is a validated getter/setter with a ctor option',
        'api',
      ],
    ],
    gaps: ['a taphold cancelled by movement', 'a background or edge taphold'],
    trace: null,
    noTrace:
      'timer-driven: its end state is one event, which the specs already assert',
  },
  {
    id: 'press-active',
    input:
      'a press on an element or the background (the :active overlay and the active-bg circle)',
    gates: ["the core's active-bg-* style", "an element's pannable state"],
    events: [],
    state: ['the active flag', 'the active-bg circle'],
    src: ['src/interact/pointer-press.mts', 'src/interact/pointer-hover.mts'],
    browser: [
      [
        'playwright-tests/renderer.spec.js',
        "a pressed node draws v3's :active overlay (round 57.1c)",
        'real',
      ],
      [
        'playwright-tests/renderer.spec.js',
        "a pressed edge draws v3's :active overlay (round 57.8)",
        'real',
      ],
      [
        'playwright-tests/renderer.spec.js',
        'a released-before-the-pick edge press never sticks active (round 57.8)',
        'real',
      ],
      [
        'playwright-tests/renderer.spec.js',
        'core theming styles the selection box and active-bg circle (A2)',
        'real',
      ],
      [
        'playwright-tests/renderer.spec.js',
        'the active-bg circle follows the background drag (round 43.7)',
        'real',
      ],
      [
        'playwright-tests/renderer.spec.js',
        'the active-bg circle stays put when panning is disabled (round 43.7)',
        'real',
      ],
    ],
    headless: [
      [
        'test/active-pannable.mjs',
        "gives a press v3's overlay out of the box, and lets a sheet drop it",
        'api',
      ],
    ],
    gaps: [],
    trace: null,
    noTrace:
      'mid-gesture chrome: gone at rest, so no end state to diff (the pixel specs hold it)',
  },
  {
    id: 'hit-halos',
    input: 'a press near, not on, an edge or an arrowhead',
    gates: [
      'mouse pads (edge 8 px, node 2 px)',
      'touch pads (edge 24 px, node 8 px)',
    ],
    events: ['as tap-select, targeting the edge'],
    state: ['selection'],
    src: ['src/interact/pointer.mts'],
    browser: [
      [
        'playwright-tests/renderer.spec.js',
        "an edge press within v3's hit halo picks the edge (round 57.9)",
        'real',
      ],
      [
        'playwright-tests/renderer.spec.js',
        "a curved edge press within v3's hit halo picks it too (round 57.9)",
        'real',
      ],
      [
        'playwright-tests/renderer.spec.js',
        'an arrowhead picks as its edge, hollow as filled (round 57.10)',
        'real',
      ],
    ],
    headless: [],
    gaps: ['the touch pads, at every tier'],
    trace: 'tap-select',
  },
  {
    id: 'node-drag',
    input: 'press a draggable node, move past the tap threshold, release',
    gates: [
      'autolock',
      'autoungrabify',
      'grabbable / locked / pannable',
      'a running animation on the node',
      'desktopTapThreshold / touchTapThreshold',
    ],
    events: [
      'grabon',
      'grab',
      'pointerdown',
      'tapstart',
      'per move: pointermove, tapdrag, [tapdragover / tapdragout], position, drag',
      'pointerup',
      'tapend',
      'free',
      'freeon',
      'dragfree',
      'dragfreeon',
    ],
    state: ['positions', 'grabbed (during)', 'the cursor'],
    src: [
      'src/interact/pointer-handlers.mts',
      'src/interact/pointer.mts',
      'src/interact/pointer-press.mts',
    ],
    browser: [
      [
        'playwright-tests/renderer.spec.js',
        'mouse drag moves the node in the model and on screen',
        'real',
      ],
      [
        'playwright-tests/renderer.spec.js',
        'the drag-state family: grab/drag/free with companions (round 17.2)',
        'real',
      ],
      [
        'playwright-tests/renderer.spec.js',
        'interaction options: wheelSensitivity, desktopTapThreshold, tapholdDuration (round 20.1)',
        'real',
      ],
    ],
    headless: [
      [
        'test/pointer-cursors.mjs',
        'says grab over a draggable node and grabbing while it drags',
        'driven',
      ],
    ],
    gaps: [
      'a drag under autolock, of a panified node, or of an animating node',
    ],
    trace: 'drag',
  },
  {
    id: 'selection-drag',
    input: 'drag a selected node while other draggable nodes are selected',
    gates: ['as node-drag, per node of the set'],
    events: [
      'grab / drag / free / dragfree on every node of the set',
      'grabon / freeon / dragfreeon on the pressed node only',
      'position per node moved',
    ],
    state: ['positions'],
    src: ['src/interact/pointer-handlers.mts'],
    browser: [
      [
        'playwright-tests/renderer.spec.js',
        'dragging a selected node drags the whole selection (round 10)',
        'real',
      ],
      [
        'playwright-tests/renderer.spec.js',
        'dragging a parent moves its subtree; a selected parent+child pair moves once (round 14.11)',
        'real',
      ],
    ],
    headless: [],
    gaps: [],
    trace: 'drag',
  },
  {
    id: 'compound-drag',
    input:
      'drag a compound parent (a locked child stays; a press on a parent body is provisional until the edge pick answers)',
    gates: ['locked children', 'an edge drawn over the parent body'],
    events: [
      'as node-drag, on the parent and its subtree',
      '[free, freeon when the edge pick takes the press from the parent]',
    ],
    state: ['positions', 'selection (the edge, when it takes the press)'],
    src: [
      'src/interact/pointer-handlers.mts',
      'src/interact/pointer-press.mts',
      'src/collection/position.mts',
    ],
    browser: [
      [
        'playwright-tests/renderer.spec.js',
        'dragging a compound parent leaves a locked child behind and re-derives the parent (116.3)',
        'real',
      ],
      [
        'playwright-tests/renderer.spec.js',
        'dragging a parent moves its subtree; a selected parent+child pair moves once (round 14.11)',
        'real',
      ],
    ],
    headless: [
      [
        'test/grab-lock.mjs',
        'no position event on the stayer; one on the mover',
        'api',
      ],
    ],
    gaps: ['the free / freeon when the edge pick takes a parent press'],
    trace: 'drag',
  },
  {
    id: 'undraggable-press-pans',
    input:
      'press and drag on a node that cannot be dragged (locked, ungrabified, autolock, autoungrabify, pannable, animating)',
    gates: ['userPanningEnabled', 'panningEnabled'],
    events: ['as drag-pan; the node stays the tapstart / tap target'],
    state: ['viewport'],
    src: [
      'src/interact/pointer-press.mts',
      'src/interact/pointer-handlers.mts',
    ],
    browser: [
      [
        'playwright-tests/renderer.spec.js',
        'a locked node does not drag; the gesture pans instead',
        'real',
      ],
      [
        'playwright-tests/renderer.spec.js',
        'a node the drag predicate refuses hovers as pointer',
        'real',
      ],
    ],
    headless: [
      [
        'test/pointer-cursors.mjs',
        'says pointer, not grab, over a node the drag predicate refuses',
        'driven',
      ],
    ],
    gaps: [
      'the pan under autolock, autoungrabify, a panified node or an animating node',
    ],
    trace: 'drag-pan',
  },
  {
    id: 'drag-pan',
    input: 'press the background, move past the tap threshold, release',
    gates: [
      'userPanningEnabled (per move)',
      'panningEnabled',
      'boxSelectionEnabled (with panning off, the press boxes instead)',
    ],
    events: [
      'pointerdown',
      'tapstart',
      'per move: pointermove, tapdrag, [tapdragover / tapdragout], pan, viewport, dragpan',
      'pointerup',
      'tapend',
    ],
    state: ['viewport', 'the cursor'],
    src: ['src/interact/pointer-handlers.mts'],
    browser: [
      [
        'playwright-tests/renderer.spec.js',
        'viewport gesture events: dragpan, scrollzoom, pinchzoom (round 17.4)',
        'real',
      ],
      [
        'playwright-tests/renderer.spec.js',
        'a press says grabbing and mirrors onto the document',
        'real',
      ],
    ],
    headless: [
      [
        'test/pointer-cursors.mjs',
        'says grabbing for a background pan and crosshair for a box',
        'driven',
      ],
    ],
    gaps: ['dragpan with panningEnabled false (it fires though nothing moves)'],
    trace: 'drag-pan',
  },
  {
    id: 'drag-hover',
    input: 'move over nodes while a press is down (tapdragover / tapdragout)',
    gates: [],
    events: ['tapdragover', 'tapdragout'],
    state: [],
    src: ['src/interact/pointer-hover.mts'],
    browser: [
      [
        'playwright-tests/renderer.spec.js',
        'tapselect/tapunselect + hover-during-drag events (round 17.3)',
        'real',
      ],
    ],
    headless: [],
    gaps: [
      'tapdragover / tapdragout during a grab or a pan (the spec presses in box mode)',
    ],
    trace: 'drag',
  },
  {
    id: 'box-select',
    input:
      'shift / ctrl / meta press on the background and drag (or any press with panning off); mouse and pen',
    gates: [
      'boxSelectionEnabled',
      'boxSelectionMode',
      'boxSelectionIncludesLabels',
      'autounselectify',
      'selectionType / the multiple-select key',
      "the element's `events: 'no'` and selectable",
    ],
    events: [
      'pointerdown',
      'tapstart',
      'pointermove',
      'tapdrag',
      'boxstart (core)',
      'pointerup',
      'tapend',
      'boxend (core)',
      'box per element caught',
      '[unselect on the others]',
      'select',
      'boxselect per newly selected element',
    ],
    state: ['selection', 'the cursor'],
    src: ['src/interact/pointer-handlers.mts', 'src/interact/pointer-box.mts'],
    browser: [
      [
        'playwright-tests/renderer.spec.js',
        'shift-drag box-selects the contained elements',
        'real',
      ],
      [
        'playwright-tests/renderer.spec.js',
        'boxSelectionMode overlap catches what the band touches (round 39.1)',
        'real',
      ],
      [
        'playwright-tests/renderer.spec.js',
        'a multiple-select-key drag says crosshair and restores at boxend',
        'real',
      ],
    ],
    headless: [
      ['test/box-select.mjs', 'takes a node the band merely touches', 'api'],
      [
        'test/pointer-cursors.mjs',
        'says grabbing for a background pan and crosshair for a box',
        'driven',
      ],
    ],
    gaps: [
      'a replacing box (panning off, no key) and its selection result',
      'a box under autounselectify',
      'boxSelectionIncludesLabels through the gesture',
      'ctrl or meta as the box key',
    ],
    trace: 'box-select',
  },
  {
    id: 'cxt-mouse',
    input:
      'right-button press, [move], release (the contextmenu is suppressed)',
    gates: [
      'desktopTapThreshold',
      'the target is a node or the core, never an edge',
    ],
    events: [
      'pointerdown',
      'cxttapstart',
      '[pointermove, tapdrag, cxtdrag, cxtdragover / cxtdragout]',
      'pointerup',
      'tapend',
      'cxttapend',
      '[cxttap, when it did not move]',
    ],
    state: [],
    src: ['src/interact/pointer-handlers.mts', 'src/interact/pointer.mts'],
    browser: [
      [
        'playwright-tests/renderer.spec.js',
        'gesture parity: cxttap family, dbltap, taphold (round 10)',
        'real',
      ],
      [
        'playwright-tests/renderer.spec.js',
        'tapselect/tapunselect + hover-during-drag events (round 17.3)',
        'real',
      ],
    ],
    headless: [],
    gaps: ['the contextmenu suppression', 'an edge under a right press'],
    trace: 'cxt-press',
  },
  {
    id: 'wheel-zoom',
    input:
      "a wheel under wheelBehavior 'zoom', or a ctrl / meta wheel in any mode",
    gates: [
      'zoomingEnabled',
      'userZoomingEnabled',
      'wheelSensitivity',
      'minZoom / maxZoom',
    ],
    events: ['zoom', 'viewport', 'scrollzoom (core)'],
    state: ['viewport'],
    src: ['src/interact/pointer-handlers.mts'],
    browser: [
      [
        'playwright-tests/renderer.spec.js',
        "75.5: wheelBehavior 'zoom' (the default) zooms and keeps the page still",
        'real',
      ],
      [
        'playwright-tests/renderer.spec.js',
        '75.5: a zoom-disabled canvas lets the page scroll (v3 contract restored)',
        'real',
      ],
      [
        'playwright-tests/renderer.spec.js',
        'viewport gesture events: dragpan, scrollzoom, pinchzoom (round 17.4)',
        'real',
      ],
      [
        'playwright-tests/renderer.spec.js',
        'interaction options: wheelSensitivity, desktopTapThreshold, tapholdDuration (round 20.1)',
        'real',
      ],
    ],
    headless: [
      [
        'test/interaction-options.mjs',
        'maps each mode and modifier to an action',
        'api',
      ],
      [
        'test/interaction-options.mjs',
        'leaves the wheel to the page when the toggles refuse the action',
        'api',
      ],
    ],
    gaps: [
      'deltaMode line and page',
      'the zoom clamp (scrollzoom fires though the zoom did not change)',
    ],
    trace: 'wheel-zoom',
  },
  {
    id: 'wheel-pan',
    input: "a plain wheel under wheelBehavior 'pan' (round 75.5)",
    gates: ['panningEnabled', 'userPanningEnabled'],
    events: ['pan', 'viewport', 'scrollpan (core)'],
    state: ['viewport'],
    src: ['src/interact/pointer-handlers.mts'],
    browser: [
      [
        'playwright-tests/renderer.spec.js',
        "75.5: wheelBehavior 'pan' pans by the delta and emits scrollpan; ctrl (the pinch) still zooms",
        'real',
      ],
    ],
    headless: [
      [
        'test/interaction-options.mjs',
        'maps each mode and modifier to an action',
        'api',
      ],
    ],
    gaps: ['a horizontal deltaX', 'deltaMode line and page'],
    trace: 'wheel-zoom',
  },
  {
    id: 'wheel-modifier-zoom',
    input:
      "wheelBehavior 'modifier-zoom': the plain wheel scrolls the page, ctrl / meta zooms",
    gates: ['userZoomingEnabled'],
    events: ['[zoom, viewport, scrollzoom on a modified wheel]'],
    state: ['viewport', 'the page scroll'],
    src: ['src/interact/pointer-handlers.mts'],
    browser: [
      [
        'playwright-tests/renderer.spec.js',
        "75.5: wheelBehavior 'modifier-zoom' leaves the plain wheel to the page and zooms on ctrl",
        'real',
      ],
    ],
    headless: [
      [
        'test/interaction-options.mjs',
        'maps each mode and modifier to an action',
        'api',
      ],
    ],
    gaps: ['meta as the modifier, in a browser'],
    trace: 'wheel-zoom',
  },
  {
    id: 'pointercancel',
    input: 'the browser cancels a pointer mid-gesture',
    gates: [],
    events: ['pointercancel (core)', '[free, freeon]'],
    state: ['grabbed (released)', 'the cursor'],
    src: ['src/interact/pointer-handlers.mts'],
    browser: [
      [
        'playwright-tests/renderer.spec.js',
        'pointercancel aborts the gesture: free without dragfree (17.1/17.2)',
        'synthetic',
      ],
      [
        'playwright-tests/renderer.spec.js',
        'pointercancel mid-pan restores, where a sticky grabbing would hide',
        'synthetic',
      ],
    ],
    headless: [
      [
        'test/pointer-cursors.mjs',
        'restores through pointercancel, where a sticky grabbing would hide',
        'driven',
      ],
    ],
    gaps: ['a touch pointercancel', 'a cancel mid-box'],
    trace: 'drag',
  },
  {
    id: 'touch-single',
    input: 'one touch pointer: tap, drag a node, pan, hold',
    gates: [
      'touchTapThreshold',
      'the touch pads',
      'as the mouse forms otherwise; touch never boxes and gets no cursor',
    ],
    events: ['as tap-select, node-drag, drag-pan and taphold'],
    state: ['positions', 'selection', 'viewport'],
    src: [
      'src/interact/pointer-handlers.mts',
      'src/interact/pointer-touch.mts',
    ],
    browser: [],
    headless: [
      ['test/pointer-cursors.mjs', 'leaves a touch gesture alone', 'driven'],
    ],
    gaps: ['every one-finger gesture, at every tier'],
    trace: 'touch-tap-drag',
  },
  {
    id: 'pinch',
    input: 'two touch pointers 200 px or more apart, moved',
    gates: [
      'userZoomingEnabled (the zoom)',
      'userPanningEnabled (the midpoint pan)',
    ],
    events: ['per move: zoom, viewport, pinchzoom, pan, viewport'],
    state: ['viewport'],
    src: [
      'src/interact/pointer-handlers.mts',
      'src/interact/pointer-touch.mts',
    ],
    browser: [
      [
        'playwright-tests/renderer.spec.js',
        'two-finger pinch zooms about the midpoint',
        'synthetic',
      ],
      [
        'playwright-tests/renderer.spec.js',
        'viewport gesture events: dragpan, scrollzoom, pinchzoom (round 17.4)',
        'synthetic',
      ],
    ],
    headless: [],
    gaps: [
      'a pinch with userZoomingEnabled false',
      'the pinch translation (its pan)',
      'a third finger during a pinch',
      'a second finger landing on a grabbed node (the grab is dropped with no free)',
    ],
    trace: 'pinch',
  },
  {
    id: 'touch-cxt',
    input: 'two touch pointers under 200 px apart: press, [drag], lift',
    gates: ['touchTapThreshold'],
    events: [
      'cxttapstart',
      '[cxtdrag, cxtdragover / cxtdragout]',
      'cxttapend',
      '[cxttap, when not dragged or spread into a pinch]',
    ],
    state: [],
    src: ['src/interact/pointer-touch.mts'],
    browser: [
      [
        'playwright-tests/renderer.spec.js',
        'two-finger cxt gesture: cxttap family on touch (round 20.4)',
        'synthetic',
      ],
    ],
    headless: [],
    gaps: ['cxtdragover / cxtdragout on touch', 'a cancel'],
    trace: 'cxt-press',
  },
  {
    id: 'touch-box',
    input:
      'a third touch pointer during an undragged two-finger cxt, moved, lifted',
    gates: ['boxSelectionEnabled', 'autounselectify'],
    events: ['cxttapend', 'boxstart', 'boxend', 'box', 'select', 'boxselect'],
    state: ['selection (always additive)'],
    src: [
      'src/interact/pointer-handlers.mts',
      'src/interact/pointer-touch.mts',
    ],
    browser: [
      [
        'playwright-tests/renderer.spec.js',
        'three-finger box selection on touch (round 20.5)',
        'synthetic',
      ],
    ],
    headless: [],
    gaps: ['a cancel mid-box'],
    trace: 'box-select',
  },
  {
    id: 'cursors',
    input: 'every mouse and pen gesture above (round 89)',
    gates: ['pointerCursors'],
    events: [],
    state: ['the cursor', "the document root's cursor during a drag"],
    src: ['src/interact/cursor.mts', 'src/interact/pointer-hover.mts'],
    browser: [
      [
        'playwright-tests/renderer.spec.js',
        'hover says grab over a draggable node and pointer over an edge',
        'real',
      ],
      [
        'playwright-tests/renderer.spec.js',
        'pointerCursors false writes nothing through any of it',
        'real',
      ],
    ],
    headless: [
      [
        'test/pointer-cursors.mjs',
        'answers every gesture x hover cell for a mouse',
        'driven',
      ],
      [
        'test/pointer-cursors.mjs',
        'mirrors an active drag onto the document and puts it back',
        'driven',
      ],
      [
        'test/pointer-cursors.mjs',
        'hands the cursor back on destroy',
        'driven',
      ],
    ],
    gaps: ['leaving the canvas mid-hover'],
    trace: null,
    noTrace:
      'round 89.3 drives the cursor in the browser already; a cursor is not an end state',
  },
  {
    id: 'original-event',
    input: 'any gesture: the event carries the DOM event',
    gates: [],
    events: [
      'originalEvent on every pointer-driven event (not on timer-fired taphold / onetap)',
    ],
    state: [],
    src: ['src/interact/pointer.mts'],
    browser: [
      [
        'playwright-tests/renderer.spec.js',
        'events carry the DOM event as originalEvent (round 41.4)',
        'real',
      ],
    ],
    headless: [],
    gaps: [],
    trace: null,
    noTrace:
      'a property of every event, asserted by its spec; the traces record types and targets',
  },
  {
    id: 'drag-live-force',
    input:
      'drag a node while a force layout runs (it pins the node and reheats)',
    gates: ["the layout's infinite / animate options"],
    events: ['as node-drag; the layout listens for grab, free and position'],
    state: ['positions (the neighbours follow)'],
    src: ['src/interact/pointer-handlers.mts', 'src/layout/force.mts'],
    browser: [
      [
        'playwright-tests/renderer.spec.js',
        'an infinite GPU force run rests without frames, wakes on a pointer drag, and lands on stop() (118.3)',
        'real',
      ],
    ],
    headless: [
      [
        'test/force-layout.mjs',
        'a drag reheats the field: the grabbed node holds where it is put and its neighbours follow',
        'api',
      ],
      [
        'test/force-worker.mjs',
        'an infinite run reheats through the worker: the grabbed node holds where it is put, its neighbours follow (118.3 on the worker)',
        'api',
      ],
    ],
    gaps: [],
    trace: null,
    noTrace: 'the end state is a simulation, not a function of the trace alone',
  },
  {
    id: 'worker-host',
    input: 'any gesture with the renderer on a worker (renderer.worker: true)',
    gates: ['renderer.worker'],
    events: ['as the same-thread host: one PointerHandler serves both'],
    state: ['as the same-thread host'],
    src: ['src/interact/pointer.mts', 'src/render/worker-renderer.mts'],
    browser: [],
    headless: [],
    gaps: [
      'every gesture: the worker spec covers the pick seam only (node sync, edge async, background), never a pointer',
    ],
    trace: 'drag',
  },
];

/**
 * What a user might expect to be a gesture and v4 does not have, or has
 * only in an application — kept here so the trace tier does not go
 * looking for it.
 */
export const NOT_GESTURES = {
  'grab-and-throw':
    'no throw or inertia exists in v4 (none in src/); item 31 listed it, so the trace pins the absence',
  'hover-emphasis':
    "cy.emphasize (round 102) is API-only; the debug page's Hover select binds it to mouseover / mouseout",
  'label-declutter':
    'round 104 reruns the pass on every frame after a viewport change, so pan and zoom gestures feed it; its specs set the viewport by API',
  'minimap-tap':
    'round 106 debug page only: a tap on the clone pans the main view (debug/minimap.js)',
  keyboard:
    'src/ listens for no key events; modifiers are read off pointer and wheel events',
  'v3-names':
    'vmouse*, mousedown, click and touchstart never fire in v4 (src/README.md); mouseover / mouseout do',
};
