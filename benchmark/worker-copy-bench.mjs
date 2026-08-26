// Round 86.1's measure-first gate: the per-frame copy cost of a
// worker-hosted renderer.
//
// Under `renderer: { worker: true }` every dirty span crosses a thread
// boundary each frame: copy out of the canonical column, postMessage,
// copy into the worker's local column.  The worst case is a CPU-side
// position writer (a CPU layout tick, a CPU-channel position tween, a
// whole-graph drag): it dirties a span covering most of `node.position`
// every frame.  This bench prices that case at harness scale and beyond,
// so the design commits to (or away from) the copy design on a number
// rather than a hope.
//
//   node benchmark/worker-copy-bench.mjs
//
// What each row prices, per simulated frame:
//   slice        — the main-side copy out of the canonical Float32Array
//   clone rt     — postMessage round-trip, structured clone (no transfer);
//                  the receiver copies into a persistent local column
//   transfer rt  — postMessage round-trip with the buffer transferred
//                  (a fresh slice per frame — the canonical column cannot
//                  be given away), receiver copy included
// The round trip is measured as sustained throughput over FRAMES frames
// with one message in flight at a time (the renderer's own coalescing
// discipline), so a row is ms per frame under a steady 60 Hz writer, not
// a cold single-shot.  worker_threads postMessage and browser
// postMessage share the structured-clone/transfer machinery; 86.4's
// browser row confirms in situ.
//
// The row would not move if the copy were free; the control is the
// byte count itself — doubling n must roughly double the row, and it
// does (see the round record).

import { Worker } from 'node:worker_threads';

const FRAMES = 300;
const WARMUP = 30;

// ndex-x-large is 19,607 nodes / 464,657 edges; the position column is
// n×2 f32.  The larger sizes price the scale ceiling (ledger item 35).
const SIZES = [
  { name: 'ndex-x-large nodes', n: 19607 },
  { name: '100k nodes', n: 100_000 },
  { name: '500k nodes', n: 500_000 },
];

const workerSrc = `
  const { parentPort } = require('node:worker_threads');
  let local = null; // the worker-side persistent column
  parentPort.on('message', (msg) => {
    if (msg.init != null) {
      local = new Float32Array(msg.init);
      parentPort.postMessage(0);
      return;
    }
    // receiver copy into the persistent local column (what the
    // RemoteModelView does so cull/draw read stable arrays)
    const src = new Float32Array(msg.bytes);
    local.set(src, msg.start * 2);
    parentPort.postMessage(0);
  });
`;

const fmt = (ms) => ms.toFixed(3).padStart(8);

const run = async () => {
  const worker = new Worker(workerSrc, { eval: true });
  const ack = () => new Promise((resolve) => worker.once('message', resolve));

  console.log(
    'per-frame cost of a full node.position span (n×2 f32), ' +
      `median of ${FRAMES} frames after ${WARMUP} warmup:`,
  );
  console.log(
    'rows: slice = main-side copy; clone rt / transfer rt = postMessage ' +
      'round trip incl. receiver copy',
  );

  for (const { name, n } of SIZES) {
    const col = new Float32Array(n * 2);

    for (let i = 0; i < col.length; i++) {
      col[i] = i * 0.5;
    }

    worker.postMessage({ init: n * 2 * 4 });
    await ack();

    const bytes = n * 2 * 4;
    const median = (samples) => {
      samples.sort((a, b) => a - b);

      return samples[samples.length >> 1];
    };

    // slice only
    {
      const samples = [];

      for (let f = 0; f < FRAMES + WARMUP; f++) {
        const t0 = performance.now();
        const copy = col.slice(0, n * 2);
        const t1 = performance.now();

        if (copy[1] !== 0.5) {
          throw new Error('copy broke');
        }
        if (f >= WARMUP) {
          samples.push(t1 - t0);
        }
      }

      console.log(
        `${name.padEnd(20)} ${(bytes / 1024).toFixed(0).padStart(6)} KiB  ` +
          `slice ${fmt(median(samples))} ms`,
      );
    }

    // clone round trip (no transfer): the slice survives main-side
    {
      const samples = [];

      for (let f = 0; f < FRAMES + WARMUP; f++) {
        const t0 = performance.now();
        const copy = col.slice(0, n * 2);

        worker.postMessage({ start: 0, bytes: copy.buffer });
        await ack();

        const t1 = performance.now();

        if (f >= WARMUP) {
          samples.push(t1 - t0);
        }
      }

      console.log(`${''.padEnd(32)}clone rt ${fmt(median(samples))} ms`);
    }

    // transfer round trip: the fresh slice's buffer moves, not copies
    {
      const samples = [];

      for (let f = 0; f < FRAMES + WARMUP; f++) {
        const t0 = performance.now();
        const copy = col.slice(0, n * 2);

        worker.postMessage({ start: 0, bytes: copy.buffer }, [copy.buffer]);
        await ack();

        const t1 = performance.now();

        if (f >= WARMUP) {
          samples.push(t1 - t0);
        }
      }

      console.log(`${''.padEnd(29)}transfer rt ${fmt(median(samples))} ms`);
    }
  }

  await worker.terminate();
};

await run();
