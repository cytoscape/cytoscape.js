import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { ColumnTable } from '../src/store/table.mjs';
import { COLUMN_SPECS } from '../src/contract.mjs';
import {
  adapterBufferLimits,
  bindableBytes,
  dispatchableSlots,
  groupUnfit,
} from '../src/device-fit.mjs';

/*
Round 138 (PLAN.md items 35–36): growth past the mounted device's limits
makes `cy.add()` throw a `GpuUnfitError`, the store unchanged.

The renderer reports its device's fit to the core (`cy._gpuFit`) once
the mirror exists; these specs stand in for a device by writing that
report on a headless instance, small enough that the boundary is a few
hundred slots.  The browser half — that a real device's limits reach
`_gpuFit`, and that the ceiling they give is where `cy.add()` starts to
throw — is `playwright-tests/limits.spec.js`.
*/

/** A device whose storage binding holds `slots` 16-byte slots. */
const fitFor = (slots, workgroups = 65535) => ({
  limits: {
    maxBufferSize: 2 ** 30,
    maxStorageBufferBindingSize: slots * 16,
    maxComputeWorkgroupsPerDimension: workgroups,
  },
  nodes: { column: 'node.outerGeom', bytes: 16 },
  edges: { column: 'edge.curveParams', bytes: 16 },
});

const nodes = (n, prefix = 'n') =>
  Array.from({ length: n }, (_, i) => ({ data: { id: `${prefix}${i}` } }));

/** The store's observable state, for "nothing changed". */
const snapshot = (cy) => ({
  nodes: cy.nodes().length,
  edges: cy.edges().length,
  nodeCap: cy._store.capacity('nodes'),
  edgeCap: cy._store.capacity('edges'),
  nodeHigh: cy._store.highWater('nodes'),
  idCounter: cy._idCounter,
});

describe('device fit: the table growth rule (round 138)', function () {
  it('predicts reserve(): free slots first, then ×2 growth', function () {
    const specs = COLUMN_SPECS.filter((s) => s.group === 'nodes');
    const table = new ColumnTable('nodes', specs, 32);

    for (let i = 0; i < 30; i++) {
      table.alloc();
    }

    table.freeSlot(3);
    table.freeSlot(7);

    expect(table.growthFor(2)).to.deep.equal({ highWater: 30, capacity: 32 });
    expect(table.growthFor(4)).to.deep.equal({ highWater: 32, capacity: 32 });
    expect(table.growthFor(5)).to.deep.equal({ highWater: 33, capacity: 64 });
    expect(table.growthFor(100)).to.deep.equal({
      highWater: 128,
      capacity: 128,
    });
    // a removal ahead of the add frees slots first
    expect(table.growthFor(5, 1)).to.deep.equal({
      highWater: 32,
      capacity: 32,
    });

    // the prediction is what an add does
    const predicted = table.growthFor(100);
    const { slots } = table.allocBulk(100);

    expect(slots.length).to.equal(100);
    expect(table.highWater).to.equal(predicted.highWater);
    expect(table.cap).to.equal(predicted.capacity);
  });
});

describe('device fit: the limits (round 138)', function () {
  it('requests the adapter’s own values', function () {
    const adapter = {
      limits: {
        maxBufferSize: 4294967296,
        maxStorageBufferBindingSize: 4294967292,
        maxComputeWorkgroupsPerDimension: 65535,
        maxTextureDimension2D: 16384,
      },
    };

    expect(adapterBufferLimits(adapter)).to.deep.equal({
      maxBufferSize: 4294967296,
      maxStorageBufferBindingSize: 4294967292,
      maxComputeWorkgroupsPerDimension: 65535,
    });
  });

  it('binds the smaller of the buffer and binding limits; dispatches 256-wide', function () {
    const limits = fitFor(1024, 4).limits;

    expect(bindableBytes(limits)).to.equal(16384);
    expect(bindableBytes({ ...limits, maxBufferSize: 100 })).to.equal(100);
    expect(dispatchableSlots(limits)).to.equal(1024);
  });

  it('names the column, the bytes and the limit that bind', function () {
    const { limits } = fitFor(1024);
    const widest = { column: 'node.outerGeom', bytes: 16 };

    expect(groupUnfit('nodes', 1024, 1024, widest, limits)).to.equal(null);
    expect(groupUnfit('nodes', 1025, 2048, widest, limits)).to.equal(
      "grow the nodes table to 2048 slots, and its 'node.outerGeom' column " +
        "to a 32768-byte buffer — past this device's 16384-byte storage " +
        'binding limit',
    );
    expect(
      groupUnfit('nodes', 1025, 2048, widest, {
        ...limits,
        maxBufferSize: 16000,
      }),
    ).to.match(/16000-byte buffer limit$/);
    expect(
      groupUnfit('edges', 600, 1024, widest, fitFor(1024, 2).limits),
    ).to.equal(
      'put 600 slots in the edges table — past the 512 one dispatch can ' +
        'cover on this device (2 workgroups of 256)',
    );
  });
});

describe('device fit: cy.add() refuses growth past the device (round 138)', function () {
  let cy;

  beforeEach(function () {
    cy = cytoscape({ elements: nodes(10) });
    cy._gpuFit = fitFor(1024);
  });

  afterEach(function () {
    cy.destroy();
  });

  it('adds up to the ceiling', function () {
    cy.add(nodes(1014, 'm'));

    expect(cy.nodes().length).to.equal(1024);
    expect(cy._store.capacity('nodes')).to.equal(1024);
  });

  it('throws a GpuUnfitError one past it, and adds nothing', function () {
    const before = snapshot(cy);
    let adds = 0;

    cy.on('add', () => adds++);

    let caught = null;

    try {
      cy.add(nodes(1015, 'm'));
    } catch (err) {
      caught = err;
    }

    expect(caught).to.be.instanceOf(cytoscape.GpuUnfitError);
    expect(caught.name).to.equal('GpuUnfitError');
    expect(caught.message).to.equal(
      'cy.add(): adding 1015 nodes would grow the nodes table to 2048 ' +
        "slots, and its 'node.outerGeom' column to a 32768-byte buffer — " +
        "past this device's 16384-byte storage binding limit; nothing was " +
        'added',
    );
    expect(snapshot(cy)).to.deep.equal(before);
    expect(adds).to.equal(0);
    expect(cy.getElementById('m0').length).to.equal(0);
  });

  it('counts an edge-only add against the edge table', function () {
    cy._gpuFit = fitFor(64);

    expect(() =>
      cy.add(
        Array.from({ length: 65 }, (_, i) => ({
          data: { id: `e${i}`, source: 'n0', target: 'n1' },
        })),
      ),
    ).to.throw(
      cytoscape.GpuUnfitError,
      /adding 65 edges .* 'edge.curveParams'/,
    );
    expect(cy.edges().length).to.equal(0);
  });

  it('reuses freed slots before it grows', function () {
    cy.add(nodes(1014, 'm'));
    cy.remove(cy.nodes().slice(0, 5));

    // five freed slots: five fit, six do not
    cy.add(nodes(5, 'r'));

    expect(() => cy.add(nodes(1, 'x'))).to.throw(cytoscape.GpuUnfitError);
  });

  it('refuses the columnar and the wire forms the same way', function () {
    const columnar = {
      columnar: true,
      nodes: { count: 1015, positions: new Float32Array(2030) },
    };

    expect(() => cy.add(columnar)).to.throw(
      cytoscape.GpuUnfitError,
      /^cy\.add\(\): adding 1015 nodes/,
    );

    const wire = cytoscape.serializeElements(nodes(1015, 'w'));

    expect(() => cy.add(wire)).to.throw(cytoscape.GpuUnfitError);
    expect(cy.nodes().length).to.equal(10);
  });

  it('holds the dispatch reach as well as the bytes', function () {
    // 4 workgroups of 256: 1024 slots; the bytes allow 4096
    cy._gpuFit = fitFor(4096, 4);

    expect(() => cy.add(nodes(1015, 'm'))).to.throw(
      cytoscape.GpuUnfitError,
      /put 1025 slots in the nodes table — past the 1024 one dispatch/,
    );
  });

  it('refuses a cy.load() chunk whole', async function () {
    const before = snapshot(cy);
    let caught = null;

    try {
      await cy.load([nodes(1015, 'm')]);
    } catch (err) {
      caught = err;
    }

    expect(caught).to.be.instanceOf(cytoscape.GpuUnfitError);
    expect(caught.message).to.match(/^cy\.load\(\): adding 1015 nodes/);
    expect(snapshot(cy)).to.deep.equal(before);
  });

  it('refuses a cy.patch() net of its own removals', function () {
    const keep = nodes(10);

    // reconcile: 10 survive, 1014 added — fits exactly
    cy.patch(keep.concat(nodes(1014, 'm')));
    expect(cy.nodes().length).to.equal(1024);

    // drop 4, add 5: one past the ceiling — refused, nothing removed
    const payload = nodes(10).slice(4).concat(nodes(1014, 'm'), nodes(5, 'p'));
    const before = snapshot(cy);

    expect(() => cy.patch(payload)).to.throw(
      cytoscape.GpuUnfitError,
      /^cy\.patch\(\): adding 5 nodes/,
    );
    expect(snapshot(cy)).to.deep.equal(before);
    expect(cy.getElementById('n0').length).to.equal(1);

    // drop 5, add 5: fits
    cy.patch(nodes(10).slice(5).concat(nodes(1014, 'm'), nodes(5, 'p')));
    expect(cy.nodes().length).to.equal(1024);
  });

  it('checks nothing headless or after unmount', function () {
    cy._gpuFit = null;
    cy.add(nodes(5000, 'h'));

    expect(cy.nodes().length).to.equal(5010);
  });
});
