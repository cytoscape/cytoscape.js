// Collection's read-only style surface (round 130 split): `style`,
// `renderedStyle`, the effective opacity and the padded/outer dims.

import { GROUP_NODES, COL, FLAG_PARENT } from '../contract.mjs';
import { normalizeProp as normalizeCss } from '../style.mjs';
import { PROP } from '../style-props.mjs';
import { RENDERED_LENGTH_PROPS } from './shared.mjs';
import type { Collection } from '../collection.mjs';

/** The `style()` implementation behind its overloads: read one prop, read all props, or set a bypass from a name/value pair or an object. */
export function style(
  self: Collection,
  name?: string | Record<string, unknown>,
  value?: unknown,
): unknown {
  const objectForm = name != null && typeof name !== 'string';

  if (value !== undefined || objectForm) {
    const props = objectForm
      ? (name as Record<string, unknown>)
      : { [name as string]: value };
    const engine = self._cy.style();
    const store = self._store;

    for (let i = 0; i < self.length; i++) {
      const ele = self[i];
      const ref = ele.__refs[0];

      if (ref == null || !store.isCurrent(ref)) {
        continue;
      }

      engine.setBypass(ref, ele.id() as string, props);
    }

    return self;
  }

  const ref = self._first();

  if (ref == null || !self._store.isCurrent(ref)) {
    return undefined;
  }

  const engine = self._cy.style();

  return name == null ? engine.readProps(ref) : engine.readProp(ref, name);
}

/**
 * Remove per-element style bypasses from every element (round 63.4 —
 * v3's `removeStyle`).  The sheet-resolved values return through the
 * normal apply, transitions included.
 *
 * @param name — the property to un-bypass, dash-case or camelCase;
 *   omit to clear each element's whole bypass declaration
 * @returns this collection, for chaining
 */
export function removeStyle(self: Collection, name?: string): Collection {
  const engine = self._cy.style();
  const store = self._store;

  for (let i = 0; i < self.length; i++) {
    const ele = self[i];
    const ref = ele.__refs[0];

    if (ref == null || !store.isCurrent(ref)) {
      continue;
    }

    engine.removeBypass(ref, ele.id() as string, name);
  }

  return self;
}

/**
 * Like `style()`, but with length props (width, height, border-width,
 * font-size) scaled into rendered (on-screen) px by the zoom.
 *
 * @param name — a property name; omit for the whole group
 * @returns the rendered-space value, or the whole group's props
 */
export function renderedStyle(self: Collection, name?: string): unknown {
  const value = name == null ? self.style() : self.style(name);

  if (value === undefined) {
    return undefined;
  }

  const zoom = self._cy.zoom() as number;

  if (name != null) {
    return RENDERED_LENGTH_PROPS.has(normalizeCss(name))
      ? (value as number) * zoom
      : value;
  }

  const props = value as Record<string, string | number>;

  for (const prop of RENDERED_LENGTH_PROPS) {
    if (typeof props[prop] === 'number') {
      props[prop] = (props[prop] as number) * zoom;
    }
  }

  return props;
}

/**
 * The numeric value of a numeric style prop.
 *
 * @param name — a numeric style property
 * @returns the number, or undefined when the collection is empty or the
 *   prop belongs to the other group
 * @throws if the prop resolves to a colour or a keyword rather than a number
 */
export function numericStyle(
  self: Collection,
  name: string,
): number | undefined {
  const value = self.style(name);

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'number') {
    throw new Error(`The style property '${name}' is not numeric`);
  }

  return value;
}

/** The rendered opacity: a node's own opacity times its ancestors'
 * (v3's product rule — the store keeps the folded value in the
 * column, round 14.4); an edge's own opacity (edges have no parent).
 *
 * @returns the opacity actually rendered, which is what `transparent()`
 *   tests against 0 — not the declared `opacity` style value, which
 *   `style('opacity')` reads; undefined when empty or removed
 */
export function effectiveOpacity(self: Collection): number | undefined {
  const ref = self.__refs[0];
  const store = self._store;

  if (ref == null || !store.isCurrent(ref)) {
    return undefined;
  }

  if (ref.group === GROUP_NODES && store.hasCompounds()) {
    return (store.column(COL.NODE_OPACITY) as Float32Array)[ref.slot];
  }

  // stored truth is the effective value on the flat path; the one case
  // the column cannot answer is a kernel-owned opacity mapper, whose
  // stored bytes go stale (round 62.6 — the same gate readProp keeps)
  if (!self._cy._styleEngine.ownsProp(ref.group, PROP.OPACITY)) {
    return ref.group === GROUP_NODES
      ? (store.nodes.column(COL.NODE_OPACITY) as Float32Array)[ref.slot]
      : (store.edges.column(COL.EDGE_OPACITY) as Float32Array)[ref.slot];
  }

  return self.numericStyle(PROP.OPACITY);
}

/**
 * v3-parity accessor: node padding.  Leaves have no padding in v4
 * (no compound-free `padding` prop); parents answer the resolved
 * auto-bounds padding (round 14.3).
 *
 * Public in v4 by decision (round 90) — v3 kept its counterpart internal.
 *
 * @returns the resolved padding in model px — 0 for leaves and for any
 *   graph with no compounds at all, the derived value for a parent;
 *   undefined when the collection is empty
 */
export function padding(self: Collection): number | undefined {
  const ref = self._first();

  if (ref == null) {
    return undefined;
  }

  if (
    ref.group !== GROUP_NODES ||
    !self._store.isCurrent(ref) ||
    !self._store.hasCompounds()
  ) {
    return 0;
  }

  return self._store.paddingOf(ref.slot);
}

/** The first node's width (`axis` 0) or height (1) plus its padding on both sides, or undefined when not live. */
export function _paddedDim(self: Collection, axis: 0 | 1): number | undefined {
  const ref = self._first();

  if (ref == null || !self._store.isCurrent(ref)) {
    return undefined;
  }

  if (
    ref.group === GROUP_NODES &&
    self._store.hasCompounds() &&
    self._store.hasFlag(GROUP_NODES, ref.slot, FLAG_PARENT)
  ) {
    self._store.flushDerived();

    // the size column stores the padded/drawn box for parents
    return (self._store.column(COL.NODE_SIZE) as Float32Array)[
      ref.slot * 2 + axis
    ];
  }

  return axis === 0 ? self.width() : self.height();
}

/** The first node's border width, or 0 for a non-node. */
export function _borderWidth(self: Collection): number {
  const ref = self._first();

  if (ref == null || ref.group !== GROUP_NODES) {
    return 0;
  }

  return (self._store.column(COL.NODE_BORDER_WIDTH) as Float32Array)[ref.slot];
}
