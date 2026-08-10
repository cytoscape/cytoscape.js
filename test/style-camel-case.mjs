import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

/*
Round 63.1: style property keys accept both spellings — `foo-bar` and
`fooBar` — at every entry point that takes one (the maintainer's
amendment to the round-63 plan).

Most entry points already normalized (`resolveConst`, the getter memo,
the transition and animation parsers, the compound and core splitters);
this file is what pins that as a contract rather than a coincidence,
across the whole readable surface at once.  The styled fixtures are
copies of `test/style-readback-all.mjs`'s (importing a spec file would
re-register its suites under this file's run) — drift between the
copies is harmless, because each file asserts against the live engine
rather than against the other.

The bypasses section and `removeStyle` take both spellings too —
pinned beside their behaviour in `test/style-bypass.mjs` (the camel
section entry, and a dash-set prop removed via its camel spelling).
*/

const NODE_STYLE = {
  'background-color': '#3366cc',
  'background-opacity': 0.8,
  'background-fill': 'linear-gradient',
  'background-gradient-stop-colors': '#fff #000',
  'background-gradient-stop-positions': '0% 100%',
  'background-gradient-direction': 'to-right',
  'border-color': '#123456',
  'border-width': 3,
  'border-opacity': 0.7,
  'border-position': 'inside',
  'corner-radius': 6,
  shape: 'round-rectangle',
  width: 44,
  height: 22,
  opacity: 0.9,
  visibility: 'visible',
  'outline-color': '#abcdef',
  'outline-width': 2,
  'outline-opacity': 0.5,
  'outline-offset': 1,
  ghost: 'yes',
  'ghost-offset-x': 3,
  'ghost-offset-y': 4,
  'ghost-opacity': 0.3,
  'overlay-color': '#0f0',
  'overlay-opacity': 0.2,
  'overlay-padding': 5,
  'overlay-shape': 'ellipse',
  'overlay-corner-radius': 4,
  'underlay-color': '#00f',
  'underlay-opacity': 0.1,
  'underlay-padding': 6,
  'underlay-shape': 'round-rectangle',
  'underlay-corner-radius': 3,
  label: 'hello world wrapping',
  'font-size': 13,
  color: '#222',
  'text-opacity': 0.8,
  'text-outline-width': 1,
  'text-outline-color': '#eee',
  'text-outline-opacity': 0.6,
  'text-background-color': '#ff0',
  'text-background-opacity': 0.4,
  'text-background-padding': 2,
  'text-background-shape': 'round-rectangle',
  'text-border-width': 1,
  'text-border-color': '#f0f',
  'text-border-opacity': 0.3,
  'text-margin-x': 2,
  'text-margin-y': -2,
  'text-transform': 'uppercase',
  'text-valign': 'center',
  'text-halign': 'right',
  'text-wrap': 'wrap',
  'text-max-width': 40,
  'line-height': 1.4,
  'text-overflow-wrap': 'anywhere',
  'text-justification': 'left',
  'text-rotation': 0.5,
  'min-zoomed-font-size': 4,
  events: 'yes',
  'text-events': 'yes',
  chart: 'pie',
  'chart-values': '0.2 0.3 0.5',
  'chart-colors': '#f00 #0f0 #00f',
  'chart-size': 0.8,
  'chart-hole': 0.2,
  'chart-start-angle': 0.1,
  'chart-direction': 'vertical',
  'chart-opacity': 0.9,
  'background-image': 'https://example.invalid/a.png',
  'background-fit': 'contain',
  'background-image-opacity': 0.7,
  'background-position-x': '10%',
  'background-position-y': '20%',
  'background-offset-x': 1,
  'background-offset-y': 2,
  'background-width': '50%',
  'background-height': '60%',
  'background-repeat': 'repeat',
  'background-clip': 'node',
  'background-image-containment': 'inside',
  'background-image-smoothing': 'no',
  'background-image-crossorigin': 'anonymous',
  'background-image-type': 'auto',
  'background-image-color': '#654321',
  'transition-property': 'opacity',
  'transition-duration': 120,
  'transition-delay': 10,
  'transition-timing-function': 'ease-in',
};

const EDGE_STYLE = {
  'line-color': '#987654',
  width: 4,
  opacity: 0.85,
  'line-opacity': 0.75,
  'line-style': 'dashed',
  'line-cap': 'round',
  'line-dash-pattern': '6 3',
  'line-dash-offset': 2,
  'line-fill': 'linear-gradient',
  'line-gradient-stop-colors': '#111 #999',
  'line-gradient-stop-positions': '0% 100%',
  'line-outline-width': 2,
  'line-outline-color': '#aaa',
  'source-arrow-shape': 'triangle',
  'target-arrow-shape': 'vee',
  'source-arrow-color': '#f00',
  'target-arrow-color': '#0f0',
  'mid-source-arrow-shape': 'circle',
  'mid-target-arrow-shape': 'tee',
  'mid-source-arrow-color': '#00f',
  'mid-target-arrow-color': '#ff0',
  'arrow-scale': 1.5,
  'source-arrow-fill': 'hollow',
  'target-arrow-fill': 'filled',
  'source-arrow-width': 'match-line',
  'target-arrow-width': 6,
  'curve-style': 'taxi',
  'taxi-direction': 'downward',
  'taxi-turn': '40%',
  'taxi-turn-min-distance': 12,
  'taxi-radius': 7,
  'control-point-step-size': 41,
  'control-point-weight': 0.4,
  'loop-direction': 0.2,
  'loop-sweep': 0.3,
  'edge-distances': 'node-position',
  'haystack-radius': 0,
  'source-endpoint': 'outside-to-node',
  'target-endpoint': 'outside-to-node',
  'source-distance-from-node': 1,
  'target-distance-from-node': 2,
  label: 'edge label',
  'font-size': 11,
  color: '#333',
  'text-rotation': 'autorotate',
  'source-label': 'src',
  'target-label': 'tgt',
  'source-text-offset': 3,
  'target-text-offset': 4,
  'source-text-margin-x': 1,
  'source-text-margin-y': 1,
  'target-text-margin-x': 2,
  'target-text-margin-y': 2,
  'source-text-rotation': 'none',
  'target-text-rotation': 'none',
  events: 'yes',
  visibility: 'visible',
  'overlay-color': '#0ff',
  'overlay-opacity': 0.2,
  'overlay-padding': 3,
  'underlay-color': '#f0f',
  'underlay-opacity': 0.1,
  'underlay-padding': 2,
  'transition-property': 'opacity',
  'transition-duration': 90,
  'transition-delay': 5,
  'transition-timing-function': 'linear',
};

/** 'foo-bar-baz' -> 'fooBarBaz'; keys without dashes pass through. */
const camelize = (prop) => prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

const camelizeProps = (props) => {
  const out = {};

  for (const key of Object.keys(props)) {
    out[camelize(key)] = props[key];
  }

  return out;
};

const ELEMENTS = [
  { data: { id: 'a' } },
  { data: { id: 'b' } },
  { data: { id: 'ab', source: 'a', target: 'b' } },
];

describe('style prop keys accept dash-case and camelCase (round 63.1)', function () {
  it('camelizing every fixture key produces a distinct spelling where a dash exists', function () {
    // the sweep's own control: if camelize() were identity, every spec
    // below would compare a fixture against itself and prove nothing
    const dashKeys = [
      ...Object.keys(NODE_STYLE),
      ...Object.keys(EDGE_STYLE),
    ].filter((k) => k.includes('-'));

    expect(dashKeys.length).to.be.greaterThan(100);

    for (const k of dashKeys) {
      expect(camelize(k)).to.not.equal(k);
      expect(camelize(k)).to.not.include('-');
    }
  });

  it('sheet blocks: a fully camelized sheet reads back identically to the dash sheet', function () {
    const dash = cytoscape({
      elements: ELEMENTS,
      style: { nodes: NODE_STYLE, edges: EDGE_STYLE },
    });
    const camel = cytoscape({
      elements: ELEMENTS,
      style: {
        nodes: camelizeProps(NODE_STYLE),
        edges: camelizeProps(EDGE_STYLE),
      },
    });

    expect(camel.$id('a').style()).to.deep.equal(dash.$id('a').style());
    expect(camel.$id('ab').style()).to.deep.equal(dash.$id('ab').style());

    dash.destroy();
    camel.destroy();
  });

  it('parents and core groups accept camelCase', function () {
    const compound = [
      { data: { id: 'p' } },
      { data: { id: 'c1', parent: 'p' } },
      { data: { id: 'c2', parent: 'p' } },
    ];
    const dash = cytoscape({
      elements: compound,
      style: {
        parents: {
          'background-color': '#dddddd',
          'min-width': 300,
          'padding-relative-to': 'min',
          padding: 12,
        },
        core: { 'selection-box-color': '#123456', 'active-bg-opacity': 0.5 },
      },
    });
    const camel = cytoscape({
      elements: compound,
      style: {
        parents: {
          backgroundColor: '#dddddd',
          minWidth: 300,
          paddingRelativeTo: 'min',
          padding: 12,
        },
        core: { selectionBoxColor: '#123456', activeBgOpacity: 0.5 },
      },
    });

    expect(camel.$id('p').style()).to.deep.equal(dash.$id('p').style());
    expect(camel.$id('p').style('min-width')).to.equal(300);
    expect(camel.style().core()).to.deep.equal(dash.style().core());

    dash.destroy();
    camel.destroy();
  });

  it('getters: every readable prop answers identically through both spellings', function () {
    const cy = cytoscape({
      elements: ELEMENTS,
      style: { nodes: NODE_STYLE, edges: EDGE_STYLE },
    });
    const node = cy.$id('a');
    const edge = cy.$id('ab');

    // numericStyle throws on non-numeric values by contract, so the
    // sweep compares outcomes: both spellings answer the same number or
    // both throw — a spelling-dependent outcome is the failure
    const numericOutcome = (name) => {
      try {
        return { value: node.numericStyle(name) };
      } catch {
        return { threw: true };
      }
    };

    for (const key of Object.keys(NODE_STYLE)) {
      expect(node.style(camelize(key)), key).to.deep.equal(node.style(key));
      expect(numericOutcome(camelize(key)), key).to.deep.equal(
        numericOutcome(key),
      );
    }

    for (const key of Object.keys(EDGE_STYLE)) {
      expect(edge.style(camelize(key)), key).to.deep.equal(edge.style(key));
    }

    // one rendered-space read pins the normalizeCss path too
    cy.viewport({ zoom: 2, pan: { x: 0, y: 0 } });
    expect(node.renderedStyle('borderWidth')).to.equal(
      node.renderedStyle('border-width'),
    );

    cy.destroy();
  });

  it('transition-property lists accept camel entries', function () {
    const dash = cytoscape({
      elements: ELEMENTS,
      style: {
        nodes: {
          'transition-property': ['background-color', 'border-width'],
          'transition-duration': 100,
        },
      },
    });
    const camel = cytoscape({
      elements: ELEMENTS,
      style: {
        nodes: {
          transitionProperty: ['backgroundColor', 'borderWidth'],
          transitionDuration: 100,
        },
      },
    });

    expect(camel.$id('a').style('transition-property')).to.deep.equal(
      dash.$id('a').style('transition-property'),
    );

    dash.destroy();
    camel.destroy();
  });

  it('animate({ style }) accepts camel keys', function () {
    const cy = cytoscape({ elements: ELEMENTS });
    const node = cy.$id('a');

    node.animate({ style: { backgroundColor: 'rgb(255,0,0)' }, duration: 50 });
    node.stop(true, true);

    expect(node.style('background-color')).to.equal('rgb(255,0,0)');
    cy.destroy();
  });

  it('unknown names still throw through both spellings', function () {
    const cy = cytoscape({ elements: ELEMENTS });

    expect(() => cy.$id('a').style('totally-bogus')).to.throw(/totally-bogus/);
    expect(() => cy.$id('a').style('totallyBogus')).to.throw(/totally-bogus/);
    expect(() =>
      cytoscape({ style: { nodes: { totallyBogus: 1 } } }),
    ).to.throw();

    cy.destroy();
  });
});
