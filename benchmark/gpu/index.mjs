// v3-vs-GPU API benchmark runner (Mitata).
//
//   npm run benchmark:gpu           # default N=2000 nodes
//   BENCH_N=10000 npm run benchmark:gpu
//
// Importing the suites registers their groups; run() executes them all.

import { run } from 'mitata';
import './core.mjs';
import './collection.mjs';

await run();
