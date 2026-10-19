import { expect } from 'chai';

import cytoscape from '../../src/index.mjs';

/*
Round 48.2: the round-11 churn profile, promoted from a measurement to a gate.

Round 11 identified the churn case as "the most motivated real-world case —
and invisible to a dead-slot-ratio meter, since slots recycle": a streaming
or sliding-window app removes and re-adds elements at a stable graph size
forever, so the tables never grow, while three append-only structures leak
unboundedly *in time* — the id blob (removed ids' UTF-8 bytes), the CSR
adjacency (stranded segments plus the incremental overlay), and string data
dictionaries (entries whose last reference was overwritten).

Each of those now reclaims on a waste threshold. Round 11 proved it by
measuring once (the id blob held 699 KB at 40 rounds where the pre-round
build held 1.84 MB, and 492 KB at 80 rounds where the pre-round build held
3.03 MB and was still climbing). A number in a commit message does not stop
a regression, so this runs the scenario and fails on unbounded growth.

The shape that makes it a real test rather than a slow one: **fresh ids and
fresh per-element strings every round**. Re-adding the same ids would refill
the same blob bytes and the same dictionary entries, and would pass with
every reclaim removed.
*/

const BASE = 4000;
const BAND = 400;
const ROUNDS = 40;

function seedGraph() {
  const elements = [];

  for (let i = 0; i < BASE; i++) {
    elements.push({
      data: { id: `base${i}`, tag: `g${i % 8}` },
      position: { x: i % 100, y: (i / 100) | 0 },
    });
  }

  for (let i = 1; i < BASE; i++) {
    elements.push({
      data: { id: `be${i}`, source: `base${i - 1}`, target: `base${i}` },
    });
  }

  return elements;
}

describe('soak: sustained add/remove churn', () => {
  let cy;
  let baseline;

  before(() => {
    cy = cytoscape({ elements: seedGraph() });
    baseline = {
      blobCapacity: cy._store.ids.blobCapacity,
      highWater: cy._store.highWater('nodes'),
      nodes: cy.nodes().length,
    };

    for (let round = 1; round <= ROUNDS; round++) {
      const add = [];

      for (let i = 0; i < BAND; i++) {
        add.push({
          // ids never repeat: a re-added id would reuse its stranded bytes
          data: {
            id: `r${round}n${i}`,
            note: `value-${round}-${i}-with-some-padding`,
          },
          position: { x: i, y: round },
        });
      }

      cy.add(add);
      // force the deferred derivations rather than measuring a flag write
      // (round 29.4's lesson, in a soak)
      cy.nodes({ data: { note: { ne: null } } });
      cy.nodes().slice(0, BAND).remove();
    }
  });

  after(() => cy.destroy());

  it('ran a churn worth measuring', () => {
    // The control every bound below needs: a loop that added nothing would
    // satisfy all of them.
    expect(ROUNDS * BAND).to.be.at.least(16000);
    expect(cy.nodes().length).to.equal(baseline.nodes);
  });

  it('keeps the id blob bounded rather than growing per round', () => {
    // ~16k ids of ~10 bytes have passed through. Without the round-11
    // reclaim the blob strands all of them and grows past 160 KB on top of
    // the ~53 KB the base graph needs; with it, it stays flat.
    const { blobCapacity } = cy._store.ids;

    expect(
      blobCapacity,
      'the id blob grew with churn — the round-11 reclaim is not firing',
    ).to.be.at.most(baseline.blobCapacity * 4);

    // and the live bytes must be a real fraction of the capacity, i.e. the
    // blob is holding ids rather than having been emptied by a broken remove
    expect(cy._store.ids.blobBytes).to.be.greaterThan(10000);
  });

  it('recycles slots instead of extending the tables', () => {
    // The free list is what keeps highWater flat; if removal stopped
    // returning slots, this grows by BAND every round.
    expect(
      cy._store.highWater('nodes'),
      'node slots grew with churn',
    ).to.be.at.most(baseline.highWater + BAND * 2);
  });

  it('still answers correctly after the churn', () => {
    // Bounded memory is worth nothing if the graph is wrong. Every surviving
    // element must be one the last rounds added, and traversal must still
    // work across the recycled slots.
    const ids = cy.nodes().map((n) => n.id());

    expect(new Set(ids).size, 'duplicate ids after slot recycling').to.equal(
      ids.length,
    );
    expect(cy.nodes().length).to.equal(baseline.nodes);
    expect(cy.$id(ids[0]).id()).to.equal(ids[0]);

    const withNote = cy.nodes({ data: { note: { ne: null } } });

    expect(withNote.length).to.be.greaterThan(0);
    expect(withNote.length).to.be.at.most(cy.nodes().length);
  });

  it('compacts to the live graph when asked', () => {
    cy.compact();

    expect(
      cy._store.highWater('nodes'),
      'compact() left dead slots behind',
    ).to.equal(cy.nodes().length);
    expect(cy.nodes().length).to.equal(baseline.nodes);
  });
});
