import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// Round 75.6: cy.viewportCounts() is a GPU readback, so headless it
// resolves null — the eleventh sitting's call, over zeros or a geometric
// count, matching cy.pick()'s headless answer.  The counting itself is
// pinned in the renderer project (exact counts, a pan, visibility, stale
// args), where the control reads the args at the wrong offset.

describe('cy.viewportCounts (round 75.6)', function () {
  it('resolves null headless', async function () {
    var cy = cytoscape({
      elements: [{ data: { id: 'a' } }, { data: { id: 'b' } }],
    });
    var answer = cy.viewportCounts();

    expect(answer).to.be.an.instanceof(Promise);
    expect(await answer).to.equal(null);
  });

  it('resolves null on a destroyed instance', async function () {
    var cy = cytoscape();

    cy.destroy();
    expect(await cy.viewportCounts()).to.equal(null);
  });

  it('the geometric alternative the JSDoc names still answers headless', function () {
    var cy = cytoscape({
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b' }, position: { x: 5000, y: 0 } },
      ],
      headlessWidth: 800,
      headlessHeight: 600,
      zoom: 1,
      pan: { x: 400, y: 300 },
    });
    var e = cy.extent();

    expect(
      cy.elementsInBox(e.x1, e.y1, e.x2, e.y2).map((x) => x.id()),
    ).to.deep.equal(['a']);
  });
});
