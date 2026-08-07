import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

describe('gpu/selection', function () {
  var cy;

  beforeEach(function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' }, selected: true },
        { data: { id: 'locked' }, selectable: false },
        { data: { id: 'ab', source: 'a', target: 'b' } },
      ],
    });
  });

  it('respects the initial selected state', function () {
    expect(cy.$id('c').selected()).to.be.true;
    expect(cy.$id('a').selected()).to.be.false;
    expect(cy.filter({ selected: true })).to.have.length(1);
  });

  it('selects and unselects', function () {
    cy.$id('a').select();

    expect(cy.$id('a').selected()).to.be.true;

    cy.$id('a').unselect();

    expect(cy.$id('a').selected()).to.be.false;
  });

  it('selects a whole collection', function () {
    cy.nodes().select();

    expect(cy.filter({ group: 'nodes', selected: true })).to.have.length(3); // locked is not selectable
  });

  it('does not select unselectable elements', function () {
    expect(cy.$id('locked').selectable()).to.be.false;

    cy.$id('locked').select();

    expect(cy.$id('locked').selected()).to.be.false;
  });

  it('selects edges', function () {
    cy.$id('ab').select();

    expect(cy.filter({ group: 'edges', selected: true })).to.have.length(1);
  });

  it('unselectify() freezes selection state in both directions', function () {
    cy.$id('a').select();
    cy.$id('a').unselectify();

    // an already-selected node cannot be unselected while unselectable
    cy.$id('a').unselect();
    expect(cy.$id('a').selected()).to.be.true;

    // and an unselected one cannot be selected
    expect(cy.$id('b').selectable()).to.be.true;
    cy.$id('b').unselectify().select();
    expect(cy.$id('b').selected()).to.be.false;
  });

  it('selectify() restores mutable selection state', function () {
    cy.$id('a').select();
    cy.$id('a').unselectify();
    cy.$id('a').selectify();

    cy.$id('a').unselect();
    expect(cy.$id('a').selected()).to.be.false;
  });

  it('emits select and unselect per state change only', function () {
    var selects = 0;
    var unselects = 0;

    cy.on('select', function () {
      selects++;
    });
    cy.on('unselect', function () {
      unselects++;
    });

    cy.$id('a').select();
    cy.$id('a').select(); // no-op

    expect(selects).to.equal(1);

    cy.$id('a').unselect();
    cy.$id('a').unselect(); // no-op

    expect(unselects).to.equal(1);
  });

  it('emits select with the element as target', function () {
    var target = null;

    cy.on('select', function (e) {
      target = e.target;
    });
    cy.$id('a').select();

    expect(target.id()).to.equal('a');
  });

  it('supports element-level select listeners', function () {
    var called = 0;

    cy.$id('a').on('select', function () {
      called++;
    });

    cy.$id('b').select();
    expect(called).to.equal(0);

    cy.$id('a').select();
    expect(called).to.equal(1);
  });
});
