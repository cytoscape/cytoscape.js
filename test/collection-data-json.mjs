import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

describe('gpu/collection: removeData, scratch, json', function () {
  var cy;

  beforeEach(function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'n1', foo: 1, bar: 'x' }, position: { x: 10, y: 20 } },
        { data: { id: 'n2' } },
        { data: { id: 'e1', source: 'n1', target: 'n2', weight: 3 } },
      ],
    });
  });

  it('removeData(names) clears named keys', function () {
    cy.$id('n1').removeData('foo');

    expect(cy.$id('n1').data('foo')).to.equal(undefined);
    expect(cy.$id('n1').data('bar')).to.equal('x');
  });

  it('removeData() with no args clears all sidecar keys', function () {
    cy.$id('n1').removeData();

    expect(cy.$id('n1').data('foo')).to.equal(undefined);
    expect(cy.$id('n1').data('bar')).to.equal(undefined);
    // id stays first-class
    expect(cy.$id('n1').data('id')).to.equal('n1');
  });

  it('removeData() on an edge leaves id/source/target intact', function () {
    cy.$id('e1').removeData();

    expect(cy.$id('e1').data('weight')).to.equal(undefined); // sidecar cleared
    expect(cy.$id('e1').data('id')).to.equal('e1');
    expect(cy.$id('e1').data('source')).to.equal('n1');
    expect(cy.$id('e1').data('target')).to.equal('n2');
  });

  it('removeAttr alias', function () {
    cy.$id('n1').removeAttr('bar');
    expect(cy.$id('n1').data('bar')).to.equal(undefined);
  });

  it('removeData emits data', function () {
    var fired = 0;
    cy.$id('n1').on('data', () => fired++);
    cy.$id('n1').removeData('foo');
    expect(fired).to.equal(1);
  });

  it('scratch() set/get whole and namespaced', function () {
    cy.$id('n1').scratch('_layout', { x: 5 });

    expect(cy.$id('n1').scratch('_layout')).to.deep.equal({ x: 5 });
    expect(cy.$id('n1').scratch()).to.deep.equal({ _layout: { x: 5 } });
  });

  it('scratch(obj) merges', function () {
    cy.$id('n1').scratch({ a: 1 });
    cy.$id('n1').scratch({ b: 2 });

    expect(cy.$id('n1').scratch()).to.deep.equal({ a: 1, b: 2 });
  });

  it('scratch persists across handle lookups (interned)', function () {
    cy.$id('n1').scratch('k', 42);
    expect(cy.getElementById('n1').scratch('k')).to.equal(42);
  });

  it('removeScratch(namespace) and removeScratch()', function () {
    cy.$id('n1').scratch({ a: 1, b: 2 });
    cy.$id('n1').removeScratch('a');
    expect(cy.$id('n1').scratch()).to.deep.equal({ b: 2 });

    cy.$id('n1').removeScratch();
    expect(cy.$id('n1').scratch()).to.deep.equal({});
  });

  it('json() for a node', function () {
    var j = cy.$id('n1').json();

    expect(j.group).to.equal('nodes');
    expect(j.data.id).to.equal('n1');
    expect(j.data.foo).to.equal(1);
    expect(j.position).to.deep.equal({ x: 10, y: 20 });
    expect(j.selected).to.equal(false);
    expect(j.selectable).to.equal(true);
    expect(j.removed).to.equal(false);
  });

  it('json() for an edge carries source/target', function () {
    var j = cy.$id('e1').json();

    expect(j.group).to.equal('edges');
    expect(j.data.source).to.equal('n1');
    expect(j.data.target).to.equal('n2');
    expect(j.data.weight).to.equal(3);
    expect(j.position).to.equal(undefined);
  });

  it('jsons() maps over the collection', function () {
    var js = cy.nodes().jsons();

    expect(js.length).to.equal(2);
    expect(js.map((j) => j.data.id).sort()).to.deep.equal(['n1', 'n2']);
  });

  it('json() is undefined on an empty collection', function () {
    expect(cy.collection().json()).to.equal(undefined);
  });
});
