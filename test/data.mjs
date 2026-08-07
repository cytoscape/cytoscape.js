import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { toColumnarElements } from '../src/columnar.mjs';
import { DataStore } from '../src/store/data-store.mjs';

const FIXTURE = {
  nodes: [
    { data: { id: 'a', name: 'Alpha', weight: 1.5 } },
    { data: { id: 'b', name: 'Beta', weight: 2.5, flagged: true } },
    { data: { id: 'c' } },
  ],
  edges: [
    { data: { id: 'ab', source: 'a', target: 'b', kind: 'likes' } },
    { data: { id: 'bc', source: 'b', target: 'c', kind: 'likes', weight: 3 } },
  ],
};

describe('gpu/data', function () {
  describe('element API', function () {
    var cy;

    beforeEach(function () {
      cy = cytoscape({ elements: FIXTURE });
    });

    it('reads single keys and first-class fields', function () {
      expect(cy.$id('a').data('name')).to.equal('Alpha');
      expect(cy.$id('a').data('weight')).to.equal(1.5);
      expect(cy.$id('a').data('id')).to.equal('a');
      expect(cy.$id('a').data('nope')).to.be.undefined;
      expect(cy.$id('c').data('name')).to.be.undefined;
      expect(cy.$id('ab').data('source')).to.equal('a');
      expect(cy.$id('ab').data('target')).to.equal('b');
      expect(cy.$id('ab').data('kind')).to.equal('likes');
    });

    it('assembles the whole data object', function () {
      expect(cy.$id('b').data()).to.deep.equal({
        id: 'b',
        name: 'Beta',
        weight: 2.5,
        flagged: true,
      });
      expect(cy.$id('ab').data()).to.deep.equal({
        id: 'ab',
        source: 'a',
        target: 'b',
        kind: 'likes',
      });
      expect(cy.$id('c').data()).to.deep.equal({ id: 'c' });
    });

    it('sets a key and an object patch across a collection', function () {
      cy.$id('a').data('name', 'Alef');

      expect(cy.$id('a').data('name')).to.equal('Alef');

      cy.nodes().data({ tier: 3 });

      expect(cy.$id('c').data('tier')).to.equal(3);
      expect(cy.$id('b').data()).to.include({ tier: 3, name: 'Beta' });
    });

    it('emits data per element when listened to', function () {
      var ids = [];

      cy.on('data', (e) => ids.push(e.target.id()));
      cy.nodes().data('seen', true);

      expect(ids).to.deep.equal(['a', 'b', 'c']);
    });

    it('throws on immutable fields', function () {
      expect(() => cy.$id('a').data('id', 'zz')).to.throw(
        /immutable data field 'id'/,
      );
      expect(() => cy.$id('ab').data('source', 'c')).to.throw(
        /immutable data field 'source'/,
      );
      expect(() => cy.$id('ab').data({ target: 'a' })).to.throw(
        /immutable data field 'target'/,
      );
    });

    it('nodes may use source/target as ordinary keys', function () {
      cy.$id('a').data('source', 'the-well');

      expect(cy.$id('a').data('source')).to.equal('the-well');
    });

    it('clears a key with undefined and clears all data on removal', function () {
      cy.$id('a').data('name', undefined);

      expect(cy.$id('a').data('name')).to.be.undefined;

      cy.$id('c').remove();
      cy.add({ data: { id: 'c2' } }); // may reuse the slot

      expect(cy.$id('c2').data()).to.deep.equal({ id: 'c2' });
    });
  });

  describe('columnar and bulk ingest', function () {
    it('converter collects sidecar columns', function () {
      const out = toColumnarElements(FIXTURE);

      expect(out.nodes.data.name[0]).to.equal('Alpha');
      expect(out.nodes.data.weight[1]).to.equal(2.5);
      expect(out.nodes.data.name[2]).to.be.undefined;
      expect(out.edges.data.kind).to.have.length(2);
    });

    it('columnar ingest matches the defs path value for value', function () {
      const viaDefs = cytoscape({ elements: FIXTURE });
      const viaCol = cytoscape({ elements: toColumnarElements(FIXTURE) });

      for (const id of ['a', 'b', 'c', 'ab', 'bc']) {
        expect(viaCol.$id(id).data(), id).to.deep.equal(viaDefs.$id(id).data());
      }
    });

    it('ingests Float64Array columns with NaN holes', function () {
      const cy = cytoscape({
        elements: {
          columnar: true,
          nodes: {
            count: 3,
            ids: ['x', 'y', 'z'],
            data: { score: new Float64Array([7, NaN, 9]) },
          },
        },
      });

      expect(cy.$id('x').data('score')).to.equal(7);
      expect(cy.$id('y').data('score')).to.be.undefined;
      expect(cy.$id('z').data('score')).to.equal(9);
    });

    it('ingests dictionary columns index-for-index', function () {
      const cy = cytoscape({
        elements: {
          columnar: true,
          nodes: {
            count: 3,
            ids: ['x', 'y', 'z'],
            data: {
              kind: {
                dict: ['gene', 'drug'],
                indices: new Uint32Array([1, 0, 2]),
              },
            },
          },
        },
      });

      expect(cy.$id('x').data('kind')).to.equal('gene');
      expect(cy.$id('y').data('kind')).to.be.undefined;
      expect(cy.$id('z').data('kind')).to.equal('drug');
    });
  });

  describe('store column adaptation', function () {
    it('promotes a column on mixed types', function () {
      const data = new DataStore();

      data.set('nodes', 0, 'k', 1);
      data.set('nodes', 1, 'k', 2);

      expect(data.column('nodes', 'k').kind).to.equal('number');

      data.set('nodes', 2, 'k', 'three');

      expect(data.column('nodes', 'k').kind).to.equal('mixed');
      expect(data.get('nodes', 0, 'k')).to.equal(1);
      expect(data.get('nodes', 2, 'k')).to.equal('three');
    });

    it('dictionary-encodes repeating strings', function () {
      const data = new DataStore();

      for (let i = 0; i < 100; i++) {
        data.set('nodes', i, 'kind', i % 2 ? 'a' : 'b');
      }

      const col = data.column('nodes', 'kind');

      expect(col.kind).to.equal('string');
      expect(col.dict).to.have.length(2);
      expect(data.get('nodes', 3, 'kind')).to.equal('a');
    });

    it('keeps booleans and objects in the mixed fallback', function () {
      const data = new DataStore();

      data.set('nodes', 0, 'meta', { deep: [1, 2] });
      data.set('nodes', 1, 'meta', true);

      expect(data.get('nodes', 0, 'meta')).to.deep.equal({ deep: [1, 2] });
      expect(data.get('nodes', 1, 'meta')).to.equal(true);
    });
  });

  describe('dictionary compaction', function () {
    it('keeps the dict bounded when unique strings churn through a column', function () {
      const data = new DataStore();

      // 8 slots repeatedly overwritten with fresh unique values: every
      // write kills the previous value's dict entry
      for (let round = 0; round < 500; round++) {
        for (let slot = 0; slot < 8; slot++) {
          data.set('nodes', slot, 'tag', `v-${round}-${slot}`);
        }
      }

      const col = data.column('nodes', 'tag');

      // 4000 distinct values passed through; only 8 are live
      expect(col.dict.length).to.be.at.most(16);

      for (let slot = 0; slot < 8; slot++) {
        expect(data.get('nodes', slot, 'tag')).to.equal(`v-499-${slot}`);
      }
    });

    it('keeps untouched slots correct across a compaction', function () {
      const data = new DataStore();

      for (let slot = 0; slot < 10; slot++) {
        data.set('nodes', slot, 'k', 'keep-' + slot);
      }
      // kill 6 of the 10 entries (dead 6 > 10/2, past the 8-entry floor)
      for (let slot = 0; slot < 6; slot++) {
        data.set('nodes', slot, 'k', 'keep-9');
      }

      const col = data.column('nodes', 'k');

      expect(col.dict.length).to.equal(4); // keep-6..keep-9

      for (let slot = 6; slot < 10; slot++) {
        expect(data.get('nodes', slot, 'k')).to.equal('keep-' + slot);
      }
      for (let slot = 0; slot < 6; slot++) {
        expect(data.get('nodes', slot, 'k')).to.equal('keep-9');
      }
    });

    it('clearing values (element removal) triggers compaction too', function () {
      const data = new DataStore();

      for (let slot = 0; slot < 12; slot++) {
        data.set('nodes', slot, 'k', 'val-' + slot);
      }
      for (let slot = 0; slot < 8; slot++) {
        data.set('nodes', slot, 'k', undefined);
      }

      const col = data.column('nodes', 'k');

      // compaction ran mid-loop; residual dead entries stay under the
      // trigger (or the 8-entry floor)
      expect(col.dict.length).to.be.at.most(5);

      for (let slot = 8; slot < 12; slot++) {
        expect(data.get('nodes', slot, 'k')).to.equal('val-' + slot);
      }
      for (let slot = 0; slot < 8; slot++) {
        expect(data.get('nodes', slot, 'k')).to.be.undefined;
      }
    });

    it('a dead value re-written later resurrects cleanly', function () {
      const data = new DataStore();

      for (let slot = 0; slot < 10; slot++) {
        data.set('nodes', slot, 'k', 'v-' + slot);
      }

      data.set('nodes', 0, 'k', 'v-1'); // v-0 dead, not yet compacted
      data.set('nodes', 0, 'k', 'v-0'); // resurrects v-0, kills nothing new

      expect(data.get('nodes', 0, 'k')).to.equal('v-0');
      expect(data.column('nodes', 'k').dict.length).to.equal(10);
    });

    it('compacts a wire dict that arrives with unreferenced entries', function () {
      const cy = cytoscape({
        elements: {
          columnar: true,
          nodes: {
            count: 2,
            ids: ['x', 'y'],
            data: {
              kind: {
                dict: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'live-1', 'live-2'],
                indices: new Uint32Array([8, 9]), // only the last two referenced
              },
            },
          },
        },
      });

      const col = cy._store.data.column('nodes', 'kind');

      expect(col.dict).to.deep.equal(['live-1', 'live-2']);
      expect(cy.$id('x').data('kind')).to.equal('live-1');
      expect(cy.$id('y').data('kind')).to.equal('live-2');
    });

    it('exports the compacted dict', function () {
      const data = new DataStore();

      for (let slot = 0; slot < 10; slot++) {
        data.set('nodes', slot, 'k', 'w-' + slot);
      }
      for (let slot = 0; slot < 6; slot++) {
        data.set('nodes', slot, 'k', 'w-9');
      }

      const out = data.exportColumns('nodes', [6, 7, 8, 9]);

      expect(out.k.dict).to.have.length(4);
      expect(out.k.dict[out.k.indices[0] - 1]).to.equal('w-6');
    });
  });

  describe('label mappers', function () {
    it('data(key) labels resolve from the sidecar', function () {
      const cy = cytoscape({
        elements: FIXTURE,
        style: { nodes: { label: 'data(name)' } },
      });

      expect(cy.$id('a').label()).to.equal('Alpha');
      expect(cy.$id('c').label()).to.equal(''); // absent -> no label
    });

    it('numbers stringify in labels', function () {
      const cy = cytoscape({
        elements: FIXTURE,
        style: { nodes: { label: 'data(weight)' } },
      });

      expect(cy.$id('b').label()).to.equal('2.5');
    });

    it('a data write refreshes mapped labels', function () {
      const cy = cytoscape({
        elements: FIXTURE,
        style: { nodes: { label: 'data(name)' } },
      });

      cy.$id('a').data('name', 'Renamed');

      expect(cy.$id('a').label()).to.equal('Renamed');
    });

    it('a write of an unmapped key leaves labels untouched', function () {
      const cy = cytoscape({
        elements: FIXTURE,
        style: { nodes: { label: 'data(name)' } },
      });

      const before = cy.$id('a').label();

      cy.$id('a').data('unrelated', 'x'); // skips the label refresh pass

      expect(cy.$id('a').label()).to.equal(before);
    });

    it('mapped labels auto-refresh on data writes', function () {
      const cy = cytoscape({
        elements: FIXTURE,
        style: { nodes: { label: { data: 'name' } } },
      });

      expect(cy.$id('a').label()).to.equal('Alpha');

      cy.$id('a').data('name', 'Renamed');

      // declarative mapper: the write refreshes the label, gated on 'name'
      expect(cy.$id('a').label()).to.equal('Renamed');

      cy.style().update();

      expect(cy.$id('a').label()).to.equal('Renamed');
    });

    it('removeData of the mapped key clears the label', function () {
      const cy = cytoscape({
        elements: FIXTURE,
        style: { nodes: { label: 'data(name)' } },
      });

      cy.$id('a').removeData('name');

      expect(cy.$id('a').label()).to.equal('');
    });

    it('data(id) still resolves and stays immutable', function () {
      const cy = cytoscape({
        elements: FIXTURE,
        style: { nodes: { label: 'data(id)' } },
      });

      expect(cy.$id('a').label()).to.equal('a');
    });
  });
});
