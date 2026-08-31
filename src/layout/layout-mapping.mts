import { ascending } from '../util/sort.mjs';
import type { Core } from '../core.mjs';
import type { Collection } from '../collection.mjs';
import type {
  LayoutScoreMapping,
  LayoutSortMapping,
} from '../public-types.mjs';

/*
The data-driven layout mapping spellings (round 85.3, #1514).  Five
layout params take per-element values; the census (recorded in the
round) found exactly two shapes among them:

  score — `{ data, scale?, range?, invert?, default? }` on
    `force.edgeLength` and `concentric.concentric`.  Bare `{ data }`
    is a passthrough (the value *is* the score/length); with `range`,
    the column's extent is normalized through `scale`
    ('linear' | 'log' | 'sqrt') into `[range[0], range[1]]`, and
    `invert: true` flips it — the "large scores mapped to shorter
    edge lengths" recipe in one literal.

  sort — `{ data, order? }` on `grid.sort`, `circle.sort` and
    `breadthfirst.depthSort`: order by one column, missing values
    last, ties broken on the id — deterministic where a hand-rolled
    comparator often is not.

The function forms all stay as escape hatches; these objects are the
canonical, serializable spellings.  Everything resolves **once at
layout start** — there is no live refresh, which is why this is ~80
lines and not the style mapper IR.  Validation fails loudly: an
unknown key, a wrong-kind column, or `scale`/`invert` without a
`range` throws naming the option and the key — silent defaulting is
how a typo'd key would lay out plausibly wrong.  The kind vocabulary
('number' | 'string' | 'mixed') is the store's own.
*/

/** Is the value a `{ data, … }` score-mapping object? */
export const isScoreMapping = (value: unknown): value is LayoutScoreMapping =>
  value != null &&
  typeof value === 'object' &&
  typeof (value as { data?: unknown }).data === 'string';

/** Is the value a `{ data, order? }` sort-mapping object? */
export const isSortMapping = (value: unknown): value is LayoutSortMapping =>
  value != null &&
  typeof value === 'object' &&
  typeof (value as { data?: unknown }).data === 'string';

const SCALES: Record<string, (v: number) => number> = {
  linear: (v) => v,
  log: (v) => Math.log(v),
  sqrt: (v) => Math.sqrt(v),
};

/**
 * Validate a score mapping's shape, loudly.
 *
 * @param spec — the mapping object
 * @param optionName — the layout option it spells, for the message
 * @throws when `scale` names no known scale, when `range` is not a
 *   two-number array, or when `scale`/`invert` appear without a
 *   `range` — without one the data value is the score itself and
 *   there is nothing to scale or flip
 */
export const validateScoreMapping = (
  spec: LayoutScoreMapping,
  optionName: string,
): void => {
  if (spec.scale != null && SCALES[spec.scale] == null) {
    throw new Error(
      `The ${optionName} mapping's scale '${String(spec.scale)}' is unknown — ` +
        `use 'linear', 'log' or 'sqrt'`,
    );
  }

  if (
    spec.range != null &&
    (!Array.isArray(spec.range) ||
      spec.range.length !== 2 ||
      typeof spec.range[0] !== 'number' ||
      typeof spec.range[1] !== 'number')
  ) {
    throw new Error(
      `The ${optionName} mapping's range must be [min, max] numbers`,
    );
  }

  if (spec.range == null && (spec.scale != null || spec.invert != null)) {
    throw new Error(
      `The ${optionName} mapping needs a range to use scale or invert — ` +
        `without one the data value is the ${optionName} itself`,
    );
  }
};

/**
 * Assert the mapping's column exists and is numeric.
 *
 * @param cy — the core whose store holds the column
 * @param group — the element group the option reads
 * @param spec — the mapping object
 * @param optionName — the layout option it spells, for the message
 * @throws when no such column was ever written (a typo'd key must not
 *   lay out plausibly wrong on defaults), or when the column's kind is
 *   string or mixed — a numeric column is required
 */
export const checkScoreColumn = (
  cy: Core,
  group: 'nodes' | 'edges',
  spec: LayoutScoreMapping,
  optionName: string,
): void => {
  const kind = cy._store.data.kind(group, spec.data);

  if (kind == null) {
    throw new Error(
      `The ${optionName} mapping reads data key '${spec.data}', ` +
        `but no such ${group} data column exists`,
    );
  }

  if (kind !== 'number') {
    throw new Error(
      `The ${optionName} mapping reads data key '${spec.data}', ` +
        `but its column is ${kind} — a number column is required`,
    );
  }
};

/**
 * Resolve a score mapping over pre-read column values, once.  A bare
 * `{ data }` passes values through; with `range` the present values'
 * extent is normalized through `scale` into the range (`invert`
 * flipping it).  A missing value — absent, or non-finite under its
 * scale, such as a non-positive value under 'log' — takes
 * `spec.default`, else `fallback`.  A degenerate extent (all present
 * values equal) lands everything at the range's midpoint.
 *
 * @param values — one raw column value per element, in caller order
 * @param spec — the validated mapping object
 * @param fallback — the option's own default, when `spec.default` is
 *   also absent
 * @returns one resolved score per element, same order
 */
export const resolveScores = (
  values: readonly unknown[],
  spec: LayoutScoreMapping,
  fallback: number,
): Float64Array => {
  const out = new Float64Array(values.length);
  const missing = spec.default ?? fallback;

  const scale = SCALES[spec.scale ?? 'linear'];
  const scaled = new Float64Array(values.length);
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < values.length; i++) {
    const raw = values[i];
    const s = typeof raw === 'number' ? scale(raw) : NaN;

    scaled[i] = s;

    if (Number.isFinite(s)) {
      min = Math.min(min, s);
      max = Math.max(max, s);
    }
  }

  if (spec.range == null) {
    for (let i = 0; i < values.length; i++) {
      const raw = values[i];

      out[i] = typeof raw === 'number' && Number.isFinite(raw) ? raw : missing;
    }

    return out;
  }

  const [lo, hi] = spec.range;
  const span = max - min;

  for (let i = 0; i < values.length; i++) {
    const s = scaled[i];

    if (!Number.isFinite(s)) {
      out[i] = missing;
      continue;
    }

    let t = span > 0 ? (s - min) / span : 0.5;

    if (spec.invert === true) {
      t = 1 - t;
    }

    out[i] = lo + t * (hi - lo);
  }

  return out;
};

/**
 * Build the comparator a `{ data, order? }` sort mapping spells:
 * order by one column, missing values last regardless of direction,
 * ties broken ascending on the id — deterministic by construction.
 *
 * @param cy — the core whose store holds the column
 * @param spec — the mapping object
 * @param optionName — the layout option it spells, for the message
 * @returns a comparator over node handles
 * @throws when no such nodes column exists, or when its kind is
 *   mixed — a number or string column is required to order by
 */
export const sortComparator = (
  cy: Core,
  spec: LayoutSortMapping,
  optionName: string,
): ((a: Collection, b: Collection) => number) => {
  const kind = cy._store.data.kind('nodes', spec.data);

  if (kind == null) {
    throw new Error(
      `The ${optionName} mapping reads data key '${spec.data}', ` +
        `but no such nodes data column exists`,
    );
  }

  if (kind === 'mixed') {
    throw new Error(
      `The ${optionName} mapping reads data key '${spec.data}', ` +
        `but its column is mixed — a number or string column is required`,
    );
  }

  const sign = spec.order === 'descending' ? -1 : 1;
  const key = spec.data;

  return (a: Collection, b: Collection): number => {
    const va = a.data(key) as number | string | undefined;
    const vb = b.data(key) as number | string | undefined;
    const aMissing = va == null;
    const bMissing = vb == null;

    if (aMissing || bMissing) {
      // missing values sort last regardless of direction
      return aMissing === bMissing
        ? ascending(a.id() as string, b.id() as string)
        : aMissing
          ? 1
          : -1;
    }

    const diff =
      kind === 'number'
        ? (va as number) - (vb as number)
        : ascending(va as string, vb as string);

    return diff !== 0
      ? sign * diff
      : ascending(a.id() as string, b.id() as string);
  };
};
