import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

describe('gpu: grabbable / locked / selectify + core auto* gating', function () {
  var cy;

  beforeEach(function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'n1' } },
        {
          data: { id: 'n2' },
          locked: true,
          grabbable: false,
          selectable: false,
        },
      ],
    });
  });

  it('nodes are grabbable, unlocked by default', function () {
    expect(cy.$id('n1').grabbable()).to.equal(true);
    expect(cy.$id('n1').locked()).to.equal(false);
    expect(cy.$id('n1').grabbed()).to.equal(false);
  });

  it('def flags: locked / grabbable:false / selectable:false honored', function () {
    expect(cy.$id('n2').locked()).to.equal(true);
    expect(cy.$id('n2').grabbable()).to.equal(false);
    expect(cy.$id('n2').selectable()).to.equal(false);
  });

  it('grabify / ungrabify toggle grabbable', function () {
    cy.$id('n1').ungrabify();
    expect(cy.$id('n1').grabbable()).to.equal(false);

    cy.$id('n1').grabify();
    expect(cy.$id('n1').grabbable()).to.equal(true);
  });

  it('lock / unlock toggle locked', function () {
    cy.$id('n1').lock();
    expect(cy.$id('n1').locked()).to.equal(true);

    cy.$id('n1').unlock();
    expect(cy.$id('n1').locked()).to.equal(false);
  });

  it('selectify / unselectify toggle selectable', function () {
    cy.$id('n2').selectify();
    expect(cy.$id('n2').selectable()).to.equal(true);

    cy.$id('n2').unselectify();
    expect(cy.$id('n2').selectable()).to.equal(false);
  });

  it('setters apply across a collection', function () {
    cy.nodes().lock();
    expect(cy.nodes().every((n) => n.locked())).to.equal(true);
  });

  it('unselectify prevents selection', function () {
    cy.$id('n1').unselectify();
    cy.$id('n1').select();
    expect(cy.$id('n1').selected()).to.equal(false);
  });

  it('core autolock / autoungrabify / autounselectify getters & setters', function () {
    expect(cy.autolock()).to.equal(false);
    expect(cy.autoungrabify()).to.equal(false);
    expect(cy.autounselectify()).to.equal(false);

    expect(cy.autolock(true)).to.equal(cy);
    expect(cy.autolock()).to.equal(true);

    cy.autoungrabify(true);
    expect(cy.autoungrabify()).to.equal(true);

    cy.autounselectify(true);
    expect(cy.autounselectify()).to.equal(true);
  });

  it('autolock/autoungrabify aliases', function () {
    expect(cy.autolockNodes).to.equal(cy.autolock);
    expect(cy.autoungrabifyNodes).to.equal(cy.autoungrabify);
  });

  it('core auto* options from the constructor', function () {
    var cy2 = cytoscape({
      autolock: true,
      autoungrabify: true,
      autounselectify: true,
    });

    expect(cy2.autolock()).to.equal(true);
    expect(cy2.autoungrabify()).to.equal(true);
    expect(cy2.autounselectify()).to.equal(true);
  });

  describe('a locked child stays when its parent moves (116.3)', function () {
    // p > a (locked), p > b: a stays, b travels, and p re-derives about
    // both rather than taking the write
    var mk = () =>
      cytoscape({
        elements: [
          { data: { id: 'p' } },
          { data: { id: 'a', parent: 'p' }, locked: true },
          { data: { id: 'b', parent: 'p' }, position: { x: 100, y: 0 } },
        ],
      });
    var at = (cy, id) => cy.$id(id).position();

    it('against position(): the child stays, the parent re-derives', function () {
      const cy = mk();

      expect(at(cy, 'p')).to.deep.equal({ x: 50, y: 0 });

      cy.$id('p').position({ x: 150, y: 0 });

      expect(at(cy, 'a')).to.deep.equal({ x: 0, y: 0 });
      expect(at(cy, 'b')).to.deep.equal({ x: 200, y: 0 });
      // the written 150 is not what a parent reads back: its box spans
      // a (still at 0) and b (now at 200)
      expect(at(cy, 'p')).to.deep.equal({ x: 100, y: 0 });
    });

    it('against shift(), and the parent keeps re-deriving per step as a drag does', function () {
      const cy = mk();

      cy.$id('p').shift({ x: 10, y: 5 });
      cy.$id('p').shift({ x: 10, y: 5 });

      expect(at(cy, 'a')).to.deep.equal({ x: 0, y: 0 });
      expect(at(cy, 'b')).to.deep.equal({ x: 120, y: 10 });
      expect(at(cy, 'p')).to.deep.equal({ x: 60, y: 5 });
    });

    it("the locked child's own subtree stays with it", function () {
      const cy = cytoscape({
        elements: [
          { data: { id: 'p' } },
          { data: { id: 'a', parent: 'p' }, locked: true },
          { data: { id: 'aa', parent: 'a' }, position: { x: 0, y: 0 } },
          { data: { id: 'b', parent: 'p' }, position: { x: 100, y: 0 } },
        ],
      });
      const p0 = { ...at(cy, 'p') };

      cy.$id('p').shift({ x: 100, y: 0 });

      expect(at(cy, 'a')).to.deep.equal({ x: 0, y: 0 });
      expect(at(cy, 'aa')).to.deep.equal({ x: 0, y: 0 });
      expect(at(cy, 'b')).to.deep.equal({ x: 200, y: 0 });
      // a's box (the wider, being a compound) holds the left edge; b's
      // right edge moved by 100, so the centre moved by half
      expect(at(cy, 'p').x).to.be.closeTo(p0.x + 50, 1e-6);
      expect(at(cy, 'p').y).to.be.closeTo(p0.y, 1e-6);
    });

    it('a locked grandchild under an unlocked child: the child moves and re-derives', function () {
      const cy = cytoscape({
        elements: [
          { data: { id: 'p' } },
          { data: { id: 'c', parent: 'p' } },
          { data: { id: 'cc', parent: 'c' }, locked: true },
          { data: { id: 'cd', parent: 'c' }, position: { x: 100, y: 0 } },
          { data: { id: 'b', parent: 'p' }, position: { x: 300, y: 0 } },
        ],
      });
      const p0 = { ...at(cy, 'p') };

      cy.$id('p').shift({ x: 100, y: 0 });

      expect(at(cy, 'cc')).to.deep.equal({ x: 0, y: 0 });
      expect(at(cy, 'cd')).to.deep.equal({ x: 200, y: 0 });
      expect(at(cy, 'b')).to.deep.equal({ x: 400, y: 0 });
      expect(at(cy, 'c')).to.deep.equal({ x: 100, y: 0 });
      expect(at(cy, 'p').x).to.be.closeTo(p0.x + 50, 1e-6);
    });

    it('no position event on the stayer; one on the mover', function () {
      const cy = mk();
      const seen = [];

      cy.on('position', (e) => seen.push(e.target.id()));
      cy.$id('p').position({ x: 150, y: 0 });

      expect(seen).to.include('p');
      expect(seen).to.include('b');
      expect(seen).to.not.include('a');
    });

    it('control: unlocked, the whole subtree travels and the parent reads the write', function () {
      const cy = mk();

      cy.$id('a').unlock();
      cy.$id('p').position({ x: 150, y: 0 });

      expect(at(cy, 'a')).to.deep.equal({ x: 100, y: 0 });
      expect(at(cy, 'b')).to.deep.equal({ x: 200, y: 0 });
      expect(at(cy, 'p')).to.deep.equal({ x: 150, y: 0 });
    });
  });

  describe('a locked node holds its position (114.3)', function () {
    var moved = () => cy.$id('n1').position();
    var held = () => cy.$id('n2').position();
    var start;

    beforeEach(function () {
      cy.$id('n2').position({ x: 0, y: 0 }); // no-op: already locked
      cy.$id('n2').unlock().position({ x: 40, y: 50 }).lock();
      start = { ...held() };
      expect(start).to.deep.equal({ x: 40, y: 50 });
    });

    it('against position() and positions(), object and function forms', function () {
      cy.$id('n2').position({ x: 1, y: 2 });
      expect(held()).to.deep.equal(start);

      cy.nodes().positions({ x: 3, y: 4 });
      expect(held()).to.deep.equal(start);
      expect(moved()).to.deep.equal({ x: 3, y: 4 });

      cy.nodes().positions(() => ({ x: 5, y: 6 }));
      expect(held()).to.deep.equal(start);
      expect(moved()).to.deep.equal({ x: 5, y: 6 });
    });

    it('against shift()', function () {
      cy.nodes().shift({ x: 10, y: 10 });
      expect(held()).to.deep.equal(start);
      expect(moved()).to.deep.equal({ x: 10, y: 10 });
    });

    it('against a position tween, while its style still animates', async function () {
      await cy
        .nodes()
        .animation({
          position: { x: 9, y: 9 },
          style: { opacity: 0.5 },
          duration: 20,
        })
        .play();

      expect(held()).to.deep.equal(start);
      expect(moved().x).to.be.closeTo(9, 1e-6);
      expect(cy.$id('n2').style('opacity')).to.equal(0.5);
    });

    it('control: unlocked, the same writes land', function () {
      cy.$id('n2').unlock();
      cy.$id('n2').position({ x: 1, y: 2 });
      expect(held()).to.deep.equal({ x: 1, y: 2 });
      cy.nodes().shift({ x: 1, y: 1 });
      expect(held()).to.deep.equal({ x: 2, y: 3 });
    });

    it('autolock locks every node for writes, tweens and locked()', async function () {
      cy.autolock(true);
      expect(cy.$id('n1').locked()).to.equal(true);

      cy.nodes().positions({ x: 7, y: 7 });
      expect(moved()).to.deep.equal({ x: 0, y: 0 });

      await cy
        .nodes()
        .animation({ position: { x: 9, y: 9 }, duration: 20 })
        .play();
      expect(moved()).to.deep.equal({ x: 0, y: 0 });

      cy.autolock(false);
      expect(cy.$id('n1').locked()).to.equal(false);
      cy.nodes().positions({ x: 7, y: 7 });
      expect(moved()).to.deep.equal({ x: 7, y: 7 });
    });
  });
});
