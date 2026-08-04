// v3-vs-GPU API benchmark runner (Mitata).
//
//   npm run benchmark           # default N=2000 nodes
//   BENCH_N=10000 npm run benchmark
//
// Importing the suites registers their groups; run() executes them all.

import { finishRun } from './bench-run.mjs';
import './core.mjs';
import './collection.mjs';

await finishRun( 'core+collection' );
