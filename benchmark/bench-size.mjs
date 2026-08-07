// The benchmark run size, and the constants derived from it.
//
// Split out of `graph.mjs` because this is the one thing in there that
// needs no library.  `graph.mjs` imports both v3 and v4 to build its
// `makeV3` / `makeGpu` factories, so anything importing it evaluates both
// libraries — and `bench-run.mjs` wants only `N`.  That pulled v3's whole
// dependency tree into `test/modules/benchmark-report.mjs`, a spec about
// rendering an HTML report, which then needed v3's `heap` installed to
// read the number 2000.
//
// `graph.mjs` re-exports these, so the twenty suites that import them from
// there are unaffected and there is still one definition of each.

/** Node count, overridable so a run can be scaled: `BENCH_N=5000 npm run benchmark` */
export const N = Number(process.env.BENCH_N) || 2000;

/** The index of the middle node — the one the single-element rows address. */
export const MIDNUM = Math.floor(N / 2);

/** That node's id. */
export const MID = 'n' + MIDNUM;
