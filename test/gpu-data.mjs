import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';
import { toColumnarElements } from '../src/gpu/columnar.mjs';
import { DataStore } from '../src/gpu/store/data-store.mjs';

const FIXTURE = {
  nodes: [
    { data: { id: 'a', name: 'Alpha', weight: 1.5 } },
    { data: { id: 'b', name: 'Beta', weight: 2.5, flagged: true } },
    { data: { id: 'c' } }
  ],
  edges: [
    { data: { id: 'ab', source: 'a', target: 'b', kind: 'likes' } },
    { data: { id: 'bc', source: 'b', target: 'c', kind: 'likes', weight: 3 } }
  ]
};

describe('gpu/data', function(){

  describe('element API', function(){
    var cy;

    beforeEach(function(){
      cy = cytoscapeGpu({ elements: FIXTURE });
    });

    it('reads single keys and first-class fields', function(){
      expect( cy.$('#a').data('name') ).to.equal('Alpha');
      expect( cy.$('#a').data('weight') ).to.equal(1.5);
      expect( cy.$('#a').data('id') ).to.equal('a');
      expect( cy.$('#a').data('nope') ).to.be.undefined;
      expect( cy.$('#c').data('name') ).to.be.undefined;
      expect( cy.$('#ab').data('source') ).to.equal('a');
      expect( cy.$('#ab').data('target') ).to.equal('b');
      expect( cy.$('#ab').data('kind') ).to.equal('likes');
    });

    it('assembles the whole data object', function(){
      expect( cy.$('#b').data() ).to.deep.equal({ id: 'b', name: 'Beta', weight: 2.5, flagged: true });
      expect( cy.$('#ab').data() ).to.deep.equal({ id: 'ab', source: 'a', target: 'b', kind: 'likes' });
      expect( cy.$('#c').data() ).to.deep.equal({ id: 'c' });
    });

    it('sets a key and an object patch across a collection', function(){
      cy.$('#a').data('name', 'Alef');

      expect( cy.$('#a').data('name') ).to.equal('Alef');

      cy.nodes().data({ tier: 3 });

      expect( cy.$('#c').data('tier') ).to.equal(3);
      expect( cy.$('#b').data() ).to.include({ tier: 3, name: 'Beta' });
    });

    it('emits data per element when listened to', function(){
      var ids = [];

      cy.on('data', e => ids.push( e.target.id() ));
      cy.nodes().data('seen', true);

      expect( ids ).to.deep.equal(['a', 'b', 'c']);
    });

    it('throws on immutable fields', function(){
      expect( () => cy.$('#a').data('id', 'zz') ).to.throw(/immutable data field 'id'/);
      expect( () => cy.$('#ab').data('source', 'c') ).to.throw(/immutable data field 'source'/);
      expect( () => cy.$('#ab').data({ target: 'a' }) ).to.throw(/immutable data field 'target'/);
    });

    it('nodes may use source/target as ordinary keys', function(){
      cy.$('#a').data('source', 'the-well');

      expect( cy.$('#a').data('source') ).to.equal('the-well');
    });

    it('clears a key with undefined and clears all data on removal', function(){
      cy.$('#a').data('name', undefined);

      expect( cy.$('#a').data('name') ).to.be.undefined;

      cy.$('#c').remove();
      cy.add({ data: { id: 'c2' } }); // may reuse the slot

      expect( cy.$('#c2').data() ).to.deep.equal({ id: 'c2' });
    });
  });

  describe('columnar and bulk ingest', function(){
    it('converter collects sidecar columns', function(){
      const out = toColumnarElements( FIXTURE );

      expect( out.nodes.data.name[0] ).to.equal('Alpha');
      expect( out.nodes.data.weight[1] ).to.equal(2.5);
      expect( out.nodes.data.name[2] ).to.be.undefined;
      expect( out.edges.data.kind ).to.have.length(2);
    });

    it('columnar ingest matches the defs path value for value', function(){
      const viaDefs = cytoscapeGpu({ elements: FIXTURE });
      const viaCol = cytoscapeGpu({ elements: toColumnarElements( FIXTURE ) });

      for( const id of ['a', 'b', 'c', 'ab', 'bc'] ){
        expect( viaCol.$('#' + id).data(), id ).to.deep.equal( viaDefs.$('#' + id).data() );
      }
    });

    it('ingests Float64Array columns with NaN holes', function(){
      const cy = cytoscapeGpu({
        elements: {
          columnar: true,
          nodes: { count: 3, ids: ['x', 'y', 'z'], data: { score: new Float64Array([ 7, NaN, 9 ]) } }
        }
      });

      expect( cy.$('#x').data('score') ).to.equal(7);
      expect( cy.$('#y').data('score') ).to.be.undefined;
      expect( cy.$('#z').data('score') ).to.equal(9);
    });

    it('ingests dictionary columns index-for-index', function(){
      const cy = cytoscapeGpu({
        elements: {
          columnar: true,
          nodes: {
            count: 3, ids: ['x', 'y', 'z'],
            data: { kind: { dict: ['gene', 'drug'], indices: new Uint32Array([ 1, 0, 2 ]) } }
          }
        }
      });

      expect( cy.$('#x').data('kind') ).to.equal('gene');
      expect( cy.$('#y').data('kind') ).to.be.undefined;
      expect( cy.$('#z').data('kind') ).to.equal('drug');
    });
  });

  describe('store column adaptation', function(){
    it('promotes a column on mixed types', function(){
      const data = new DataStore();

      data.set('nodes', 0, 'k', 1);
      data.set('nodes', 1, 'k', 2);

      expect( data.column('nodes', 'k').kind ).to.equal('number');

      data.set('nodes', 2, 'k', 'three');

      expect( data.column('nodes', 'k').kind ).to.equal('mixed');
      expect( data.get('nodes', 0, 'k') ).to.equal(1);
      expect( data.get('nodes', 2, 'k') ).to.equal('three');
    });

    it('dictionary-encodes repeating strings', function(){
      const data = new DataStore();

      for( let i = 0; i < 100; i++ ){ data.set('nodes', i, 'kind', i % 2 ? 'a' : 'b'); }

      const col = data.column('nodes', 'kind');

      expect( col.kind ).to.equal('string');
      expect( col.dict ).to.have.length(2);
      expect( data.get('nodes', 3, 'kind') ).to.equal('a');
    });

    it('keeps booleans and objects in the mixed fallback', function(){
      const data = new DataStore();

      data.set('nodes', 0, 'meta', { deep: [1, 2] });
      data.set('nodes', 1, 'meta', true);

      expect( data.get('nodes', 0, 'meta') ).to.deep.equal({ deep: [1, 2] });
      expect( data.get('nodes', 1, 'meta') ).to.equal(true);
    });
  });

  describe('label mappers', function(){
    it('data(key) labels resolve from the sidecar', function(){
      const cy = cytoscapeGpu({
        elements: FIXTURE,
        style: [ { selector: 'node', style: { label: 'data(name)' } } ]
      });

      expect( cy.$('#a').label() ).to.equal('Alpha');
      expect( cy.$('#c').label() ).to.equal(''); // absent -> no label
    });

    it('numbers stringify in labels', function(){
      const cy = cytoscapeGpu({
        elements: FIXTURE,
        style: [ { selector: 'node', style: { label: 'data(weight)' } } ]
      });

      expect( cy.$('#b').label() ).to.equal('2.5');
    });

    it('a data write refreshes mapped labels', function(){
      const cy = cytoscapeGpu({
        elements: FIXTURE,
        style: [ { selector: 'node', style: { label: 'data(name)' } } ]
      });

      cy.$('#a').data('name', 'Renamed');

      expect( cy.$('#a').label() ).to.equal('Renamed');
    });

    it('a write of an unmapped key leaves labels untouched', function(){
      const cy = cytoscapeGpu({
        elements: FIXTURE,
        style: [ { selector: 'node', style: { label: 'data(name)' } } ]
      });

      const before = cy.$('#a').label();

      cy.$('#a').data('unrelated', 'x'); // skips the label refresh pass

      expect( cy.$('#a').label() ).to.equal( before );
    });

    it('a mapper in a :selected block still refreshes on data writes', function(){
      const cy = cytoscapeGpu({
        elements: FIXTURE,
        style: [ { selector: 'node:selected', style: { label: 'data(name)' } } ]
      });

      cy.$('#a').select();

      cy.$('#a').data('name', 'Selected label');

      expect( cy.$('#a').label() ).to.equal('Selected label');
    });

    it('removeData of the mapped key clears the label', function(){
      const cy = cytoscapeGpu({
        elements: FIXTURE,
        style: [ { selector: 'node', style: { label: 'data(name)' } } ]
      });

      cy.$('#a').removeData('name');

      expect( cy.$('#a').label() ).to.equal('');
    });

    it('data(id) still resolves and stays immutable', function(){
      const cy = cytoscapeGpu({
        elements: FIXTURE,
        style: [ { selector: 'node', style: { label: 'data(id)' } } ]
      });

      expect( cy.$('#a').label() ).to.equal('a');
    });
  });
});
