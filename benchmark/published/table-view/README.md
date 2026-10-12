# Round 84 table-view raw measurements

This directory holds standalone raw JSON runs from
`benchmark/table-view.mjs`. Each file records one independent Node process,
its machine/runtime and source fingerprints, raw timing samples, per-window
trace samples, heap estimates, materialized payload counts, and correctness
controls.

These files are not part of the indexed benchmark-series format in
`../README.md`. The benchmark report and published index do
not read or aggregate them; the round-84 plan record interprets the runs.
They define no pass/fail performance budget.

Reproduce a run after `npm run build` with, for example:

```sh
mise exec -- node --expose-gc benchmark/table-view.mjs \
  --nodes 10000 --repeat 5 \
  --json benchmark/published/table-view/round84-10k-run1.json
```

Use Node 24 as pinned by `.nvmrc`. Run the 10k, 100k, and 1m sizes in
separate serial processes on an otherwise quiet machine. The JSON's
`approximateNetHeapAndArrayBufferDeltaBeforeGCBytes` is noisy net live memory
growth before forced GC, not total allocation;
`retainedHeapAndArrayBufferBytesAfterGC` measures what remains live with the
result held. Typed payload bytes, JavaScript array slots, and dictionary
entries are recorded separately to expose materialization volume.

In this sandbox, the benchmark child process could not spawn `git`. The
archived files preserve the captured `gitHead: null` and add
`externallyVerifiedGitHead` with provenance: the shell verified the same head
after the nine-run set, and root confirmed no commits during the exclusive
timing window. The harness remained uncommitted; its SHA-256 fingerprint and
the source/bundle hashes identify the exact instrument and subject.
