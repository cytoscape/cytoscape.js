/*
The label shaping memo's store (round 138): bounded, two generations.

Round 16.3's memo shares one laid block between identical (text, wrap
params) labels, and round 25.5 leans on it for a font-size tween's
per-tick rebuild.  It was an unbounded `Map` that only a font change
cleared — so a session that churns labels (every add brings a text the
memo has not seen, every remove leaves one behind) grew it without end.
The renderer soak (PLAN.md item 34) measured it: ~20 entries and ~15 KB
of reachable heap per churn cycle, linear over 3,000 cycles, with the
GPU ledger flat.

Two generations keep the working set and drop the rest: entries land in
`young`; a lookup that finds one in `old` promotes it; when `young`
reaches `generation` entries it becomes `old` and the previous `old` is
dropped whole.  So at most `2 × generation` entries are held, anything
used within the last generation survives, and every operation is O(1) —
no per-hit reordering, which the tween's per-tick hits would pay.
*/

/** The bounded key → value store behind the shaping memo. */
export class GenerationalMemo<V> {
  private young = new Map<string, V>();
  private old = new Map<string, V>();
  private generation: number;

  /**
   * @param generation — entries per generation; at most twice this many
   *   are held
   */
  constructor(generation: number) {
    this.generation = generation;
  }

  /** Entries held now (both generations). */
  get size(): number {
    return this.young.size + this.old.size;
  }

  /**
   * The value for `key`, promoting it to the young generation when it
   * was found in the old one.
   *
   * @param key — the memo key
   * @returns the value, or undefined when neither generation holds it
   */
  get(key: string): V | undefined {
    const hit = this.young.get(key);

    if (hit !== undefined) {
      return hit;
    }

    const aged = this.old.get(key);

    if (aged !== undefined) {
      this.old.delete(key);
      this.set(key, aged);
    }

    return aged;
  }

  /**
   * Store a value in the young generation, rolling the generations when
   * it is full.
   *
   * @param key — the memo key
   * @param value — the value
   */
  set(key: string, value: V): void {
    this.young.set(key, value);

    if (this.young.size >= this.generation) {
      this.old = this.young;
      this.young = new Map();
    }
  }

  /** Drop both generations (a font change: every block is stale). */
  clear(): void {
    this.young.clear();
    this.old.clear();
  }
}
