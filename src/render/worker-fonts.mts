import type { WireFont } from './worker-protocol.mjs';
import type { WorkerFontFace } from '../public-types.mjs';

/*
The worker host's label fonts (round 141, ledger item 51).

A worker's FontFaceSet starts empty — the page's `@font-face` rules do
not reach it — so the app lists the faces its sheet names
(`renderer: { worker: true, fonts: [...] }`) and the worker registers
them itself: each face's bytes are fetched (or taken as given), handed to
the `FontFace` constructor, loaded, and added to the worker's set.  Bytes
rather than a `url()` source, as item 51 decided.  Round 141 re-probed
the spike and found what its "url dead end" was: Chromium's worker
canvas keeps resolving a font description to whatever it found the
first time, so a description measured before its face loaded stays on
the fallback for good — a url face added while still in flight is one
way to get there, and a control measurement taken before registering
is another.  A url face nobody measured early applies fine.  Bytes
still win: a bytes face is loaded before it is added, so nothing can
see it mid-flight, and a failed fetch is an error the app can read
rather than a silent fallback.  Measured (Chromium 149, WebKit 26.5): a
bytes-registered face reaches OffscreenCanvas 2D text in a worker in
both engines, advance for advance with the page's.  The early-resolution
trap the atlas still meets (it rasters before a slow face lands) is
`GlyphAtlas.fontEpoch`'s.
*/

/**
 * The main side: the app's list checked and put in wire form — a url
 * resolved against the document (the worker's own base is a blob: url),
 * bytes passed through to be cloned.
 *
 * @param fonts — the app's `renderer.fonts`
 * @param baseURI — the document's base url
 * @returns the wire list
 * @throws TypeError when an entry has no family name or no source
 */
export function wireFonts(
  fonts: readonly WorkerFontFace[] | undefined,
  baseURI: string,
): WireFont[] {
  if (fonts == null) {
    return [];
  }

  if (!Array.isArray(fonts)) {
    throw new TypeError('renderer.fonts must be an array of font faces');
  }

  return fonts.map((face, i) => {
    const family = face?.family;
    const source = face?.source;

    if (typeof family !== 'string' || family.trim() === '') {
      throw new TypeError(`renderer.fonts[${i}] needs a family name`);
    }

    const bytes =
      source instanceof ArrayBuffer || ArrayBuffer.isView(source as unknown);

    if (typeof source !== 'string' && !bytes) {
      throw new TypeError(
        `renderer.fonts[${i}] ('${family}') needs a source: a url or the face's bytes`,
      );
    }

    const descriptors: Record<string, string> = {};

    for (const key of ['style', 'weight', 'stretch', 'unicodeRange'] as const) {
      const value = face[key];

      if (typeof value === 'string') {
        descriptors[key] = value;
      }
    }

    return {
      family,
      source:
        typeof source === 'string'
          ? new URL(source, baseURI).href
          : (source as ArrayBuffer | ArrayBufferView),
      descriptors,
    };
  });
}

/** What registering the list came to. */
export interface WorkerFontsResult {
  loaded: number;
  failed: number;
}

/**
 * The worker side: register every listed face in the worker's
 * FontFaceSet, in parallel, each from its bytes.  `onFace` hears each
 * face as it lands (the renderer re-rasters when the atlas names it);
 * `onError` hears one message per face that could not load, whose
 * family then keeps the fallback face.
 *
 * @param fonts — the wire list from the init message
 * @param onFace — called once per face, after it is loaded and added
 * @param onError — called once per face that failed
 * @returns resolves when every face has landed or failed; never rejects
 */
export async function registerWorkerFonts(
  fonts: readonly WireFont[],
  onFace: (face: FontFace) => void,
  onError: (message: string) => void,
): Promise<WorkerFontsResult> {
  const set = (globalThis as { fonts?: FontFaceSet }).fonts;
  const result: WorkerFontsResult = { loaded: 0, failed: 0 };

  if (fonts.length === 0) {
    return result;
  }

  if (set == null || typeof FontFace === 'undefined') {
    result.failed = fonts.length;
    onError(
      'renderer.fonts: this browser has no FontFaceSet in workers, so the ' +
        'worker host cannot register label fonts; labels use fallback faces',
    );

    return result;
  }

  await Promise.all(
    fonts.map(async (font) => {
      try {
        let bytes: ArrayBuffer | ArrayBufferView;

        if (typeof font.source === 'string') {
          const response = await fetch(font.source);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          bytes = await response.arrayBuffer();
        } else {
          bytes = font.source;
        }

        const face = new FontFace(
          font.family,
          bytes as BufferSource,
          font.descriptors,
        );

        await face.load();
        set.add(face);
        result.loaded++;
        onFace(face);
      } catch (err) {
        result.failed++;

        const where =
          typeof font.source === 'string' ? ` from ${font.source}` : '';

        onError(
          `renderer.fonts: the face '${font.family}'${where} did not load ` +
            `(${err instanceof Error ? err.message : String(err)}); its ` +
            'labels use the fallback face',
        );
      }
    }),
  );

  return result;
}
