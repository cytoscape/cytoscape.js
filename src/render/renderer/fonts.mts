// The renderer's web-font watch (round 75.2): which font events
// re-raster the glyph atlas, and the per-frame checks behind them.

import {
  facesTouchFont,
  familiesOf,
  fontSettled,
  normalizeFamily,
} from '../font-watch.mjs';
import type { Renderer } from '../renderer.mjs';

/** The page's FontFaceSet, or null where there is none (a worker, Node). */
const pageFonts = (): FontFaceSet | null =>
  typeof document !== 'undefined' && document.fonts != null
    ? document.fonts
    : null;

/**
 * Re-raster every label: the atlas, the shaping memo and every glyph run
 * rebuild on the next frame's label pass, and that frame draws.
 */
function reraster(rd: Renderer): void {
  if (rd.destroyed || rd.labelLayer == null) {
    return;
  }

  rd.labelLayer.reraster();
  rd.requestRender();
}

/**
 * Subscribe to the page's `loadingdone` (round 10) — filtered since
 * round 75.2 to faces the atlas font names, so an unrelated font (an
 * icon font, another widget's face) no longer costs an every-label
 * re-layout.  An event with no readable face list re-rasters as before.
 * Also seeds the face census {@link checkFonts} diffs against.  No-op
 * without a FontFaceSet.
 */
export function watchFonts(rd: Renderer): void {
  const fonts = pageFonts();

  if (fonts == null || fonts.addEventListener == null) {
    return;
  }

  rd.onFontsLoadingDone = (e: Event) => {
    const layer = rd.labelLayer;

    if (rd.destroyed || layer == null) {
      return;
    }

    if (
      facesTouchFont(
        (e as FontFaceSetLoadEvent).fontfaces,
        layer.atlas.fontFamily,
      )
    ) {
      reraster(rd);
    }
  };
  fonts.addEventListener('loadingdone', rd.onFontsLoadingDone);

  rd.fontSetSize = fonts.size;
  fonts.forEach((face) => rd.seenFaces.add(face));
}

/**
 * The per-frame font checks (round 75.2), run before the label pass.
 * Two cases the `loadingdone` listener cannot see:
 *
 * - **A provisional atlas** — a glyph was rastered while a face of the
 *   atlas font was still loading.  When the set says the font has
 *   settled, re-raster; while it has not, arm one `document.fonts.ready`
 *   belt per episode, so the re-raster lands even on a page at rest.
 * - **A face added already loaded** (`face.load()` *before*
 *   `document.fonts.add( face )`): the add fires no event and `check()`
 *   answered true before it, so nothing marked the atlas.  The set's
 *   size is the tell — when it moved, the new faces are checked against
 *   the atlas font.  This runs only on a *rendered* frame: a page fully
 *   at rest keeps its fallback glyphs until anything redraws, which is
 *   the documented residual (the eleventh sitting: documented, no
 *   timer).  Add the face before loading it and the event path covers
 *   it.
 */
export function checkFonts(rd: Renderer): void {
  const fonts = pageFonts();
  const layer = rd.labelLayer;

  if (fonts == null || layer == null) {
    return;
  }

  const atlas = layer.atlas;

  if (fonts.size !== rd.fontSetSize) {
    rd.fontSetSize = fonts.size;

    if (addedLoadedFace(fonts, rd.seenFaces, atlas.fontFamily)) {
      reraster(rd);

      return;
    }
  }

  if (!atlas.provisional) {
    return;
  }

  if (fontSettled(atlas.fontString())) {
    reraster(rd);

    return;
  }

  if (!rd.fontsReadyArmed) {
    rd.fontsReadyArmed = true;
    void fonts.ready.then(() => {
      rd.fontsReadyArmed = false;

      if (
        !rd.destroyed &&
        rd.labelLayer?.atlas.provisional === true &&
        fontSettled(rd.labelLayer.atlas.fontString())
      ) {
        reraster(rd);
      }
    });
  }
}

/**
 * Walk the set for faces not seen before, remembering each; answer
 * whether any of them is loaded and named by the atlas font.
 *
 * @param fonts — the page's FontFaceSet
 * @param seen — the faces already accounted for (grown in place)
 * @param fontList — the atlas's CSS font-family list
 * @returns true when a new, loaded face concerns the atlas
 */
export function addedLoadedFace(
  fonts: FontFaceSet,
  seen: WeakSet<FontFace>,
  fontList: string,
): boolean {
  const wanted = new Set(familiesOf(fontList));
  let hit = false;

  fonts.forEach((face) => {
    if (seen.has(face)) {
      return;
    }

    seen.add(face);

    if (face.status === 'loaded' && wanted.has(normalizeFamily(face.family))) {
      hit = true;
    }
  });

  return hit;
}
