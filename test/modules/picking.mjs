import { expect } from 'chai';

import {
  Picking,
  PICK_TILE,
  EDGE_PICK_BIT,
} from '../../src/render/picking.mjs';

/*
Unit coverage for the pick staging ring against a fake GPUDevice: the
latest-wins coalescing, and the ring-exhaustion policy — a frame that finds
all staging buffers busy must *defer* the pending request to a later frame
(counted in `deferrals`), never resolve it null.  Spurious nulls are
indistinguishable from background answers at the API (the 2026-08-01
hardware-pass mis-attribution), so the contract is pinned here: null means
background, destroy or device loss only.
*/

const CENTER = (PICK_TILE / 2) * PICK_TILE + PICK_TILE / 2;

function makeFakeBuffer(size) {
  return {
    data: new ArrayBuffer(size),
    mapResolvers: [],
    mapAsync() {
      return new Promise((resolve) => {
        this.mapResolvers.push(resolve);
      });
    },
    getMappedRange() {
      return this.data;
    },
    unmap() {},
    destroy() {},
  };
}

function makeFakeDevice() {
  const buffers = [];

  return {
    buffers,
    createTexture() {
      return {
        createView() {
          return {};
        },
        destroy() {},
      };
    },
    createBuffer(opts) {
      const buffer = makeFakeBuffer(opts.size);

      buffers.push(buffer);

      return buffer;
    },
  };
}

const fakeEncoder = { copyTextureToBuffer() {} };

/** Write an id into the buffer's cursor texel and resolve its mapAsync. */
function landReadback(buffer, id) {
  new Uint32Array(buffer.data)[CENTER] = id;

  const resolve = buffer.mapResolvers.shift();

  expect(resolve, 'a mapAsync must be outstanding').to.exist;
  resolve();
}

function flushMicrotasks() {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('gpu/picking staging ring', function () {
  it('coalesces same-frame requests latest-wins into one slot', async function () {
    const device = makeFakeDevice();
    const picking = new Picking(device);

    const a = picking.request(3, 3);
    const b = picking.request(9, 9); // latest wins: both get this tile

    const copy = picking.encodeCopy(fakeEncoder);

    expect(copy).to.exist;
    expect(picking.hasPending()).to.be.false;

    const finished = picking.finish(copy);

    landReadback(device.buffers[0], (EDGE_PICK_BIT | 7) >>> 0);
    await finished;

    expect(await a).to.equal((EDGE_PICK_BIT | 7) >>> 0);
    expect(await b).to.equal((EDGE_PICK_BIT | 7) >>> 0);

    // one slot consumed, and it was freed on finish
    expect(picking.hasFreeSlot()).to.be.true;

    picking.destroy();
  });

  it('defers on ring exhaustion instead of resolving null', async function () {
    const device = makeFakeDevice();
    const picking = new Picking(device);
    const finishes = [];

    // occupy all ring slots with unresolved readbacks
    for (let i = 0; i < 3; i++) {
      picking.request(i, i);

      const copy = picking.encodeCopy(fakeEncoder);

      expect(copy, `slot ${i} acquires`).to.exist;
      finishes.push(picking.finish(copy));
    }

    expect(picking.hasFreeSlot()).to.be.false;

    // fourth request: the ring is full — the frame must skip the copy and
    // keep the request pending for a later frame
    let settled = false;
    const fourth = picking.request(40, 40).then((id) => {
      settled = true;
      return id;
    });

    expect(picking.encodeCopy(fakeEncoder)).to.be.null;
    expect(picking.hasPending(), 'request survives the full ring').to.be.true;
    expect(picking.deferrals).to.equal(1);

    await flushMicrotasks();
    expect(settled, 'must not resolve null while deferred').to.be.false;

    // a readback lands: its slot frees, and the deferred request goes out
    landReadback(device.buffers[0], 0);
    await finishes[0];
    expect(picking.hasFreeSlot()).to.be.true;

    const copy = picking.encodeCopy(fakeEncoder);

    expect(copy, 'deferred request acquires the freed slot').to.exist;
    expect(picking.hasPending()).to.be.false;

    const finished = picking.finish(copy);

    landReadback(device.buffers[0], (EDGE_PICK_BIT | 12) >>> 0);
    await finished;

    expect(await fourth).to.equal((EDGE_PICK_BIT | 12) >>> 0);

    picking.destroy();
  });

  it('resolves pending requests null on destroy', async function () {
    const device = makeFakeDevice();
    const picking = new Picking(device);

    const pending = picking.request(5, 5);

    picking.destroy();

    expect(await pending).to.be.null;
  });
});
