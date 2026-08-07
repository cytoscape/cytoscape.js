/*
Round 55: the routing-parity scene matrix.

Shared by the numeric specs (`routing.spec.js`) and available to the
pixel scenes, so the two tiers cannot drift into testing different
graphs.

Conventions every scene follows, and the reason for each:

  - **Integer node positions and integer sizes.**  v4 stores positions,
    sizes and curve params as f32; integers keep the *inputs* exact so
    the tolerance measures derived quantization and nothing else.
  - **Disjoint node pairs per edge**, except where a scene is explicitly
    about interaction (bundles, compounds).  v3 buckets edges by node
    pair, so unrelated edges sharing a pair would silently become bundle
    members and every number would move.
  - **`arrow-shape: none` unless the scene is about arrows.**  v3
    shortens its line by `arrowShapes[shape].gap(edge)`; with `none` that
    is 0, which is the one configuration where v4's current
    no-gap-at-all behaviour agrees with v3.  Scenes that want to *see*
    the gap say so.
  - **No labels.**  Glyph metrics differ by design between canvas and
    SDF, and the label-aware endpoint modes would drag that difference
    into a geometry comparison.
  - **No haystack above radius 0.**  v3 seeds haystack angles from
    `Math.random()` per edge, so there is nothing to compare.

Node sizes are 30x30 unless a scene needs otherwise, matching the
existing parity scenes.
*/

const NODE = { 'width': 30, 'height': 30, 'shape': 'ellipse', 'background-color': '#c0392b' };

/** v3 wants a selector list; v4 wants one object with a `data` mapper. */
const sheets = ( shared, families ) => ( {
  v3Style: [
    { selector: 'node', style: { ...NODE } },
    { selector: 'edge', style: { 'curve-style': 'straight', 'arrow-shape': 'none', ...shared } },
    ...families.map( fam => ( {
      selector: `edge[fam = '${fam}']`, style: { 'curve-style': fam }
    } ) )
  ],
  v4Style: {
    nodes: { 'width': 30, 'height': 30, 'background-color': '#c0392b' },
    edges: { 'curve-style': { data: 'fam' }, ...shared }
  }
} );

const node = ( id, x, y, extra = {} ) => ( { data: { id, ...extra }, position: { x, y } } );
const edge = ( id, source, target, fam, extra = {} ) =>
  ( { data: { id, source, target, fam, ...extra } } );

/** R0 — the wiring control.  One straight edge, no arrows, generic slope.
 * If this diverges, nothing else in the matrix means anything. */
const base = () => {
  const { v3Style, v4Style } = sheets( {}, [ 'straight' ] );

  return {
    name: 'base',
    tolClass: 'exact',
    note: 'the control: a single straight edge on a generic slope',
    elements: [ node( 'a', -137, -61 ), node( 'b', 123, 79 ), edge( 'e', 'a', 'b', 'straight' ) ],
    edges: [ 'e' ],
    v3Style, v4Style
  };
};

/** R1 — one edge per curve family, at one generic orientation. */
const families = () => {
  const fams = [
    'straight', 'unbundled-bezier', 'segments', 'round-segments',
    'taxi', 'round-taxi', 'straight-triangle'
  ];
  const shared = {
    'control-point-distances': [ 40, -30 ],
    'control-point-weights': [ 0.25, 0.75 ],
    'segment-distances': [ 40, -40 ],
    'segment-weights': [ 0.3, 0.7 ],
    'segment-radii': 18,
    'taxi-turn': 30,
    'taxi-radius': 12
  };
  const { v3Style, v4Style } = sheets( shared, fams );
  const elements = [];
  const edges = [];

  fams.forEach( ( fam, i ) => {
    const y = i * 120;

    elements.push( node( `s${i}`, 0, y ), node( `t${i}`, 220, y + 70 ) );
    elements.push( edge( fam, `s${i}`, `t${i}`, fam ) );
    edges.push( fam );
  } );

  return {
    name: 'families', tolClass: 'derived',
    note: 'one edge per curve family at a generic orientation',
    elements, edges, v3Style, v4Style
  };
};

/**
 * R2 — taxi and round-taxi across orientations, including the two
 * axis-aligned degenerates.
 *
 * The degenerate cases are the point: `evalTaxi` emits two *coincident*
 * interior points when the endpoints share an axis (v3 does too — that
 * part is a faithful port), and v4's `computeCorner` then divides by a
 * zero leg length, so `round-taxi` comes back NaN.  v3's `round.mts` has
 * the identical division, which is why those rows are ledger entries
 * rather than expected matches.
 */
const taxiOrientations = () => {
  const fams = [ 'taxi', 'round-taxi' ];
  const shared = { 'taxi-turn': '50%', 'taxi-turn-min-distance': 10, 'taxi-radius': 15 };
  const { v3Style, v4Style } = sheets( shared, fams );
  const elements = [];
  const edges = [];

  // ( label, dx, dy ) — vertical and horizontal are the degenerates
  const dirs = [
    [ 'vert', 0, 160 ], [ 'horiz', 200, 0 ], [ 'diag', 160, 160 ], [ 'back', -160, 120 ]
  ];

  fams.forEach( ( fam, f ) => {
    dirs.forEach( ( [ label, dx, dy ], d ) => {
      const x = d * 320;
      const y = f * 400;
      const id = `${fam}-${label}`;

      elements.push( node( `${id}-s`, x, y ), node( `${id}-t`, x + dx, y + dy ) );
      elements.push( edge( id, `${id}-s`, `${id}-t`, fam ) );
      edges.push( id );
    } );
  } );

  return {
    name: 'taxi', tolClass: 'derived',
    note: 'taxi + round-taxi across four orientations, two of them axis-aligned',
    elements, edges, v3Style, v4Style
  };
};

/** R3 — segments with explicit distances/weights, aligned and diagonal.
 * Separate from taxi because segments *declare* their points where taxi
 * derives them, so a divergence here is a weight/distance frame bug. */
const segments = () => {
  const fams = [ 'segments', 'round-segments' ];
  const shared = {
    'segment-distances': [ 30, -50 ], 'segment-weights': [ 0.25, 0.75 ], 'segment-radii': 14
  };
  const { v3Style, v4Style } = sheets( shared, fams );
  const elements = [];
  const edges = [];

  fams.forEach( ( fam, f ) => {
    [ [ 'aligned', 220, 0 ], [ 'diag', 180, 140 ] ].forEach( ( [ label, dx, dy ], d ) => {
      const x = d * 320;
      const y = f * 260;
      const id = `${fam}-${label}`;

      elements.push( node( `${id}-s`, x, y ), node( `${id}-t`, x + dx, y + dy ) );
      elements.push( edge( id, `${id}-s`, `${id}-t`, fam ) );
      edges.push( id );
    } );
  } );

  return {
    name: 'segments', tolClass: 'derived',
    note: 'declared segment points, axis-aligned and diagonal chords',
    elements, edges, v3Style, v4Style
  };
};

/**
 * R4 — the boundary-approximation tier, measured.
 *
 * v4 treats round-rectangles as their box and every polygon as its
 * inscribed ellipse (`src/curve-geometry.mts`).  `test/curve-geometry.mjs`
 * now measures that at the leaf; this scene measures what it costs at the
 * end of a real edge, which is the number an application sees.
 */
const shapes = () => {
  const shapes_ = [ 'ellipse', 'rectangle', 'round-rectangle', 'diamond', 'triangle' ];
  const elements = [];
  const edges = [];

  shapes_.forEach( ( shape, i ) => {
    const y = i * 120;

    elements.push(
      { data: { id: `${shape}-s`, shp: shape }, position: { x: 0, y } },
      { data: { id: `${shape}-t`, shp: shape }, position: { x: 200, y: y + 60 } } );
    elements.push( edge( shape, `${shape}-s`, `${shape}-t`, 'unbundled-bezier' ) );
    edges.push( shape );
  } );

  return {
    name: 'shapes', tolClass: 'derived',
    // `unbundled-bezier`, not `bezier`, and the distinction is the whole
    // scene: a *lone* `bezier` edge renders straight (v3's odd-bundle rule,
    // ported), and a straight edge resolves no boundary point at all — so
    // the obvious spelling would have produced five edges that never touch
    // the code this scene is named for.  Verified before shipping: with
    // `bezier` every edge here reported signature `none`.
    note: 'unbundled-bezier endpoints against each node shape — the approximation tier',
    elements, edges,
    v3Style: [
      { selector: 'node', style: { ...NODE, 'width': 40, 'height': 24 } },
      ...shapes_.map( shape => ( { selector: `node[shp = '${shape}']`, style: { shape } } ) ),
      { selector: 'edge', style: {
        'curve-style': 'unbundled-bezier',
        'control-point-distances': [ 45 ], 'control-point-weights': [ 0.5 ]
      } }
    ],
    v4Style: {
      nodes: { 'width': 40, 'height': 24, 'background-color': '#c0392b', 'shape': { data: 'shp' } },
      edges: {
        'curve-style': 'unbundled-bezier',
        'control-point-distances': [ 45 ], 'control-point-weights': [ 0.5 ]
      }
    }
  };
};

/**
 * R5 — one edge per arrow shape.
 *
 * This is where the missing gap becomes seven exact numbers rather than
 * an impression.  v3 shortens the line by `gap(edge)` and places the tip
 * at `spacing(edge)`; `sourceEndpoint()`/`targetEndpoint()` report the
 * *tip*, so the divergence this scene shows is the `spacing` half (only
 * `tee` is non-zero) — the `gap` half is invisible to an accessor and is
 * what the pixel scenes carry.
 *
 * Widths are deliberately above 3.16: v3's `getArrowWidth` floors at 29
 * before applying `arrow-scale`, so at width 3 the floor binds and the
 * power law never runs.
 */
const arrows = () => {
  const heads = [ 'none', 'triangle', 'vee', 'diamond', 'chevron', 'tee', 'circle' ];
  const elements = [];
  const edges = [];

  heads.forEach( ( head, i ) => {
    const y = i * 110;

    elements.push(
      { data: { id: `${head}-s`, }, position: { x: 0, y } },
      { data: { id: `${head}-t`, }, position: { x: 240, y } } );
    elements.push( { data: { id: head, source: `${head}-s`, target: `${head}-t`, head } } );
    edges.push( head );
  } );

  return {
    name: 'arrows', tolClass: 'derived',
    // fix 1 (the boundary endpoint) took this scene from 14 diverged
    // fields to 4.  What is left is exactly v3's `spacing` term, which
    // fix 3 owns: circle by 9.880383 (getArrowWidth(5, 1.5) x 0.15) and
    // tee by its constant 1.0.  The other five heads are clean.
    expectFail: 'fix 3 — the residual is v3\'s arrow spacing on tee and circle, nothing else',
    note: 'one edge per arrow shape — the spacing half of v3\'s gap/spacing pair',
    elements, edges,
    v3Style: [
      { selector: 'node', style: { ...NODE } },
      { selector: 'edge', style: {
        'curve-style': 'straight', 'width': 5, 'arrow-scale': 1.5, 'line-color': '#2c3e50'
      } },
      ...heads.map( head => ( {
        selector: `edge[head = '${head}']`,
        style: { 'source-arrow-shape': head, 'target-arrow-shape': head }
      } ) )
    ],
    v4Style: {
      nodes: { 'width': 30, 'height': 30, 'background-color': '#c0392b' },
      edges: {
        'curve-style': 'straight', 'width': 5, 'arrow-scale': 1.5, 'line-color': '#2c3e50',
        'source-arrow-shape': { data: 'head' },
        'target-arrow-shape': { data: 'head' }
      }
    }
  };
};

/**
 * R6 — the compound tier, which is the maintainer's stated suspicion.
 *
 * v3's compound dispatch (`edge-control-points.mts:981`) fires only when
 * one endpoint is an **ancestor** of the other, or a parent self-loops.
 * That partition is sharper than people expect, and half these rows are
 * controls that must match exactly:
 *
 *   p->c, p->gc, c->p, p->p (self)   route as `compound`
 *   sibling<->sibling                 routes normally  (control)
 *   child-of-A <-> child-of-B         routes normally  (control)
 *   parentA <-> parentB               routes normally, but both ends clip
 *                                     against a derived box that v3 forces
 *                                     into the rectangle family
 *
 * If the two control rows diverge, the compound rows' divergences are not
 * about compounds at all.
 */
const compounds = () => {
  const elements = [
    { data: { id: 'A' } },
    { data: { id: 'B' } },
    node( 'a1', 0, 0, { parent: 'A' } ),
    node( 'a2', 90, 0, { parent: 'A' } ),
    { data: { id: 'G', parent: 'A' } },
    node( 'g1', 45, 90, { parent: 'G' } ),
    node( 'b1', 400, 0, { parent: 'B' } ),
    node( 'b2', 490, 0, { parent: 'B' } ),
    node( 'lone', 250, 300 ),

    // The four ancestry edges keep `bezier`: v3 preempts them to its
    // `compound` routing regardless of the declared style, so the style
    // is not what they test.  The three control edges are
    // `unbundled-bezier` instead, because a lone `bezier` renders
    // straight and a straight edge resolves no boundary point — the
    // controls would have compared node centres and proved nothing.
    // They deliberately avoid v3's own unbundled-plus-compound defect,
    // which only fires on ancestry edges.
    edge( 'p-child', 'A', 'a1', 'bezier' ),
    edge( 'p-grandchild', 'A', 'g1', 'bezier' ),
    edge( 'child-p', 'a2', 'A', 'bezier' ),
    edge( 'sibling', 'a1', 'a2', 'unbundled-bezier' ),
    edge( 'cross', 'a1', 'b1', 'unbundled-bezier' ),
    edge( 'parent-parent', 'A', 'B', 'unbundled-bezier' ),
    edge( 'leaf-parent', 'lone', 'B', 'unbundled-bezier' )
  ];

  const shared = { 'control-point-distances': [ 45 ], 'control-point-weights': [ 0.5 ] };

  return {
    name: 'compound', tolClass: 'compound',
    expectFail: 'round 55 finding, open call — v3\'s derived parent box is 1.0 model px larger per side than the children\'s union, independent of border width; every divergence here traces to that',
    note: 'the seven compound arrangements, three of them controls that must match',
    elements,
    edges: [ 'p-child', 'p-grandchild', 'child-p', 'sibling', 'cross', 'parent-parent', 'leaf-parent' ],
    // `border-width: 0` on both sides is not decoration.  src/README.md
    // attributes v4's smaller parent boxes to v3's node bb picking up the
    // border's miter-corner overshoot, so the obvious reading of any gap
    // here is "that known deviation".  Pinning the border to zero removes
    // that explanation from the scene: whatever remains cannot be about
    // borders.  Measured — the gap is 1.0 model px per side at
    // border-width 0, 1 and 4 alike.
    v3Style: [
      { selector: 'node', style: { ...NODE, 'border-width': 0 } },
      { selector: ':parent', style: { 'padding': 10, 'shape': 'rectangle', 'border-width': 0 } },
      { selector: 'edge', style: { 'curve-style': 'bezier', ...shared } },
      { selector: 'edge[fam = \'unbundled-bezier\']', style: { 'curve-style': 'unbundled-bezier' } }
    ],
    v4Style: {
      nodes: { 'width': 30, 'height': 30, 'background-color': '#c0392b', 'border-width': 0 },
      parents: { 'padding': 10, 'shape': 'rectangle', 'border-width': 0 },
      edges: { 'curve-style': { data: 'fam' }, ...shared }
    }
  };
};

/** R7 — bundles: stagger index and the pair-orientation sign. */
const bundles = () => {
  const elements = [
    node( 'u1', 0, 0 ), node( 'u2', 200, 0 ),
    node( 'v1', 0, 160 ), node( 'v2', 200, 160 ),
    edge( 'two-a', 'u1', 'u2', 'bezier' ), edge( 'two-b', 'u1', 'u2', 'bezier' ),
    edge( 'three-a', 'v1', 'v2', 'bezier' ), edge( 'three-b', 'v1', 'v2', 'bezier' ),
    // reversed: v3 normalizes the pair and mirrors the frame, so this
    // member's stagger sign is the thing being checked
    edge( 'three-rev', 'v2', 'v1', 'bezier' )
  ];

  return {
    name: 'bundles', tolClass: 'derived',
    note: 'a 2-bundle and a 3-bundle with one reversed member',
    elements,
    edges: [ 'two-a', 'two-b', 'three-a', 'three-b', 'three-rev' ],
    v3Style: [
      { selector: 'node', style: { ...NODE } },
      { selector: 'edge', style: { 'curve-style': 'bezier', 'arrow-shape': 'none' } }
    ],
    v4Style: {
      nodes: { 'width': 30, 'height': 30, 'background-color': '#c0392b' },
      edges: { 'curve-style': 'bezier' }
    }
  };
};

/** R8 — self-loops: the per-node stagger index. */
const loops = () => {
  const elements = [
    node( 'n', 0, 0 ),
    edge( 'loop1', 'n', 'n', 'bezier' ),
    edge( 'loop2', 'n', 'n', 'bezier' ),
    edge( 'loop3', 'n', 'n', 'bezier' )
  ];

  return {
    name: 'loops', tolClass: 'derived',
    note: 'three self-loops on one node — the stagger index',
    elements, edges: [ 'loop1', 'loop2', 'loop3' ],
    v3Style: [
      { selector: 'node', style: { ...NODE } },
      { selector: 'edge', style: { 'curve-style': 'bezier', 'arrow-shape': 'none' } }
    ],
    v4Style: {
      nodes: { 'width': 30, 'height': 30, 'background-color': '#c0392b' },
      edges: { 'curve-style': 'bezier' }
    }
  };
};

export const SCENES = [
  base(), families(), taxiOrientations(), segments(), shapes(), arrows(), compounds(), bundles(), loops()
];

export const sceneByName = ( name ) => SCENES.find( s => s.name === name );
