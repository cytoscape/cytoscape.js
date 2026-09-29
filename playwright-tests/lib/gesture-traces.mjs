import fs from 'node:fs';
import path from 'node:path';

/*
Round 142 (item 31, the trace tier): the scripted gesture traces, as data.

Round 136's inventory (`gesture-inventory.mjs`) named nine traces and the
end-state fields each compares.  This module is those traces written
down — one scene, one script of pointer steps per trace — plus what the
Playwright replayer (`trace-replay.mjs`) and the spec (`gestures.spec.js`)
need to compare runs: the hosts a trace runs on, the event vocabulary it
records and how that log is normalized, the numeric comparator, and the
recorded v3 divergences.  None of it touches a browser, so the Node tier
(`test/modules/gesture-traces.mjs`) holds the scripts, the records and
the comparator to each other without one.

**How a run is compared.**  A trace is cut into phases by its `mark`
steps; at each mark, and at the end, the replayer snapshots the trace's
end-state fields.  The snapshots are checked in as
`playwright-tests/gesture-traces/<trace>.json`, captured once from the
same-thread WebGPU host (`UPDATE_GESTURE_TRACES=1`) and reviewed; every
v4 host is then held to that record — so the worker host today, and the
WebGL2 renderer (round 137) tomorrow, run the same scripts unchanged
against the same numbers, and a host is added by one `HOSTS` entry.
v3 replays the mouse traces on the same page, and is compared on the
fields and phases both libraries have, with each known difference
listed in `V3_DIVERGENCES` and asserted to still differ (a stale entry
fails, like the routing ledger's).

**Why a log is normalized rather than compared raw.**  Discrete events
(a tap, a grab, a select, a mark) are recorded in order.  The per-move
stream — `pointermove`, `tapdrag`, `position`, `drag`, `pan`, `zoom`,
`viewport`, `dragpan`, `pinchzoom`, the wheel gestures — is collapsed,
between two discrete events, to the sorted set of its distinct
`type:target` pairs: how many moves a browser delivers is its business,
which of them happened, on what, and between which discrete events is
the gesture's.  Every pointer step waits for its DOM event to arrive
before the next (the replayer's delivery handshake), and steps are
spaced past the 25 ms hover throttles, so the drag-hover events are
deterministic and stay in the ordered record.  `onetap` is not recorded:
it fires from a timer after the debounce window, so whether it lands
before a snapshot is a race the gesture does not own (its row cites the
spec that waits for it).
*/

/** Where the records live (cwd-anchored, as `style-coverage.mjs`). */
export const TRACES_DIR = path.resolve(
  process.cwd(),
  'playwright-tests',
  'gesture-traces',
);

/** The page every trace runs on: v3 and v4 side by side, 400x300 each. */
export const PARITY_PAGE = 'http://127.0.0.1:3333/playwright-page/parity.html';

/**
 * The v4 hosts every trace runs on, each held to the same record.
 * `needs` names the capability the host soft-skips without.  Round 137
 * adds `{ id: 'webgl2', options: { backend: 'webgl2' }, needs: 'webgl2' }`
 * and nothing else.
 */
export const HOSTS = [
  { id: 'webgpu', options: {}, needs: 'adapter' },
  {
    id: 'worker',
    options: { renderer: { worker: true } },
    needs: 'worker-canvas',
  },
];

/**
 * The scene: five nodes and three edges in a 400x300 container at zoom
 * 1, panned so a model point is its rendered point minus (200, 150).
 * Rendered centres: a (100, 100), b (200, 100), c (300, 100),
 * d (100, 210, locked), e (300, 210); the edge ab spans x 120–180 at
 * y 100.  No labels (a label box would join the node's pick).
 * `tapholdDuration` is out of reach so a slow machine cannot fire one
 * mid-trace; the debounce is wide so the one intended double tap lands.
 */
export const SCENE = {
  elements: [
    { data: { id: 'a' }, position: { x: -100, y: -50 } },
    { data: { id: 'b' }, position: { x: 0, y: -50 } },
    { data: { id: 'c' }, position: { x: 100, y: -50 } },
    { data: { id: 'd' }, position: { x: -100, y: 60 }, locked: true },
    { data: { id: 'e' }, position: { x: 100, y: 60 } },
    { data: { id: 'ab', source: 'a', target: 'b' } },
    { data: { id: 'bc', source: 'b', target: 'c' } },
    { data: { id: 'ce', source: 'c', target: 'e' } },
  ],
  style: {
    nodes: {
      width: 40,
      height: 40,
      'background-color': '#5a8',
      shape: 'ellipse',
    },
    edges: { width: 4, 'line-color': '#888' },
  },
  zoom: 1,
  pan: { x: 200, y: 150 },
  options: { tapholdDuration: 60000, multiClickDebounceTime: 2000 },
};

/**
 * v3's form of a scene: its stylesheet is an array of selector blocks
 * where v4's is keyed by group, and its default layout is a grid.
 */
export const v3Scene = (scene) => ({
  elements: scene.elements,
  style: [
    { selector: 'node', style: scene.style.nodes },
    { selector: 'edge', style: scene.style.edges },
  ],
  zoom: scene.zoom,
  pan: scene.pan,
  // v3 runs a grid layout unless told the positions are the layout
  layout: { name: 'preset', fit: false, zoom: scene.zoom, pan: scene.pan },
  ...scene.options,
});

/**
 * The traces' scripts, keyed by the inventory's `TRACES` names (the Node
 * gate holds the two key sets equal).  Coordinates are CSS px relative
 * to the host's container.  Steps:
 *
 * - `{ hover: [x, y], expect }` — jump the mouse there in one move, then
 *   nudge until the hover pick answers `expect` (an id, or null)
 * - `{ down }` / `{ up }` — press or release a button (`'left'` default,
 *   `'right'`) where the mouse is
 * - `{ drag: [x, y], steps, pace }` — move there in `steps` delivered
 *   moves, `pace` ms apart (default 30: past the drag-hover throttle)
 * - `{ key: 'Shift', held: true | false }` — hold or release a modifier
 * - `{ wheel: [dx, dy], times }` — wheel ticks where the mouse is
 * - `{ touch: 'down' | 'move' | 'up', id, at: [x, y] }` — one synthetic
 *   touch `PointerEvent` on the canvas (Playwright has no multi-touch)
 * - `{ touches: { id: [x, y] }, steps }` — move several touch pointers
 *   together, in steps
 * - `{ set: { option: value } }` — call `cy[option](value)` between
 *   gestures (the log is quiesced first)
 * - `{ viewport: { zoom, pan } }` — reset the viewport by API
 * - `{ wait: ms }` — let frames run (the throw trace's after-release)
 * - `{ mark: 'name' }` — snapshot the end-state fields; the events field
 *   of a snapshot holds the phase since the previous mark
 *
 * A step carrying a `v3` string is skipped on v3, the string saying why
 * (an option v3 does not have); the step's effect must not be needed
 * for v3 to reach the same state.
 *
 * `selected` preselects ids; `v3` is how far v3 replays the trace — a
 * mark name (it stops there: every step before it exists in v3), `true`
 * for all of it, or a string saying why not at all.
 */
export const SCRIPTS = {
  drag: {
    selected: ['c', 'e'],
    v3: true,
    steps: [
      // a plain node drag: grab, drag, free, dragfree
      { hover: [100, 100], expect: 'a' },
      { down: 'left' },
      { drag: [130, 160], steps: 5 },
      { up: 'left' },
      { mark: 'node' },
      // a selected node drags the whole selection (c and e)
      { hover: [300, 100], expect: 'c' },
      { down: 'left' },
      { drag: [320, 130], steps: 4 },
      { up: 'left' },
    ],
  },
  'box-select': {
    selected: ['e'],
    v3: true,
    steps: [
      // a shift box is additive: e stays
      { hover: [40, 40], expect: null },
      { key: 'Shift', held: true },
      { down: 'left' },
      { drag: [240, 140], steps: 4 },
      { up: 'left' },
      { key: 'Shift', held: false },
      { mark: 'shift' },
      // with panning off a plain press boxes, and that box replaces
      { set: { userPanningEnabled: false } },
      { hover: [260, 40], expect: null },
      { down: 'left' },
      { drag: [340, 150], steps: 4 },
      { up: 'left' },
    ],
  },
  'wheel-zoom': {
    v3: 'zoom-mode',
    steps: [
      { hover: [200, 100], expect: 'b' },
      { wheel: [0, -100], times: 2 },
      { hover: [50, 260], expect: null },
      { wheel: [0, 100], times: 1 },
      { mark: 'zoom-mode' },
      // wheelBehavior 'pan' (round 75.5): the plain wheel pans, ctrl zooms
      { set: { wheelBehavior: 'pan' } },
      { wheel: [0, 60], times: 1 },
      { wheel: [40, 0], times: 1 },
      { key: 'Control', held: true },
      { wheel: [0, -50], times: 1 },
      { key: 'Control', held: false },
      { mark: 'pan-mode' },
      // 'modifier-zoom': the plain wheel is the page's, ctrl zooms
      { set: { wheelBehavior: 'modifier-zoom' } },
      { wheel: [0, 100], times: 1 },
      { key: 'Control', held: true },
      { wheel: [0, -100], times: 1 },
      { key: 'Control', held: false },
      { mark: 'modifier-zoom' },
      // at the clamp: the zoom cannot move, and scrollzoom still fires
      { set: { wheelBehavior: 'zoom' } },
      { viewport: { zoom: 1, pan: { x: 200, y: 150 } } },
      { set: { maxZoom: 1 } },
      { mark: 'at-the-clamp' },
      { wheel: [0, -100], times: 1 },
    ],
  },
  pinch: {
    v3: 'v3 takes touch as TouchEvents, which the synthetic PointerEvents do not drive',
    steps: [
      // far apart (>= 200 px) pinches at once: spread and translate
      { touch: 'down', id: 1, at: [80, 150] },
      { touch: 'down', id: 2, at: [320, 150] },
      { touches: { 1: [40, 160], 2: [380, 160] }, steps: 4 },
      { touch: 'up', id: 1, at: [40, 160] },
      { touch: 'up', id: 2, at: [380, 160] },
      { mark: 'spread' },
      // the first finger on a node grabs it; the second takes it away
      { viewport: { zoom: 1, pan: { x: 200, y: 150 } } },
      { touch: 'down', id: 3, at: [100, 100] },
      { touch: 'down', id: 4, at: [340, 100] },
      { touches: { 3: [80, 100], 4: [360, 100] }, steps: 3 },
      { touch: 'up', id: 4, at: [360, 100] },
      { touch: 'up', id: 3, at: [80, 100] },
      { mark: 'over-a-grab' },
      // zooming disabled: the pinch cannot zoom
      { viewport: { zoom: 1, pan: { x: 200, y: 150 } } },
      { set: { zoomingEnabled: false } },
      { touch: 'down', id: 5, at: [80, 150] },
      { touch: 'down', id: 6, at: [320, 150] },
      { touches: { 5: [40, 150], 6: [360, 150] }, steps: 3 },
      { touch: 'up', id: 5, at: [40, 150] },
      { touch: 'up', id: 6, at: [360, 150] },
    ],
  },
  'cxt-press': {
    v3: true,
    steps: [
      // a right click on a node: the cxttap family
      { hover: [100, 100], expect: 'a' },
      { down: 'right' },
      { up: 'right' },
      { mark: 'click' },
      // a right drag from a onto b: cxtdrag, cxtdragover / -out
      { down: 'right' },
      { drag: [200, 100], steps: 5 },
      { up: 'right' },
      { mark: 'drag' },
      // a right click on an edge targets the core (nodes only)
      { hover: [150, 100], expect: 'ab' },
      { down: 'right' },
      { up: 'right' },
    ],
  },
  'grab-and-throw': {
    v3: true,
    steps: [
      // a fast drag, released mid-motion; then frames run
      { hover: [200, 100], expect: 'b' },
      { down: 'left' },
      { drag: [260, 160], steps: 2, pace: 0 },
      { up: 'left' },
      { wait: 600 },
    ],
  },
  'tap-select': {
    v3: true,
    steps: [
      { hover: [100, 100], expect: 'a' },
      { down: 'left' },
      { up: 'left' },
      { hover: [200, 100], expect: 'b' },
      { down: 'left' },
      { up: 'left' },
      { mark: 'single' },
      // the additive tap: shift or ctrl keeps the others
      { key: 'Shift', held: true },
      { hover: [300, 100], expect: 'c' },
      { down: 'left' },
      { up: 'left' },
      { key: 'Shift', held: false },
      { key: 'Control', held: true },
      { hover: [300, 210], expect: 'e' },
      { down: 'left' },
      { up: 'left' },
      { key: 'Control', held: false },
      { key: 'Shift', held: true },
      { hover: [300, 100], expect: 'c' },
      { down: 'left' },
      { up: 'left' },
      { key: 'Shift', held: false },
      { mark: 'modifiers' },
      // an edge tap, then the background: cleared, then a double tap
      { hover: [150, 100], expect: 'ab' },
      { down: 'left' },
      { up: 'left' },
      { hover: [50, 260], expect: null },
      { down: 'left' },
      { up: 'left' },
      { down: 'left' },
      { up: 'left' },
      { mark: 'additive' },
      // selectionType 'additive': a plain tap keeps the others
      { set: { selectionType: 'additive' } },
      { hover: [100, 100], expect: 'a' },
      { down: 'left' },
      { up: 'left' },
      { hover: [200, 100], expect: 'b' },
      { down: 'left' },
      { up: 'left' },
      { mark: 'additive-type' },
      // a held press: taphold, and the release still taps
      { set: { tapholdDuration: 300 }, v3: 'v3 fixes the duration at 500 ms' },
      { hover: [300, 210], expect: 'e' },
      { down: 'left' },
      { wait: 800 },
      { up: 'left' },
    ],
  },
  'drag-pan': {
    v3: true,
    steps: [
      // a background drag pans
      { hover: [50, 260], expect: null },
      { down: 'left' },
      { drag: [110, 290], steps: 5 },
      { up: 'left' },
      { mark: 'background' },
      // a locked node cannot drag: the press pans, the node stays put
      { hover: [160, 240], expect: 'd' },
      { down: 'left' },
      { drag: [140, 220], steps: 4 },
      { up: 'left' },
      { mark: 'locked' },
      // panning off, box selection off: the drag does nothing
      { set: { panningEnabled: false, boxSelectionEnabled: false } },
      { hover: [30, 30], expect: null },
      { down: 'left' },
      { drag: [80, 80], steps: 4 },
      { up: 'left' },
    ],
  },
  'touch-tap-drag': {
    v3: 'v3 takes touch as TouchEvents, which the synthetic PointerEvents do not drive',
    steps: [
      { touch: 'down', id: 21, at: [100, 100] },
      { touch: 'up', id: 21, at: [100, 100] },
      { mark: 'tap' },
      { touch: 'down', id: 22, at: [200, 100] },
      { touches: { 22: [230, 160] }, steps: 4 },
      { touch: 'up', id: 22, at: [230, 160] },
      { mark: 'drag' },
      { touch: 'down', id: 23, at: [50, 260] },
      { touches: { 23: [90, 280] }, steps: 4 },
      { touch: 'up', id: 23, at: [90, 280] },
    ],
  },
  'pointer-leave': {
    v3: true,
    steps: [
      { hover: [100, 100], expect: 'a' },
      { leave: [200, 330], expect: null },
    ],
  },
};

/** Every event a trace records: the gesture layer's and the model's. */
export const EVENT_TYPES = [
  'box',
  'boxend',
  'boxselect',
  'boxstart',
  'cxtdrag',
  'cxtdragout',
  'cxtdragover',
  'cxttap',
  'cxttapend',
  'cxttapstart',
  'dbltap',
  'drag',
  'dragfree',
  'dragfreeon',
  'dragpan',
  'free',
  'freeon',
  'grab',
  'grabon',
  'mouseout',
  'mouseover',
  'pan',
  'pinchzoom',
  'pointercancel',
  'pointerdown',
  'pointermove',
  'pointerout',
  'pointerover',
  'pointerup',
  'position',
  'scrollpan',
  'scrollzoom',
  'select',
  'tap',
  'tapdrag',
  'tapdragout',
  'tapdragover',
  'tapend',
  'taphold',
  'tapselect',
  'tapstart',
  'tapunselect',
  'unselect',
  'viewport',
  'zoom',
];

/** Recorded but not recorded in order: one per delivered move or tick. */
export const STREAM_TYPES = new Set([
  'cxtdrag',
  'drag',
  'dragpan',
  'pan',
  'pinchzoom',
  'pointermove',
  'position',
  'scrollpan',
  'scrollzoom',
  'tapdrag',
  'viewport',
  'zoom',
]);

/**
 * The discrete events both libraries emit under the same name, which is
 * what a v3 comparison of the events field reads.  (v3 also emits
 * `mousedown`, `vclick` and the rest, which v4 dropped by decision;
 * v4's `pointer*` family is v3's absent.)  The hover pair is left out:
 * v3 hover-picks synchronously on every move and v4 asynchronously, so
 * the two see different intermediate targets on the same path.
 */
export const V3_SHARED = new Set([
  'box',
  'boxend',
  'boxselect',
  'boxstart',
  'cxttap',
  'cxttapend',
  'cxttapstart',
  'dbltap',
  'dragfree',
  'dragfreeon',
  'free',
  'freeon',
  'grab',
  'grabon',
  'select',
  'tap',
  'tapend',
  'tapselect',
  'tapstart',
  'taphold',
  'tapunselect',
  'unselect',
]);

/** The end-state fields a v3 comparison reads (v3 has no hover state). */
export const V3_FIELDS = [
  'positions',
  'selection',
  'viewport',
  'grabbed',
  'events',
];

/**
 * Normalize one phase's raw log (`'type:target'` strings, in emission
 * order): discrete events stay in order, and each run of stream events
 * between two of them becomes one `'~'`-prefixed entry listing its
 * distinct pairs, sorted.
 *
 * @param log — the raw entries
 * @param only — optional set of types to keep (a v3 comparison's
 *   shared vocabulary); stream types are dropped under it
 * @returns the normalized entries
 */
export const normalizeLog = (log, only = null) => {
  const out = [];
  let run = null;
  const flush = () => {
    if (run != null) {
      out.push('~' + [...run].sort().join(' '));
      run = null;
    }
  };

  for (const entry of log) {
    const type = entry.slice(0, entry.indexOf(':'));

    if (only != null) {
      if (only.has(type)) {
        out.push(entry);
      }

      continue;
    }

    if (STREAM_TYPES.has(type)) {
      (run ??= new Set()).add(entry);

      continue;
    }

    flush();
    out.push(entry);
  }

  flush();

  return out;
};

/**
 * Sort each run of one event type by target.  Where a gesture emits one
 * event across a collection (`box` per caught element, `unselect` per
 * deselected one), the order follows collection order, which each
 * library keeps its own way; a v3 comparison compares the set, and the
 * order of the runs.
 *
 * @param entries — normalized `'type:target'` entries
 * @returns the entries, each same-type run sorted
 */
export const sortRuns = (entries) => {
  const out = [];
  let i = 0;

  while (i < entries.length) {
    const type = entries[i].slice(0, entries[i].indexOf(':'));
    let j = i;

    while (
      j < entries.length &&
      entries[j].slice(0, entries[j].indexOf(':')) === type
    ) {
      j++;
    }

    out.push(...entries.slice(i, j).sort());
    i = j;
  }

  return out;
};

/** Round a captured number so the record is stable text. */
export const round = (n) => Math.round(n * 1e6) / 1e6;

/** Numbers within this are equal (the records are rounded to 1e-6). */
export const TOL = 1e-5;

/**
 * Compare two snapshots field by field, numerically where the field is
 * numeric.  Returns what differed, naming the field, the key and both
 * values — `routing.spec.js`'s method, so a failure says which number
 * moved and by how much rather than that two blobs differ.
 *
 * @param expected — the recorded snapshot
 * @param actual — the replayed one
 * @param fields — the fields to compare
 * @returns `{ field, key, expected, actual }` per difference
 */
export const compareSnapshots = (expected, actual, fields) => {
  const diffs = [];
  const num = (field, key, a, b) => {
    if (typeof a !== 'number' || typeof b !== 'number') {
      if (a !== b) {
        diffs.push({ field, key, expected: a, actual: b });
      }

      return;
    }

    if (!(Math.abs(a - b) <= TOL)) {
      diffs.push({ field, key, expected: a, actual: b });
    }
  };

  for (const field of fields) {
    const a = expected?.[field];
    const b = actual?.[field];

    if (field === 'positions') {
      for (const id of new Set([
        ...Object.keys(a ?? {}),
        ...Object.keys(b ?? {}),
      ])) {
        num(field, `${id}.x`, a?.[id]?.x, b?.[id]?.x);
        num(field, `${id}.y`, a?.[id]?.y, b?.[id]?.y);
      }
    } else if (field === 'viewport') {
      num(field, 'zoom', a?.zoom, b?.zoom);
      num(field, 'pan.x', a?.pan?.x, b?.pan?.x);
      num(field, 'pan.y', a?.pan?.y, b?.pan?.y);
    } else if (Array.isArray(a) && Array.isArray(b)) {
      const n = Math.max(a.length, b.length);

      for (let i = 0; i < n; i++) {
        if (a[i] !== b[i]) {
          diffs.push({ field, key: i, expected: a[i], actual: b[i] });
          break; // the first divergence; the rest follows from it
        }
      }
    } else if (JSON.stringify(a) !== JSON.stringify(b)) {
      diffs.push({ field, key: '', expected: a, actual: b });
    }
  }

  return diffs;
};

/** One line per difference, for a failure message. */
export const formatDiffs = (label, diffs) =>
  diffs
    .map(
      (d) =>
        `${label}: ${d.field}${d.key === '' ? '' : `[${d.key}]`} ` +
        `expected ${JSON.stringify(d.expected)}, got ${JSON.stringify(d.actual)}`,
    )
    .join('\n');

/** The phases a script snapshots: its marks in order, then `end`. */
export const phasesOf = (script) => [
  ...script.steps.filter((s) => s.mark != null).map((s) => s.mark),
  'end',
];

/** The phases v3 replays: up to its stop mark, all, or none. */
export const v3PhasesOf = (script) => {
  if (script.v3 === true) {
    return phasesOf(script);
  }

  const phases = phasesOf(script);
  const stop = phases.indexOf(script.v3);

  return stop < 0 ? [] : phases.slice(0, stop + 1);
};

const RELEASE_ORDER =
  'the release order: v3 emits tap and the selection events before it frees, and each -on variant before its plain form (freeon, free, dragfreeon, dragfree); v4 frees first, plain form first';
const EDGE_PRESS =
  'an edge press: v3 hit-tests edges synchronously, so tapstart / cxttapstart go to the edge; v4 picks nodes synchronously and edges on the GPU, so the press starts on the core and the edge takes the release and the tap (a right press never takes an edge)';
const DBLTAP =
  "v3's dbltap fires on any second tap inside multiClickDebounceTime, whatever its target; v4's needs the same target (the trace widens the window to 2 s so the background double tap lands on both)";
const SHIFT_PRESS =
  'a multiple-select-key press on a node: v3 grabs it (and the selection with it) and frees at release or when a box starts; v4 decides box mode at the press and grabs nothing';
const LOCKED_PRESS =
  'a drag from a locked node pans the viewport in v4 (the round-10 default: an undraggable press pans); v3 neither drags nor pans';

/**
 * Where v3 and v4 differ on a trace, keyed `trace/phase/field`, each
 * with the reason.  The spec asserts every entry still differs, so a
 * difference that closes turns its entry red until it is removed.  The
 * orders and targets are PLAN.md item 88's call, the edge press item
 * 89's.  (Round 142.2 removed the two `cxt-press` entries for the right
 * release's `tapend`, and `tapunselect` from two reasons, by fixing
 * them.)
 */
export const V3_DIVERGENCES = {
  'drag/node/events': RELEASE_ORDER,
  'drag/end/events': RELEASE_ORDER,
  'grab-and-throw/end/events': RELEASE_ORDER,
  'cxt-press/end/events': EDGE_PRESS,
  'wheel-zoom/zoom-mode/viewport':
    'the wheel rate: v3 samples its first wheel deltas and clamps them to ±5 while it does (then scales by the device step it found), so its first ticks zoom ×1.047 where v4 applies one rate, ×10^(Δ/500) per tick',
  'box-select/end/events':
    "v3 unselects the box's outsiders before it emits box on what it caught; v4 emits box first",
  'drag-pan/locked/viewport': LOCKED_PRESS,
  'drag-pan/locked/events':
    "v3's tapend goes to the element under the release point (here the background: the pointer left d); v4's to the pressed element",
  'drag-pan/end/viewport': `${LOCKED_PRESS} (carried from the locked phase)`,
  'tap-select/single/events': `${RELEASE_ORDER}; ${DBLTAP}`,
  'tap-select/modifiers/events': `${SHIFT_PRESS}; ${DBLTAP}`,
  'tap-select/additive/events': `${EDGE_PRESS}; ${DBLTAP}`,
  'tap-select/additive-type/events': `${RELEASE_ORDER}; ${DBLTAP}`,
  'tap-select/end/events': RELEASE_ORDER,
};

/** Read a trace's record, or null when it has none. */
export const readRecord = (trace) => {
  const file = path.join(TRACES_DIR, `${trace}.json`);

  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
};

/** Write a trace's record (UPDATE_GESTURE_TRACES=1). */
export const writeRecord = (trace, record) => {
  fs.mkdirSync(TRACES_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(TRACES_DIR, `${trace}.json`),
    JSON.stringify({ trace, ...record }, null, 2) + '\n',
  );
};
