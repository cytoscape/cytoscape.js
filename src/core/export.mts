// Core's image export and pick decoding (round 130 split).

import { Collection } from '../collection.mjs';
import {
  EDGE_PICK_BIT,
  GROUP_EDGES,
  GROUP_NODES,
  FLAG_ALIVE,
} from '../contract.mjs';
import type { GroupName } from '../contract.mjs';
import type { ExportOptions } from '../public-types.mjs';
import type { Core } from '../core.mjs';
import {
  DEFAULT_HIDE_PX,
  DEFAULT_NODE_LOD_PX,
  pickNodeTierAt,
} from '../cpu-pick.mjs';

/** Render the graph to a PNG or JPEG through the renderer's export path, resolving the export view (full graph or viewport, scale, background) first. */
export async function _exportImage(
  core: Core,
  mime: string,
  options: ExportOptions,
): Promise<string | Blob> {
  const output = options.output ?? 'base64uri';

  if (
    output !== 'base64uri' &&
    output !== 'base64' &&
    output !== 'blob' &&
    output !== 'blob-promise'
  ) {
    throw new Error(
      `Invalid image export output '${String(output)}'; use 'base64uri', 'base64' or 'blob'`,
    );
  }

  if (core._renderer == null) {
    throw new Error(
      'An image can only be exported from a rendered instance; core instance is headless',
    );
  }

  const { data, width, height } = await core._renderer.exportImage(options);
  const doc = (core._container as HTMLElement).ownerDocument as Document;
  const canvas = doc.createElement('canvas');

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d') as CanvasRenderingContext2D;

  context.putImageData(new ImageData(data, width, height), 0, 0);

  const quality = options.quality;

  if (output === 'blob' || output === 'blob-promise') {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob != null
            ? resolve(blob)
            : reject(
                new Error(`Could not encode the exported image as ${mime}`),
              ),
        mime,
        quality,
      );
    });
  }

  const uri = canvas.toDataURL(mime, quality);

  return output === 'base64' ? uri.substring(uri.indexOf(',') + 1) : uri;
}

/**
 * Decode a renderer pick id to a live element (round 86.2, moved here
 * from the renderer so it speaks slots and ids only).  A GPU pick can
 * be up to two frames stale, so the slot is re-validated against the
 * model before an element handle is made.
 *
 * @param id — the packed pick id (slot + 1; edges carry the namespace
 *   bit), or null/0 for background
 * @returns the element, or null when the id is background or stale
 * @internal
 */
export function _decodePick(core: Core, id: number | null): Collection | null {
  if (id == null || id === 0) {
    return null;
  }

  const isEdge = (id & EDGE_PICK_BIT) !== 0;
  const group: GroupName = isEdge ? GROUP_EDGES : GROUP_NODES;
  const slot = (isEdge ? id & ~EDGE_PICK_BIT : id) - 1;

  if (
    slot >= core._store.highWater(group) ||
    !core._store.hasFlag(group, slot, FLAG_ALIVE)
  ) {
    return null;
  }

  return core._ele(group, slot);
}

/**
 * The synchronous node pick behind `cy.nodeAt()` (round 75.4): the
 * renderer's CPU pick when one is mounted (its device-pixel ratio and
 * thresholds), otherwise the same scan computed from the store and the
 * viewport at dpr 1 with the renderer's default thresholds.
 *
 * @param x — rendered (CSS px) x
 * @param y — rendered (CSS px) y
 * @returns the node under the point, or null
 */
export function nodeAt(core: Core, x: number, y: number): Collection | null {
  if (core._destroyed) {
    return null;
  }

  let slot: number | null;

  if (core._renderer != null) {
    slot = core._renderer.pickNodeSync(x, y);
  } else {
    const viewport = core._viewport;
    const pan = viewport.pan();

    core._store.flushDerived(); // parent geometry is derived (14.9)
    slot =
      pickNodeTierAt(
        core._store,
        {
          panXPx: pan.x,
          panYPx: pan.y,
          zoomDpr: viewport.zoom(),
          hidePx: DEFAULT_HIDE_PX,
          nodeLodPx: DEFAULT_NODE_LOD_PX,
        },
        x,
        y,
      )?.slot ?? null;
  }

  return slot == null ? null : core._ele(GROUP_NODES, slot);
}
