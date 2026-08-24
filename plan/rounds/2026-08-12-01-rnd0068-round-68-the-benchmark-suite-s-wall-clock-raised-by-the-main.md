## Round 68 — the benchmark suite's wall clock (raised by the maintainer 2026-08-12)

The publish run had grown to about an hour, and the maintainer's
observation was the whole diagnosis: **it uses one core of eight**.
`report.mjs` spawned one job, waited, spawned the next.  Measured on the
65.10 archive, `--all` is 18.4 min of work at `--repeat 1` and so ~55 at
the `--repeat 3` publishing requires — with seven cores idle throughout,
and (measured live, `ps -o nlwp,pcpu`) a bench process wanting only ~1.1
of the one core it has, over 7 threads.

Where the time goes, from that archive — four jobs are 62% of the run:

| job | s | share |
|---|---:|---:|
| `algorithms` N=500 | 206.0 | 18.7% |
| `algorithms` N=500 *(a duplicate — see 68.1)* | 205.6 | 18.6% |
| `surface` N=2000 | 174.9 | 15.8% |
| `algorithms` N=2000 | 93.0 | 8.4% |

### 68.1 — `--all` ran its slowest job twice (2026-08-12)

`algorithms.mjs @ N=500` was listed in **both** `QUICK_JOBS` and
`STANDALONE_JOBS`, and `--all` is quick + standalone.  So the slowest job
in the table ran twice, and the second copy contributed *nothing*:
`rowsOf` (report-compare.mjs) and `toSections` (report-html.mjs) both
keep the first-seen (group, bench) and discard the rest — the duplicate's
rows were parsed, merged and thrown away on every run since the two
tables were split.  206 s per repeat; **10.3 min of a `--repeat 3` run**,
recovered by deleting one line.

### 68.2 — the runner takes the other seven cores (2026-08-12)

`--jobs N` (or `auto`) runs the jobs concurrently: `benchmark/schedule.mjs`
holds the policy, pure and spec'd, and `report.mjs` holds a worker pool.
**The default is 1, and the serial path is unchanged down to the spawn
order**, because that is the condition the whole published archive was
measured in.

`auto` takes one worker per physical core less one, capped at 6, and pins
each with `taskset`.  Both halves are measurements, not guesses: a bench
process is ~1.1 cores, so one-per-core already oversubscribes; and the
physical set comes from `thread_siblings_list` rather than being assumed
to be `0..N-1`, which on this box would put two jobs on cores 0 and 1
(cpu *i* and *i+8* are one core) while four idled.

The three scheduling rules, each chosen against the obvious alternative:

1. **One pool, no barrier between passes.**  The obvious design runs
   every job's pass 1, waits, then pass 2 — and that multiplies the
   longest job by the repeat count *and* pays a barrier at each wave.
   One pool of 72 units pays the chain once.  (What that leaves is
   measured in 68.4, and it is not the 7.5 min this planning note first
   claimed: with rule 3 in force the run is bounded by the longest job's
   own repeat chain, ~11 min, not by total work ÷ workers, 8.4 min.)
2. **Every job's first pass before any job's second**, then longest-first.
   Pure LPT from a cold cache discovers a long job late and hands it the
   tail; a duration cache (`results/.durations.json`, gitignored) carries
   the lengths between runs so the first pass packs too.
3. **A job's repeats do not overlap each other** — softly.  Round 65.11's
   median-of-three assumes three independent samples; three siblings
   running side by side would share one wall-clock neighbourhood on top
   of the machine state.  Soft because parking a worker at the tail costs
   more than the correlation it avoids.

**Not done, deliberately**: splitting the two long suites into `BENCH_OP`
chunks to pack better.  It was in the plan until the arithmetic — the
longest job only binds the schedule above ~13 workers (2694 s ÷ 206 s) —
and it would change what each suite measures (a chunk rebuilds the
fixture and starts cold) while being **invisible to the harness hash**,
since `report.mjs` sits in `NOT_INSTRUMENT` and correctly so.  A
measurement change no fingerprint can see is the exact failure the
fingerprints exist to prevent.  The GPU profiles stay serial and
exclusive — one adapter, one queue, and frame time is the measurement.

### 68.3 — a concurrent run is its own epoch (2026-08-12)

Concurrency is an instrument change the file hashes cannot see, so
`concurrentHash` folds the worker count into each job's harness hash and
the comparison refuses a serial-to-parallel line the way it already
refuses a cross-machine one.  Different worker counts are different
epochs: four-way and eight-way contention are not one condition.

**A serial run is untouched**, and that is verified rather than asserted:
a `--jobs 1` run of `compound` stamps `9e76d83b`, which is exactly what
the three published archive runs carry, while the same suite at `--jobs
2` stamps `9a662dc2`.  `meta.concurrency` records the fact, and the
report grows a provenance row saying the numbers were measured under
contention — because the page is also read on its own, by someone
wondering why every row sits above the archive's.


### 68.4 — measured (2026-08-12)

`--all --repeat 3` on the i9-9900K (8 physical / 16 logical, three qemu
VMs holding their usual ~29% of a core), round-67 HEAD, `--jobs auto`
= 6 workers pinned:

| | wall |
|---|---:|
| before this round (`--repeat 3`, serial, duplicate included) | ~55 min |
| serial with the duplicate removed (derived from the same per-job times) | 44.9 min |
| **`--jobs auto`** | **11.0 min** |

**5.0× against the command that was being run**, 4.1× against a
deduplicated serial run.  Utilisation is 77% of six workers (50.4 min of
unit work in 11.0 min of wall), and the missing quarter is the tail: the
last three units are `algorithms @ 500` pass 2, `surface` pass 3 and
`algorithms @ 500` pass 3, finishing with three cores idle.

**What binds it is the chain, not the packing** — worth a second run to
establish, because the duration cache was written on the assumption that
packing was the problem.  A second `--jobs auto` run with the cache warm
started the six longest jobs first, in the order LPT wants, and finished
in **10.9 min**: 0.1 min different, 77% utilisation again.  The reason is
rule 3.  `algorithms @ 500` takes ~226 s a pass and its three passes may
not overlap, so its chain alone is ~11 min — within a rounding error of
the whole run.  Total work ÷ 6 workers is 8.4 min, and that is what would
be reachable if the chain were broken.

So the cache earns its place by making the *shape* right — long jobs
start first, and the first pass packs like the later ones — rather than
by moving the wall clock, and **the only remaining lever is the one 68.2
declined**: splitting `algorithms @ 500`, or relaxing rule 3, for about
2.5 min.  (Written here as "neither is worth its cost today" — and 68.5
immediately revisits that, because the two options do *not* cost the
same: one edits a suite file and breaks its epoch, the other touches only
the scheduler.  The wrong judgement was treating them as one item.)

**The contention penalty, per job** — parallel pass time against the same
job in the 65.10 serial archive.  Median **1.11×**, and the shape is the
finding:

| | |
|---|---|
| `spatial`, `store`, `surface`, `mappers`, `style-bundle` | 1.02–1.06× |
| `core+collection`, `materializers`, `compaction`, `style`, `algorithms @ 500` | 1.07–1.11× |
| `traversal`, `algorithms @ 2000`, `load` | 1.21–1.28× |
| `layouts` | **1.55×** |

It is **not a uniform slowdown**, so no single correction factor could
turn a parallel number back into a serial one — which is the measured
form of the argument for keeping publishing serial, and worth more than
the wall-clock figure.  (`curves` 1.57× and `labels` 1.48× are excluded
from that reading: both are sub-second one-shot suites where process
startup, not contention, is most of the number.)

**The rule for using it.**  Parallel is for the iteration loop, where the
question is a suite's own v3-vs-v4 ratio — both sides measured seconds
apart in one process, so a uniform slowdown cancels.  **Publishing stays
serial**, and `scripts/benchmark-publish.mjs` now enforces that with a
guard shaped like the dirty-tree one: a run carrying `meta.concurrency >
1` is refused unless `--allow-concurrent`.  The reason is not that the
page would be *wrong* — the epoch hash sees to that — but that it would
be **blind**: every row would read as a break, and, worse, if the
epoch were waved through, contention would widen each row's
`repeatSpread` and the mover screen would file real 10–20% wins as
"inside the row's own run-to-run band" — the band the style rounds live
in.

**Controls**, all landing: the collision tier removed from the picker
fails the two-repeats spec; explore-first removed fails the
unmeasured-job spec; longest-first removed fails two; the exclusive drain
removed fails two more; `concurrentHash` made a no-op fails the two epoch
specs; the provenance row removed fails the concurrency spec.

**Open**: the serial-vs-parallel validation for *publishing*, ~70 min of
machine time at one commit.  Three numbers decide it — the median
row-wise parallel/serial ratio (the per-job spread above says it will not
be one number), the inflation in per-row `repeatSpread`, and how many of
the ~245 rows would still be screenable at a true 10% change.  Until
that is run, the guard stays.

### 68.5 — the chain yields, and the run reaches its work bound (2026-08-12)

68.4 named two ways past the ~11 min chain and judged neither worth its
cost.  That was wrong about the second one, and the correction is cheap
enough to be worth making: **relaxing rule 3 costs nothing that reaches
the archive.**

Splitting `algorithms @ 500` into `BENCH_OP` chunks would have to edit
the suite file, which changes its harness hash — breaking the epoch for
every algorithms row in the archive over a filter that is inert when the
variable is unset.  That is the false break `harness-id.mjs`'s own header
warns about: "a break nobody believes is worse than no break at all".

Relaxing rule 3 touches no suite file and no hash.  `criticalKeys`
computes, from the duration hints, which jobs have a remaining chain
longer than the work left divided among the workers — on this profile,
`algorithms @ 500` and `surface` — and those jobs alone may run their
repeats concurrently.  It affects concurrent runs only (a serial run has
nothing to overlap with), and those already carry their own epoch and are
refused by the publish script, so the correlated band it produces was
never going to reach the archive.  The runner prints which jobs it
applied the exception to, because a narrowed band nobody was told about
is precisely what this harness exists to prevent.

**Measured**, same machine, same profile, `--repeat 3 --jobs auto`:

| | wall | utilisation |
|---|---:|---:|
| serial, before the round | ~55 min | 12% of one core of eight |
| `--jobs auto`, rule 3 absolute (68.2) | 11.0 / 10.9 min | 77% |
| `--jobs auto`, rule 3 yielding (this) | **8.4 min** | **100%** |

100% of six workers, which is the work bound (50.3 min of unit work in
8.4 min of wall) — there is nothing left for a scheduler to win here.
**6.6× against the command that was being run**, 5.3× against a
deduplicated serial run.

**The cost, looked for and not found at this sample size.**  The worry is
that overlapped repeats share a wall-clock neighbourhood and so report a
narrower `repeatSpread` than the truth.  Comparing the run that
overlapped against the run that did not, per-suite median bands: the two
critical suites narrowed (`algorithms` 1.086 -> 1.060, `surface` 1.073 ->
1.058) — but so did two suites that were *not* overlapped (`style` 1.085
-> 1.065, `traversal` 1.086 -> 1.051), while `core+collection` held flat
and `spatial` widened.  The movement is inside the band statistic's own
run-to-run variation, so this comparison does not isolate the effect.
The mechanism is still real and the exception is still announced; what
cannot be claimed is that it was measured to be harmless.
