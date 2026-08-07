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
});
