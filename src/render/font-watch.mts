/*
Which web-font events concern the glyph atlas (round 75.2).

The atlas rasters every label glyph with one CSS font list (the sheet's
`font-family`, via the store's `labelFont`).  A glyph rastered before its
face finished loading was drawn from the fallback face and stays cached,
so the renderer re-rasters when a face loads — and since a re-raster
clears the atlas, the shaping memo and every glyph run, it should happen
only for a face the atlas actually names.  These are the pure halves of
that decision, exported for `test/modules/font-watch.mjs`; the wiring
lives in `renderer/fonts.mts`.

Measured in Chromium (2026-09-28): a `loadingdone` event's `fontfaces`
report `family` *quoted* (`"Late Font"`), and `document.fonts.check()`
answers true for a family the set does not hold at all — so a face
loaded with `face.load()` before `document.fonts.add( face )` is
invisible to `check()` until it is added, and its add fires no event.
*/

/**
 * Normalize one CSS font-family name for comparison: trimmed, one level
 * of matching quotes removed, inner whitespace collapsed, lower-cased
 * (family matching is ASCII case-insensitive in CSS).
 *
 * @param name — a family name as CSS or a FontFace spells it
 * @returns the comparable form
 */
export function normalizeFamily(name: string): string {
  let s = name.trim();

  if (
    s.length >= 2 &&
    (s[0] === '"' || s[0] === "'") &&
    s[s.length - 1] === s[0]
  ) {
    s = s.slice(1, -1);
  }

  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Split a CSS font-family list into normalized family names, honouring
 * quotes (a quoted name may hold a comma).
 *
 * @param list — e.g. `'"Open Sans", Helvetica, sans-serif'`
 * @returns the normalized names, in order, empties dropped
 */
export function familiesOf(list: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote = '';

  for (const ch of list) {
    if (quote !== '') {
      cur += ch;

      if (ch === quote) {
        quote = '';
      }
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }

  out.push(cur);

  return out.map(normalizeFamily).filter((f) => f !== '');
}

/**
 * Whether a set of loaded faces touches the atlas font list — the
 * `loadingdone` filter.  **Conservative**: a missing, non-array or empty
 * face list answers true (re-raster as before round 75), so a browser
 * whose event carries no readable payload loses nothing but the saving.
 *
 * @param faces — the event's `fontfaces`, or whatever stands in for it
 * @param fontList — the atlas's CSS font-family list
 * @returns true when a re-raster is warranted
 */
export function facesTouchFont(faces: unknown, fontList: string): boolean {
  if (!Array.isArray(faces) || faces.length === 0) {
    return true;
  }

  const wanted = new Set(familiesOf(fontList));

  for (const face of faces) {
    const family = (face as { family?: unknown } | null)?.family;

    if (typeof family !== 'string' || wanted.has(normalizeFamily(family))) {
      return true; // an unreadable entry is treated like no payload
    }
  }

  return false;
}

/**
 * Whether a font string is settled for rastering — every face it names
 * that the page's FontFaceSet holds has loaded.  True where there is no
 * FontFaceSet to ask (a worker, Node) and for a string `check()` refuses,
 * so a caller that marks the atlas provisional on false never does so on
 * a guess.
 *
 * @param font — a CSS `font` shorthand, as the atlas canvas is set to
 * @returns false only when the set says a named face is still unloaded
 */
export function fontSettled(font: string): boolean {
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;

  if (fonts == null || typeof fonts.check !== 'function') {
    return true;
  }

  try {
    return fonts.check(font);
  } catch {
    return true;
  }
}
