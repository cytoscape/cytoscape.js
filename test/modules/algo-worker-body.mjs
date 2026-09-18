import { expect } from 'chai';
import { createRequire } from 'node:module';
import { Worker } from 'node:worker_threads';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { _algoWorkerSource } from '../../src/algorithms/algo-workers.mjs';

/*
Round 74.4: the worker entry is carried as source text, and this is
where that claim can actually break.

The pool stringifies `algoWorkerBody` and evaluates it inside a worker
whose scope holds nothing but the port adapter.  Three things can put
a free identifier into that text without any spec in `test/` noticing,
because those specs run the body under tsx through the pool, which
defines the one helper it knows about (`__name`):

  - a transpiler helper other than `__name` (tsx, or oxc under a
    future target) wrapping something in the body;
  - a minifier hoisting a constant or a helper out of the function in
    the minified bundles;
  - a refactor that references a module-level constant from inside the
    body — the easiest of the three to write by accident.

So this file takes the *complete* worker source — the pool's own
`_algoWorkerSource(true)`, reached through the bundle's
`__algoWorkerSource__` for each built artifact and directly under tsx
— and evaluates it with `new Function` in a scope that supplies only
`process`, then drives it through a fake port.  Any other free
identifier is a ReferenceError here.  One real `worker_threads` worker
is also spun up per source and pinged, so the eval-mode worker
semantics (the parent port through `process.getBuiltinModule`, which
holds whether the eval source is read as CJS or as ESM) stay verified
on the pinned Node.

Needs the built bundles (`test:modules` builds first).
*/

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const require = createRequire(import.meta.url);

/** A minimal port: records replies, hands the body one request. */
const fakePort = () => {
  const replies = [];
  let handler = null;

  return {
    replies,
    send: (msg) => handler(msg),
    on: (h) => {
      handler = h;
    },
    postMessage: (msg) => replies.push(msg),
  };
};

/** Evaluate the Node-flavored source in a bare scope. */
const evaluateBare = (src) => {
  const port = fakePort();
  const fakeProcess = {
    getBuiltinModule: (id) => {
      expect(id).to.equal('node:worker_threads');

      return {
        parentPort: {
          on: (event, h) => {
            expect(event).to.equal('message');
            port.on(h);
          },
          postMessage: port.postMessage,
        },
      };
    },
  };

  // `new Function` sees only its parameters and the global scope — no
  // module scope, no closure: a helper the transpiler injected into the
  // body is a ReferenceError at the first message that reaches it.
  // `process` is shadowed by the fake so the port is ours.
  new Function('process', src)(fakeProcess);

  return port;
};

/** Drive the body through every message kind, asserting each reply. */
const exercise = (port) => {
  port.send({ type: 'ping', id: 1 });
  expect(port.replies[0]).to.deep.equal({ type: 'pong', id: 1 });

  // a 4-node path a—b—c—d with unit weights: b and c each lie on two
  // pairs, counted in both directions (the reference's convention) — 4
  const rowPtr = Int32Array.from([0, 1, 3, 5, 6]);
  const colIdx = Int32Array.from([1, 0, 2, 1, 3, 2]);

  port.send({
    type: 'snapshot',
    id: 2,
    snapshot: { kind: 'brandes', n: 4, rowPtr, colIdx, w: null },
  });
  expect(port.replies[1]).to.deep.equal({ type: 'ready', id: 2 });

  port.send({ type: 'job', id: 3, s0: 0, s1: 4 });
  expect(port.replies[2].type).to.equal('done');
  expect(Array.from(port.replies[2].out)).to.deep.equal([0, 4, 4, 0]);

  // the weighted walk, through the heap: a—b costs 5, a—c via b costs 6
  port.send({
    type: 'snapshot',
    id: 4,
    snapshot: {
      kind: 'brandes',
      n: 4,
      rowPtr,
      colIdx,
      w: Float64Array.from([5, 5, 1, 1, 1, 1]),
    },
  });
  port.send({ type: 'job', id: 5, s0: 0, s1: 4 });
  expect(Array.from(port.replies[4].out)).to.deep.equal([0, 4, 4, 0]);

  port.send({
    type: 'snapshot',
    id: 6,
    snapshot: { kind: 'closeness', n: 4, rowPtr, colIdx, harmonic: true },
  });
  port.send({ type: 'job', id: 7, s0: 1, s1: 3 });
  // node b: 1 + 1 + 1/2; node c: the same by symmetry
  expect(Array.from(port.replies[6].out)).to.deep.equal([2.5, 2.5]);

  // a snapshot of an unknown kind fails loudly rather than answering
  // zeros
  port.send({ type: 'snapshot', id: 8, snapshot: { kind: 'nope', n: 1 } });
  port.send({ type: 'job', id: 9, s0: 0, s1: 1 });
  expect(port.replies[8].type).to.equal('error');
};

/** Spin a real eval-mode worker on the source and ping it. */
const pingRealWorker = (src) =>
  new Promise((resolvePing, reject) => {
    const w = new Worker(src, { eval: true });
    const timer = setTimeout(() => {
      void w.terminate();
      reject(new Error('the worker never answered the ping'));
    }, 10000);

    w.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    w.on('message', (msg) => {
      clearTimeout(timer);
      void w.terminate();
      resolvePing(msg);
    });
    w.postMessage({ type: 'ping', id: 42 });
  });

const bundles = [
  ['cytoscape.esm.mjs', 'esm'],
  ['cytoscape.esm.min.mjs', 'esm'],
  ['cytoscape.umd.js', 'cjs'],
  ['cytoscape.min.js', 'cjs'],
  ['cytoscape.cjs.js', 'cjs'],
];

const loadBundle = async (file, kind) => {
  const path = join(ROOT, 'build', file);

  if (kind === 'esm') {
    return (await import(pathToFileURL(path).href)).default;
  }

  return require(path);
};

describe('the algorithm worker body travels as self-contained source (round 74.4)', function () {
  it('the control: a free identifier in the source is a ReferenceError here', function () {
    const src = _algoWorkerSource(true).replace(
      'port.on(',
      'notDefinedAnywhere; port.on(',
    );

    expect(() => evaluateBare(src)).to.throw(
      ReferenceError,
      /notDefinedAnywhere/,
    );
  });

  it('under tsx: the source evaluates bare and answers every message', function () {
    exercise(evaluateBare(_algoWorkerSource(true)));
  });

  it('under tsx: a real worker_threads worker answers the ping', async function () {
    const reply = await pingRealWorker(_algoWorkerSource(true));

    expect(reply).to.deep.equal({ type: 'pong', id: 42 });
  });

  for (const [file, kind] of bundles) {
    describe(`from build/${file}`, function () {
      let source;
      let browserSource;

      before(async function () {
        const cytoscape = await loadBundle(file, kind);

        expect(
          cytoscape.__algoWorkerSource__,
          'the bundle carries the source hook',
        ).to.be.a('function');
        source = cytoscape.__algoWorkerSource__(true);
        browserSource = cytoscape.__algoWorkerSource__(false);
      });

      it('evaluates bare and answers every message', function () {
        exercise(evaluateBare(source));
      });

      it('a real worker_threads worker answers the ping', async function () {
        const reply = await pingRealWorker(source);

        expect(reply).to.deep.equal({ type: 'pong', id: 42 });
      });

      it('the browser flavor evaluates bare against a fake `self`', function () {
        const port = fakePort();
        const self = {
          addEventListener: (event, h) => {
            expect(event).to.equal('message');
            port.on((msg) => h({ data: msg }));
          },
          postMessage: port.postMessage,
        };

        new Function('self', browserSource)(self);
        exercise(port);
      });
    });
  }
});
