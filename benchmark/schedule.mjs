// Round 68: what order the benchmark jobs run in, and which may overlap.
//
// The runner spawned one process at a time and waited, so a 25-job `--all
// --repeat 3` used **one core of eight for 55 minutes** while the other seven
// idled.  This module is the scheduling half of fixing that: pure, so the
// policy can be tested without spawning anything, and separate from
// `report.mjs` for the same reason `repeat-merge.mjs` is — it decides what a
// published number was measured *beside*, which is not a detail.
//
// Three rules, and each exists because the obvious alternative measures worse:
//
//   1. **A unit is one (job, pass), and the pool never barriers between
//      passes.**  A wave barrier — run every job's pass 1, wait, then pass 2 —
//      reimposes the serial floor: the longest job is 206 s, so three barriered
//      waves cannot finish faster than 10.3 min no matter how many cores are
//      free.  One pool of 72 units over 6 workers is bounded by total work
//      instead: 7.5 min.
//   2. **Pass 1 of every job runs before pass 2 of any job** (`explore`), then
//      the rest is longest-first.  Two reasons: a job's repeats end up spread
//      across the run rather than adjacent, and a duration measured in pass 1
//      is what makes the later passes packable at all.
//   3. **A job's repeats do not run concurrently with each other** — softly.
//      Round 65.11 traced the bistable rows to per-process JIT and heap state,
//      which repeats sample independently by construction; under concurrency
//      they would also share a *wall-clock neighbourhood*, and three siblings
//      running side by side see one machine state rather than three.  Soft in
//      two places: when nothing else is runnable the collision is taken rather
//      than the worker parked, and the rule yields for whichever job's chain is
//      longer than the work left over the workers (`criticalKeys`) — because
//      round 68.4 measured that chain, not the packing, deciding the run.
//
// What this module does not decide is whether a concurrent run may be compared
// against a serial one.  It may not — see `harness-id.mjs`'s `concurrentHash`.

import { cpus } from 'node:os';
import { readProbe, runProbe } from '../scripts/machine-info.mjs';

/**
 * How many workers `--jobs auto` picks: one per physical core, less one.
 *
 * Measured rather than guessed: a bench process is **7 threads at ~109% CPU**
 * (V8's background compile and GC helpers), so eight jobs on eight physical
 * cores already oversubscribes the box and spills onto the hyperthread
 * siblings — which is the configuration `playwright.config.js` documents
 * failing for the same reason.  The spare core also absorbs whatever else the
 * machine is doing; on the machine this was written for, three qemu VMs hold a
 * steady ~29% of one core.
 */
export const AUTO_WORKER_HEADROOM = 1;

/** `--jobs auto` never exceeds this, however many cores are present. */
export const AUTO_WORKER_CAP = 6;

/**
 * The key a duration hint is stored under: what makes two runs of a job the
 * same measurement.  The `op` matters — `mutators.mjs` at 200k is eight
 * processes whose durations differ by an order of magnitude.
 *
 * @param job — a job table entry (`{ file, n, op }`)
 * @returns the hint key
 */
export function hintKey(job) {
  return `${job.file}@${job.n ?? ''}${job.op != null ? `@${job.op}` : ''}`;
}

/**
 * Expand a Linux CPU list — `0-3,8` — into its ids.
 *
 * @param text — the list, as sysfs writes it
 * @returns the ids, in the order written
 */
export function expandCpuList(text) {
  const out = [];

  for (const part of String(text ?? '')
    .trim()
    .split(',')) {
    const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);

    if (m == null) {
      continue;
    }

    const from = Number(m[1]);
    const to = m[2] != null ? Number(m[2]) : from;

    for (let i = from; i <= to; i++) {
      out.push(i);
    }
  }

  return out;
}

/**
 * One logical cpu per *physical* core, given each cpu's sibling list.
 *
 * Pinning to `0..workers-1` is wrong on a hyperthreaded machine: here cpu 0
 * and cpu 8 are one core, so a naive pin puts two jobs on one core's execution
 * units while another core idles.  Taking the first id of each distinct
 * sibling group gives the physical set.
 *
 * @param siblingLists — the contents of every
 *   `/sys/devices/system/cpu/cpuN/topology/thread_siblings_list`, in cpu
 *   order; nulls (an unreadable cpu) are skipped
 * @returns the representative cpu id per physical core, ascending
 */
export function parsePhysicalCores(siblingLists) {
  const groups = new Set();
  const cores = [];

  for (const text of siblingLists) {
    const ids = expandCpuList(text);

    if (ids.length === 0) {
      continue;
    }

    const sig = [...ids].sort((a, b) => a - b).join(',');

    if (groups.has(sig)) {
      continue;
    }

    groups.add(sig);
    cores.push(Math.min(...ids));
  }

  return cores.sort((a, b) => a - b);
}

/**
 * Probe the machine's physical cores.  Never throws: an unreadable topology
 * (macOS, Windows, a container without sysfs) answers the empty list, and the
 * caller runs unpinned.
 *
 * @param read — the sysfs reader (testing); `readProbe` by default
 * @param count — how many logical cpus to look at (testing)
 * @returns the representative cpu id per physical core, or `[]`
 */
export function physicalCores(read = readProbe, count = cpus().length) {
  const lists = [];

  for (let i = 0; i < count; i++) {
    lists.push(
      read(`/sys/devices/system/cpu/cpu${i}/topology/thread_siblings_list`),
    );
  }

  return parsePhysicalCores(lists);
}

/**
 * Is `taskset` available to pin with?  Never throws.
 *
 * @param probe — the command runner (testing)
 * @returns true when pinning is possible
 */
export function canPin(probe = runProbe) {
  return probe('taskset', ['--version']) != null;
}

/**
 * How many workers to run, from the `--jobs` value.
 *
 * @param value — the flag's value: a number, `auto`, or null (serial)
 * @param cores — the physical core list (testing)
 * @returns the worker count, at least 1
 */
export function resolveWorkers(value, cores = physicalCores()) {
  if (value == null) {
    return 1;
  }

  if (String(value).toLowerCase() === 'auto') {
    const usable = Math.max(1, cores.length - AUTO_WORKER_HEADROOM);

    return Math.min(AUTO_WORKER_CAP, usable);
  }

  return Math.max(1, Number(value) || 1);
}

/**
 * The unit list: one entry per (job, pass).
 *
 * Order is the tie-break the picker falls back on, and it differs by mode
 * deliberately.  **Serial runs keep the job-major order the archive was
 * measured in** — job 1's three passes, then job 2's — so `--jobs 1` spawns
 * exactly the sequence it always has.  A concurrent run is pass-major, which
 * is rule 2 above.
 *
 * @param jobs — the job table, in declaration order
 * @param repeat — how many passes per job
 * @param passMajor — true for the concurrent order
 * @returns the units, in queue order
 */
export function planUnits(jobs, repeat, passMajor = false) {
  const units = [];
  const push = (job, index, pass) =>
    units.push({
      job,
      index,
      pass,
      key: hintKey(job),
      // the renderer bench drives a real GPU through one browser: it measures
      // frame time, so anything sharing the machine with it corrupts the
      // number it exists to produce
      exclusive: job.browser === true,
    });

  if (passMajor) {
    for (let pass = 0; pass < repeat; pass++) {
      jobs.forEach((job, index) => push(job, index, pass));
    }
  } else {
    jobs.forEach((job, index) => {
      for (let pass = 0; pass < repeat; pass++) {
        push(job, index, pass);
      }
    });
  }

  return units;
}

/**
 * The jobs whose remaining repeats are what the run is waiting for.
 *
 * Rule 3 keeps a job's repeats apart, and round 68.4 measured what that costs:
 * with `algorithms @ 500` at ~226 s a pass, its three passes end-to-end are
 * ~11 min while the whole run's work over six workers is 8.4 — so the pool
 * finished at 11.0 and 10.9 min in two runs that differed in nothing else.
 * The chain was the wall clock, and no amount of packing could touch it.
 *
 * So the rule yields for exactly the jobs that cause that: one whose remaining
 * chain (its unstarted passes, back to back) is longer than the work left
 * divided among the workers.  Everything else keeps its repeats apart.
 *
 * The cost is named rather than hidden — a job scheduled this way has repeats
 * measured side by side, so its run-to-run band is narrower than the truth.
 * That is survivable *here* and nowhere else: a concurrent run already carries
 * its own harness epoch and is refused by the publish script, so the band it
 * reports was never going to reach the archive.  `report.mjs` prints which
 * jobs it applied to.
 *
 * @param pending — the units not yet started
 * @param hints — `Map<hintKey, durationMs>`
 * @param workers — how many run at once
 * @returns the set of hint keys whose repeats may overlap
 */
export function criticalKeys(pending, hints, workers) {
  const chain = new Map();
  let work = 0;

  for (const unit of pending) {
    const d = hints.get(unit.key);

    if (d == null) {
      continue; // an unmeasured job is not yet known to be anything
    }

    chain.set(unit.key, (chain.get(unit.key) ?? 0) + d);
    work += d;
  }

  const bound = work / Math.max(1, workers);
  const critical = new Set();

  for (const [key, total] of chain) {
    if (total > bound) {
      critical.add(key);
    }
  }

  return critical;
}

/**
 * Rank two pending units.  Lower sorts first.
 *
 * The tiers, in order: an exclusive unit last (it wants the machine to
 * itself, and gets it at the end); a unit colliding with a running repeat of
 * its own job last-but-one (rule 3, unless that job is the critical chain);
 * an unmeasured unit before a measured one (rule 2 — explore, then exploit);
 * measured units longest-first, which is LPT and is what keeps a 206 s job
 * from starting last.
 */
function rank(unit, { colliding, duration }) {
  return [
    unit.exclusive ? 1 : 0,
    colliding ? 1 : 0,
    duration == null ? 0 : 1,
    duration == null ? 0 : -duration,
    unit.pass,
    unit.index,
  ];
}

function compareRanks(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return a[i] - b[i];
    }
  }

  return 0;
}

/**
 * Which pending unit a freed worker should take.
 *
 * @param pending — the units not yet started
 * @param running — the units currently running
 * @param hints — `Map<hintKey, durationMs>`: what this run (or the last one)
 *   measured for that job
 * @param critical — hint keys whose repeats may overlap (`criticalKeys`);
 *   empty means rule 3 applies to everything
 * @returns the index into `pending`, or -1 when nothing may start yet — which
 *   happens only around an exclusive unit, where the answer is to let the
 *   machine drain rather than to start something beside it
 */
export function pickNext(
  pending,
  { running = [], hints = new Map(), critical = new Set() } = {},
) {
  if (pending.length === 0 || running.some((u) => u.exclusive)) {
    return -1;
  }

  const busy = new Set(running.map((u) => u.key));
  let best = -1;
  let bestRank = null;

  pending.forEach((unit, at) => {
    const r = rank(unit, {
      colliding: busy.has(unit.key) && !critical.has(unit.key),
      duration: hints.get(unit.key) ?? null,
    });

    if (bestRank == null || compareRanks(r, bestRank) < 0) {
      best = at;
      bestRank = r;
    }
  });

  // an exclusive unit runs alone: hold the queue until the pool has drained
  // rather than starting the next-best unit beside it, which would leave it to
  // start last against a busy machine
  if (pending[best].exclusive && running.length > 0) {
    return -1;
  }

  return best;
}
