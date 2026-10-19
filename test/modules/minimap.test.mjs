import { expect } from 'chai';
import { createRequire } from 'node:module';
import cytoscape from '../../src/index.mjs';

// Round 106: the debug page's minimap (debug/minimap.js) — the proof of
// "a second view is a second instance".  Its pure half runs here,
// headless, against the real library: the simplified sheet compiles, the
// clone's options give a view that follows the main one's structure and
// positions but owns its sheet and selection and refuses drags, and the
// extent rectangle and the tap's pan are the viewport maths they claim.

const require = createRequire(import.meta.url);
const minimap = require('../../debug/minimap.js');

const nextSync = (cy) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no sync came')), 1000);

    cy.one('patch', (e) => {
      clearTimeout(timer);
      resolve(e.diff);
    });
  });

const main = () =>
  cytoscape({
    headlessWidth: 800,
    headlessHeight: 600,
    elements: [
      { data: { id: 'p' } },
      { data: { id: 'a', parent: 'p' }, position: { x: 0, y: 0 } },
      { data: { id: 'b', parent: 'p' }, position: { x: 100, y: 50 } },
      { data: { id: 'c' }, position: { x: 400, y: 300 } },
      { data: { id: 'ab', source: 'a', target: 'b' } },
      { data: { id: 'bc', source: 'b', target: 'c' } },
    ],
    style: {
      nodes: { label: 'data(id)', 'background-color': 'orange', width: 30 },
      edges: { 'target-arrow-shape': 'triangle' },
    },
  });

describe('debug: the minimap (round 106)', () => {
  it('is a following clone with its own sheet, locked to the user', async () => {
    const cy = main();
    const mini = cy.clone(minimap.cloneOptions(null, 0));

    expect(mini.style().json()).to.deep.equal(minimap.MINIMAP_STYLE);
    expect(mini.$id('a').style('width')).to.equal(40);
    expect(cy.$id('a').style('width'), 'the sheet leaked back').to.equal(30);
    expect(mini.autolock()).to.equal(true);
    expect(mini.autoungrabify()).to.equal(true);
    expect(mini.userPanningEnabled()).to.equal(false);

    // structure and positions follow; a drag on the main view moves it
    let synced = nextSync(mini);

    cy.$id('c').position({ x: 900, y: -100 });
    cy.add({ data: { id: 'd' }, position: { x: -300, y: 0 } });
    await synced;

    expect(mini.$id('c').position()).to.deep.equal({ x: 900, y: -100 });
    expect(mini.$id('d').length).to.equal(1);

    synced = nextSync(mini);
    cy.remove(cy.$id('bc'));
    await synced;
    expect(mini.$id('bc').length).to.equal(0);

    // selection is the main view's own
    cy.$id('a').select();
    expect(mini.$id('a').selected()).to.equal(false);

    mini.destroy();
    cy.destroy();
  });

  it('draws the main view extent in the minimap rendered px', () => {
    const cy = main();
    const mini = cy.clone(minimap.cloneOptions(null, 0));

    cy.zoom(2);
    cy.pan({ x: 100, y: 40 });
    mini.zoom(0.5);
    mini.pan({ x: 10, y: 20 });

    const ext = cy.extent();
    const r = minimap.viewRect(cy, mini);

    // model (x1, y1) = (-50, -20) at zoom 2 / pan (100, 40), 400 x 300 wide
    expect(ext.x1).to.equal(-50);
    expect(ext.y1).to.equal(-20);
    expect(r).to.deep.equal({
      left: -50 * 0.5 + 10,
      top: -20 * 0.5 + 20,
      width: 400 * 0.5,
      height: 300 * 0.5,
    });

    mini.destroy();
    cy.destroy();
  });

  it('centres the main view on a tapped model position', () => {
    const cy = main();

    cy.zoom(3);
    cy.pan(minimap.centrePan(cy, { x: 400, y: 300 }));

    const rendered = cy.$id('c').renderedPosition();

    expect(rendered.x).to.be.closeTo(cy.width() / 2, 1e-9);
    expect(rendered.y).to.be.closeTo(cy.height() / 2, 1e-9);
    cy.destroy();
  });
});
