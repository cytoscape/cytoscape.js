// Collection's layout hooks (round 130 split): `layoutDimensions` and
// `layoutPositions`.

import { GROUP_NODES } from '../contract.mjs';
import type { AnimationHandle } from '../animation.mjs';
import type { Position } from '../types.mjs';
import type { LayoutBaseOptions } from '../public-types.mjs';
import { layoutRunOf } from '../layout/run-state.mjs';
import { nodeDims } from '../layout/dims.mjs';
import type { Collection } from '../collection.mjs';

/**
 * Node dimensions for layout spacing, as v3's layoutDimensions — the
 * body, plus the label box under `nodeDimensionsIncludeLabels: true`
 * (114.1 made labels the default; 115 restored v3's body-only default).
 *
 * @param options — `{ nodeDimensionsIncludeLabels: true }` to include
 *   the label box
 * @returns the first element's `{ w, h }`
 */
export function layoutDimensions(
  self: Collection,
  options: { nodeDimensionsIncludeLabels?: boolean } = {},
): {
  w: number;
  h: number;
} {
  const ref = self._refs[0];

  if (ref == null || ref.group !== GROUP_NODES || !self._store.isCurrent(ref)) {
    return { w: 1, h: 1 };
  }

  // one reading for every layout (114.1): the body plus, on request,
  // the label box; hidden sanitises to 1 x 1 as v3 did
  const d = nodeDims(self._store, [ref.slot], {
    includeLabels: options.nodeDimensionsIncludeLabels === true,
  });

  return { w: d.x2[0] - d.x1[0], h: d.y2[0] - d.y1[0] };
}

/**
 * Apply a layout's position function to this collection's nodes with the
 * standard layout options (spacingFactor, transform, fit/zoom/pan, animate)
 * and the layoutstart/layoutready/layoutstop event flow — v3's helper.
 * With `animate: true` the viewport animates concurrently (a fit targets
 * the bounding box at the *final* positions, as v3 does).
 *
 * @param layout — the layout instance the lifecycle events carry as
 *   `event.layout`; it is not called back, only reported
 * @param options — the standard layout options (`spacingFactor`,
 *   `transform`, `fit`/`padding`, `zoom`/`pan`, `animate`,
 *   `animationDuration`, `animateFilter`)
 * @param fn — `( node, i ) => position`, evaluated once per positioned
 *   node; parents are excluded (auto-bounds derive them)
 * @returns this collection, for chaining
 */
export function layoutPositions(
  self: Collection,
  layout: object,
  options: LayoutBaseOptions,
  fn: (node: Collection, i: number) => Position,
): Collection {
  const cy = self._cy;
  // the run self finisher closes (round 128): a cancelled run writes
  // nothing and fires nothing — its close already did
  const run = layoutRunOf(cy, layout);

  if (run?.cancelled === true) {
    return self;
  }

  // v3: parents are excluded from layout positioning (auto-bounds
  // derive them from their placed leaves, round 14.11), and so are
  // locked nodes (114.3) — they hold their place; the layout that
  // computed positions for them still counted them in its structure
  const nodes = self
    .nodes()
    .filter((n: Collection) => !n.isParent() && !n.locked());
  const eles = (options.eles as Collection | undefined) ?? self;

  // the extension wrapper emits its own layoutstart before run()
  // (round 17.5); the finisher folds into that lifecycle
  if ((options as { _startEmitted?: boolean })._startEmitted !== true) {
    cy.emit({ type: 'layoutstart', layout });
  }

  // memoize by handle: handles are interned singletons
  const rawMemo = new Map<Collection, Position>();

  const rawPos = (node: Collection, i: number): Position => {
    let p = rawMemo.get(node);

    if (p == null) {
      p = fn(node, i);
      rawMemo.set(node, p);
    }

    return p;
  };

  const factor = options.spacingFactor;
  const useSpacing = factor != null && factor !== 1 && nodes.length > 0;
  let center: Position | null = null;

  if (useSpacing) {
    let x1 = Infinity,
      y1 = Infinity,
      x2 = -Infinity,
      y2 = -Infinity;

    for (let i = 0; i < nodes.length; i++) {
      const p = rawPos(nodes[i], i);

      x1 = Math.min(x1, p.x);
      x2 = Math.max(x2, p.x);
      y1 = Math.min(y1, p.y);
      y2 = Math.max(y2, p.y);
    }

    center = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
  }

  const finalMemo = new Map<Collection, Position>();

  const getFinalPos = (node: Collection, i: number): Position => {
    let p = finalMemo.get(node);

    if (p != null) {
      return p;
    }

    p = rawPos(node, i);

    if (useSpacing && center != null) {
      const spacing = Math.abs(factor as number);

      p = {
        x: center.x + (p.x - center.x) * spacing,
        y: center.y + (p.y - center.y) * spacing,
      };
    }

    if (options.transform != null) {
      p = options.transform(node, p);
    }

    finalMemo.set(node, p);

    return p;
  };

  // fit defaults on (v3's default, and what every bulk path already
  // tested — round 114.2 aligned the finisher's truthiness test)
  const applyViewport = (): void => {
    if (options.fit !== false) {
      cy.fit(eles, options.padding ?? 30);
    } else {
      if (options.zoom != null) {
        cy.zoom(options.zoom);
      }
      if (options.pan != null) {
        cy.pan(options.pan);
      }
    }
  };

  if (options.animate) {
    const anis: AnimationHandle[] = [];

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const newPos = getFinalPos(node, i);
      const animateNode =
        options.animateFilter == null || options.animateFilter(node, i);

      if (animateNode) {
        anis.push(
          node.animation({
            position: newPos,
            duration: options.animationDuration ?? 500,
            easing: options.animationEasing,
          }),
        );
      } else {
        node.position(newPos);
      }
    }

    // the viewport animates alongside the nodes: a fit targets the box at
    // the final positions (v3 semantics) — a locked node's final
    // position is where it already is
    const framePos = (node: Collection, i: number): Position =>
      node.locked() ? (node.position() as Position) : getFinalPos(node, i);

    if (options.fit !== false) {
      anis.push(
        cy.animation({
          fit: {
            boundingBox: eles.boundingBoxAt(framePos),
            padding: options.padding ?? 30,
          },
          duration: options.animationDuration ?? 500,
          easing: options.animationEasing,
        }),
      );
    } else if (options.zoom != null || options.pan != null) {
      // whichever of the two is given animates (114.2: the pair used to
      // be required together, so a lone zoom applied nothing)
      anis.push(
        cy.animation({
          ...(options.zoom != null ? { zoom: options.zoom } : {}),
          ...(options.pan != null ? { pan: options.pan } : {}),
          duration: options.animationDuration ?? 500,
          easing: options.animationEasing,
        }),
      );
    }

    for (const ani of anis) {
      ani.play();
    }

    // a cancel mid-tween stops these where they are (run-state.mts)
    run?.anis.push(...anis);

    options.ready?.();
    cy.emit({ type: 'layoutready', layout });

    Promise.all(anis.map((ani) => ani.promise())).then(() => {
      // a cancelled run closed its own lifecycle when the tweens
      // were dropped; nothing more fires here
      if (run?.cancelled === true) {
        return;
      }

      options.stop?.();
      cy.emit({ type: 'layoutstop', layout });
      run?.close(false);
    });
  } else {
    nodes.positions(getFinalPos);
    applyViewport();

    options.ready?.();
    cy.emit({ type: 'layoutready', layout });

    options.stop?.();
    cy.emit({ type: 'layoutstop', layout });
    run?.close(false);
  }

  return self;
}
