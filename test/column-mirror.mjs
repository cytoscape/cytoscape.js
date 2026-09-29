import { expect } from 'chai';
import { GraphStore } from '../src/store/graph-store.mjs';
import { ColumnMirror } from '../src/render/column-mirror.mjs';
import { COLUMN_SPECS, columnSpec } from '../src/contract.mjs';

// ColumnMirror range logic tested against a mock GPUQueue/device.

const makeMockDevice = () => {
  const writes = [];
  const buffers = [];
  let workDoneResolvers = [];

  const device = {
    createBuffer(descriptor) {
      const buffer = {
        label: descriptor.label,
        size: descriptor.size,
        usage: descriptor.usage,
        destroyed: false,
        destroy() {
          this.destroyed = true;
        },
      };

      buffers.push(buffer);

      return buffer;
    },
    queue: {
      writeBuffer(buffer, bufferOffset, data, dataOffset, size) {
        writes.push({ buffer, bufferOffset, dataOffset, size });
      },
      onSubmittedWorkDone() {
        return new Promise((resolve) => workDoneResolvers.push(resolve));
      },
    },
  };

  return {
    device,
    writes,
    buffers,
    flushWorkDone() {
      for (const resolve of workDoneResolvers) {
        resolve();
      }
      workDoneResolvers = [];
    },
  };
};

const drain = () => new Promise((resolve) => setTimeout(resolve, 0));

/** the lazily-allocated columns (round 138) */
const LAZY = ['node.gradient', 'edge.gradient'];

describe('gpu/render: ColumnMirror', function () {
  var store, mock, mirror;

  beforeEach(function () {
    store = new GraphStore();
    store.addNode('a', 1, 2);
    store.addNode('b', 3, 4);
    store.addEdge('ab', 'a', 'b');
    store.takeDelta();

    mock = makeMockDevice();
    mirror = new ColumnMirror(mock.device, store);
  });

  it('creates one buffer per contract column, sized to capacity', function () {
    // + 4: the curve param blob (12b), the custom-polygon blob (13 C3),
    // the background-image record blob (15.3) and the chart blob (23)
    expect(mock.buffers).to.have.length(COLUMN_SPECS.length + 4);

    for (const spec of COLUMN_SPECS) {
      const buffer = mirror.buffer(spec.id);
      const cap = store.capacity(spec.group);

      // round 138: the gradient columns are one-record placeholders
      // until some slot names a gradient
      expect(buffer.size).to.equal(
        LAZY.includes(spec.id) ? spec.bytesPerSlot : cap * spec.bytesPerSlot,
      );
    }
  });

  it('fully uploads on construction', function () {
    // one full-array write per column (a placeholder takes none)
    expect(mock.writes).to.have.length(COLUMN_SPECS.length - LAZY.length);

    for (const write of mock.writes) {
      expect(write.bufferOffset).to.equal(0);
    }
  });

  it('uploads dirty spans at the correct byte offsets', function () {
    mock.writes.length = 0;

    store.setPosition(1, 50, 60);

    mirror.sync(store.takeDelta());

    expect(mock.writes).to.have.length(1);

    const write = mock.writes[0];
    const bps = columnSpec('node.position').bytesPerSlot;

    expect(write.buffer).to.equal(mirror.buffer('node.position'));
    expect(write.bufferOffset).to.equal(1 * bps);
    expect(write.size).to.equal(1 * bps);
  });

  it('skips span uploads for GPU-owned columns, but realloc re-uploads them', function () {
    mock.writes.length = 0;

    mirror.setGpuOwned(['node.fillColor']);
    store.setColor('node.fillColor', 0, 1, 2, 3, 4);
    store.setPosition(1, 50, 60);

    mirror.sync(store.takeDelta());

    expect(mock.writes).to.have.length(1);
    expect(mock.writes[0].buffer).to.equal(mirror.buffer('node.position'));

    // capacity growth still uploads the CPU base of owned columns in full
    // (the renderer schedules a full re-eval on resize)
    for (let i = 0; i < 200; i++) {
      store.addNode('grow' + i, 0, 0);
    }

    mock.writes.length = 0;
    mirror.sync(store.takeDelta());

    expect(
      mock.writes.some(
        (write) =>
          write.buffer === mirror.buffer('node.fillColor') &&
          write.bufferOffset === 0,
      ),
    ).to.be.true;
  });

  it('re-uploads a column whole when it leaves GPU ownership (round 143)', function () {
    mirror.setGpuOwned(['node.fillColor']);
    store.setColor('node.fillColor', 0, 1, 2, 3, 4);
    mirror.sync(store.takeDelta()); // the owned span is skipped

    mock.writes.length = 0;
    mirror.setGpuOwned([]);

    // the kernel's bytes were what the buffer held; the CPU truth,
    // skipped while owned, goes up in one write from offset 0
    const bps = columnSpec('node.fillColor').bytesPerSlot;

    expect(mock.writes).to.have.length(1);
    expect(mock.writes[0].buffer).to.equal(mirror.buffer('node.fillColor'));
    expect(mock.writes[0].bufferOffset).to.equal(0);
    expect(mock.writes[0].size).to.equal(store.capacity('nodes') * bps);

    // a column that stays owned, or was never owned, is not re-uploaded
    mirror.setGpuOwned(['node.fillColor']);
    mock.writes.length = 0;
    mirror.setGpuOwned(['node.fillColor']);
    expect(mock.writes).to.have.length(0);
  });

  it('uploads coalesced spans as one write', function () {
    mock.writes.length = 0;

    store.setPosition(0, 5, 5);
    store.setPosition(1, 6, 6);

    mirror.sync(store.takeDelta());

    const bps = columnSpec('node.position').bytesPerSlot;

    expect(mock.writes).to.have.length(1);
    expect(mock.writes[0].bufferOffset).to.equal(0);
    expect(mock.writes[0].size).to.equal(2 * bps);
  });

  it('reallocates and fully re-uploads on group resize', function () {
    const cap = store.capacity('nodes');

    for (let i = store.count('nodes'); i <= cap; i++) {
      store.addNode('n' + i, 0, 0);
    }

    const versionBefore = mirror.version;
    const nodeColumns = COLUMN_SPECS.filter(
      (spec) => spec.group === 'nodes' && !LAZY.includes(spec.id),
    );

    mock.writes.length = 0;
    mirror.sync(store.takeDelta());

    expect(mirror.version).to.be.above(versionBefore);

    // every node column re-uploaded in full at the new capacity
    for (const spec of nodeColumns) {
      const buffer = mirror.buffer(spec.id);

      expect(buffer.size).to.equal(store.capacity('nodes') * spec.bytesPerSlot);

      const fullWrite = mock.writes.find(
        (write) => write.buffer === buffer && write.bufferOffset === 0,
      );

      expect(fullWrite, spec.id).to.exist;
    }

    // no span-writes into old (reallocated) node buffers
    for (const write of mock.writes) {
      expect(write.buffer.destroyed).to.be.false;
    }
  });

  it('defers destroying old buffers until submitted work completes', async function () {
    const oldBuffer = mirror.buffer('node.position');
    const cap = store.capacity('nodes');

    for (let i = store.count('nodes'); i <= cap; i++) {
      store.addNode('n' + i, 0, 0);
    }

    mirror.sync(store.takeDelta());

    expect(oldBuffer.destroyed).to.be.false; // still potentially bound by in-flight frames

    mock.flushWorkDone();
    await drain();

    expect(oldBuffer.destroyed).to.be.true;
    expect(mirror.buffer('node.position').destroyed).to.be.false;
  });

  it('leaves untouched-group buffers alone on resize', function () {
    const edgeBuffer = mirror.buffer('edge.endpoints');
    const cap = store.capacity('nodes');

    for (let i = store.count('nodes'); i <= cap; i++) {
      store.addNode('n' + i, 0, 0);
    }

    mirror.sync(store.takeDelta());

    expect(mirror.buffer('edge.endpoints')).to.equal(edgeBuffer);
  });

  it('accumulates uploaded byte stats', function () {
    const before = mirror.uploadedBytes;

    store.setPosition(0, 9, 9);
    mirror.sync(store.takeDelta());

    expect(mirror.uploadedBytes).to.equal(
      before + columnSpec('node.position').bytesPerSlot,
    );
  });

  it('destroys all buffers on destroy()', function () {
    mirror.destroy();

    for (const buffer of mock.buffers) {
      expect(buffer.destroyed).to.be.true;
    }
  });
});

describe('gpu/render: ColumnMirror fits the device (round 138)', function () {
  const STOPS = [
    { rgba: 0xff0000ff, pos: 0 },
    { rgba: 0x0000ffff, pos: 1 },
  ];
  const CHART = {
    kind: 0,
    size: 1,
    hole: 0,
    startAngle: 0,
    direction: 0,
    opacity: 1,
    values: [1, 2, 3],
    colors: [
      [255, 0, 0, 1],
      [0, 255, 0, 1],
      [0, 0, 255, 1],
    ],
  };

  var store, mock;

  beforeEach(function () {
    store = new GraphStore();

    for (let i = 0; i < 8; i++) {
      store.addNode('n' + i, i, i);
    }

    store.addEdge('e', 'n0', 'n1');
    store.takeDelta();
    mock = makeMockDevice();
  });

  it('allocates a gradient column only when a gradient arrives', function () {
    const mirror = new ColumnMirror(mock.device, store);
    const placeholder = mirror.buffer('node.gradient');
    const version = mirror.version;

    expect(placeholder.size).to.equal(32);
    expect(mirror.isMaterialised('node.gradient')).to.equal(false);

    // a solid record (kind 0) writes the column and allocates nothing
    store.setGradient('node.gradient', 2, 0, 0, []);
    mock.writes.length = 0;
    mirror.sync(store.takeDelta());

    expect(mock.writes.filter((w) => w.buffer === placeholder)).to.deep.equal(
      [],
    );
    expect(mirror.buffer('node.gradient')).to.equal(placeholder);

    // a linear gradient allocates the column at capacity, uploaded whole
    store.setGradient('node.gradient', 3, 1, 0, STOPS);
    mock.writes.length = 0;
    mirror.sync(store.takeDelta());

    const full = mirror.buffer('node.gradient');

    expect(mirror.isMaterialised('node.gradient')).to.equal(true);
    expect(full.size).to.equal(store.capacity('nodes') * 32);
    expect(
      mock.writes.some((w) => w.buffer === full && w.bufferOffset === 0),
    ).to.equal(true);
    expect(mirror.version).to.be.above(version);
    // the edge column is untouched
    expect(mirror.buffer('edge.gradient').size).to.equal(32);
  });

  it('allocates at construction when the store already carries a gradient', function () {
    store.setGradient('edge.gradient', 0, 2, 0, STOPS);
    store.takeDelta();

    const mirror = new ColumnMirror(mock.device, store);

    expect(mirror.isMaterialised('edge.gradient')).to.equal(true);
    expect(mirror.buffer('edge.gradient').size).to.equal(
      store.capacity('edges') * 32,
    );
    expect(mirror.isMaterialised('node.gradient')).to.equal(false);
  });

  it('holds the widest column a group cannot draw without — not the gradient', function () {
    const mirror = new ColumnMirror(mock.device, store);

    expect(mirror.widest('nodes').bytes).to.equal(16);
    expect(mirror.widest('edges').bytes).to.equal(16);

    // the control: the contract's widest column is the 32-byte gradient
    const widestSpec = (group) =>
      Math.max(
        ...COLUMN_SPECS.filter((s) => s.group === group).map(
          (s) => s.bytesPerSlot,
        ),
      );

    expect(widestSpec('nodes')).to.equal(32);
    expect(widestSpec('edges')).to.equal(32);
  });

  it('declines a gradient column past maxBytes: a placeholder, reported once', function () {
    const unfit = [];
    const mirror = new ColumnMirror(mock.device, store, {
      // every column fits; a 32-byte-a-slot gradient at this capacity does not
      maxBytes: store.capacity('nodes') * 32 - 1,
      onUnfit: (u) => unfit.push(u),
    });

    store.setGradient('node.gradient', 1, 1, 0, STOPS);
    mirror.sync(store.takeDelta());

    expect(unfit).to.deep.equal([
      {
        label: 'cy-gpu:node.gradient',
        bytes: store.capacity('nodes') * 32,
      },
    ]);
    expect(mirror.isMaterialised('node.gradient')).to.equal(false);
    expect(mirror.buffer('node.gradient').size).to.equal(32);

    // later gradient spans are skipped, and not re-reported
    store.setGradient('node.gradient', 2, 1, 0, STOPS);
    mock.writes.length = 0;
    mirror.sync(store.takeDelta());

    expect(unfit).to.have.length(1);
    expect(mock.writes).to.deep.equal([]);
  });

  it('drops a materialised gradient column the group outgrows', function () {
    const unfit = [];

    store.setGradient('node.gradient', 1, 1, 0, STOPS);
    store.takeDelta();

    const cap = store.capacity('nodes');
    const mirror = new ColumnMirror(mock.device, store, {
      maxBytes: cap * 32, // fits now, not after one doubling
      onUnfit: (u) => unfit.push(u),
    });

    expect(mirror.isMaterialised('node.gradient')).to.equal(true);

    for (let i = store.count('nodes'); i <= cap; i++) {
      store.addNode('grow' + i, 0, 0);
    }

    mirror.sync(store.takeDelta());

    expect(unfit.map((u) => u.label)).to.deep.equal(['cy-gpu:node.gradient']);
    expect(mirror.buffer('node.gradient').size).to.equal(32);
    // the essential columns grew as ever
    expect(mirror.buffer('node.outerGeom').size).to.equal(
      store.capacity('nodes') * 16,
    );
  });

  it('declines a blob past maxBytes: a placeholder, its spans skipped', function () {
    const unfit = [];
    const initial = Math.max(
      store.curveBlob().byteLength,
      store.polyBlob().byteLength,
      store.imageBlob().byteLength,
      store.chartBlob().byteLength,
      4,
    );
    const mirror = new ColumnMirror(mock.device, store, {
      maxBytes: initial,
      onUnfit: (u) => unfit.push(u),
    });
    const version = mirror.version;

    expect(unfit).to.deep.equal([]);

    for (let slot = 0; store.chartBlob().byteLength <= initial; slot++) {
      store.addNode('c' + slot, 0, 0);
      store.setChart(store.lookup('c' + slot).slot, CHART);
    }

    mirror.sync(store.takeDelta());

    expect(unfit.map((u) => u.label)).to.deep.equal(['cy-gpu:chart-blob']);
    expect(unfit[0].bytes).to.equal(store.chartBlob().byteLength);
    expect(mirror.chartBlobBuffer().size).to.equal(4);
    expect(mirror.version).to.be.above(version);

    // a chart span after the refusal writes nothing into the placeholder
    store.setChart(0, CHART);
    mock.writes.length = 0;
    mirror.sync(store.takeDelta());

    expect(
      mock.writes.filter((w) => w.buffer === mirror.chartBlobBuffer()),
    ).to.deep.equal([]);
  });

  it('swaps a buffer the device refused for a placeholder (dropFailed)', function () {
    const mirror = new ColumnMirror(mock.device, store);
    const version = mirror.version;

    expect(mirror.dropFailed('cy-gpu:curve-blob')).to.equal(true);
    expect(mirror.blobBuffer().size).to.equal(4);
    expect(mirror.dropFailed('cy-gpu:edge.gradient')).to.equal(true);
    expect(mirror.buffer('edge.gradient').size).to.equal(32);
    expect(mirror.version).to.be.above(version);

    // a core column has no placeholder: the renderer holds its frame
    expect(mirror.dropFailed('cy-gpu:node.position')).to.equal(false);
  });
});
