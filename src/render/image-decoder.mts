/*
The browser image decoder (round 15.3): the async rasterizer the
renderer attaches to the store's ImageRegistry at mount
(`registry.setDecoder`).  Headless instances never see it.

- Raster sources (png/jpg/webp/...) decode via fetch + createImageBitmap,
  downscaled at decode when they exceed the cap tier (the registry's tier
  assignment reads the returned dims, so oversized photos land on the cap
  tier at its resolution — the recorded cap).
- Vector sources (SVG) raster through an <img> + canvas at the requested
  target size (createImageBitmap can't scale SVG reliably across
  browsers): targetPx 0 uses the intrinsic size (falling back to the
  smallest tier when the SVG declares none), and the 15.6 zoom-promotion
  meter re-invokes with larger targets.
- sdf-icon requests raster the same way at the fixed SDF size; the alpha
  channel is what the EDT consumes (round 15.5).
- Crossorigin: 'anonymous' fetches cors/same-origin, 'use-credentials'
  includes credentials, 'null' fetches same-origin only.  WebGPU cannot
  upload tainted content, so v3's taint-tolerant 'null' mode narrows to
  same-origin here (recorded).
- The worker host (round 141) runs this decoder in its worker: raster
  sources fetch and decode there, off the main thread, and the scratch
  canvas is an OffscreenCanvas.  SVG cannot decode in a worker (no
  `<img>`, and `createImageBitmap` refuses SVG blobs there in Chromium
  and WebKit alike), so the worker's `rasterVector` hands the fetched
  blob to the main thread's `rasterVectorInPage` and takes the raster
  back transferred.
*/

import { IMAGE_TIER_SIZES } from '../image-registry.mjs';
import type {
  ImageDecoder,
  DecodedImage,
  ImageDecodeOpts,
} from '../image-registry.mjs';

const SVG_TYPE = /image\/svg/i;
const SVG_URL = /\.svg([?#]|$)/i;

/** The alpha-grid payload sdf-icon entries carry as DecodedImage.data
 * (the renderer runs the glyph EDT over it at upload, round 15.5). */
export interface SdfAlphaGrid {
  alpha: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * A 2D scratch canvas: the document's where there is one, an
 * OffscreenCanvas in a worker (the worker host decodes there, round 141).
 */
const scratchCanvas = (
  w: number,
  h: number,
): HTMLCanvasElement | OffscreenCanvas => {
  if (typeof document === 'undefined') {
    return new OffscreenCanvas(w, h);
  }

  const canvas = document.createElement('canvas');

  canvas.width = w;
  canvas.height = h;

  return canvas;
};

/** Raster any drawable source into a canvas and extract its alpha grid. */
const toAlphaGrid = (
  source: CanvasImageSource,
  w: number,
  h: number,
): SdfAlphaGrid => {
  const canvas = scratchCanvas(w, h);
  const ctx = canvas.getContext('2d', {
    willReadFrequently: true,
  }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

  ctx.drawImage(source, 0, 0, w, h);

  const rgba = ctx.getImageData(0, 0, w, h).data;
  const alpha = new Uint8ClampedArray(w * h);

  for (let i = 0; i < w * h; i++) {
    alpha[i] = rgba[i * 4 + 3];
  }

  return { alpha, width: w, height: h };
};

/**
 * Rasters a vector (SVG) source the decoder fetched: at `targetPx`
 * (longest side; 0 = intrinsic) for the rgba path, or as the alpha grid
 * at the sdf size when `sdf`.  The page's rasterizer needs an `<img>`;
 * the worker host supplies one that asks the main thread (round 141).
 */
export type VectorRasterizer = (
  blob: Blob,
  targetPx: number,
  sdf: boolean,
) => Promise<DecodedImage>;

/**
 * The page's vector rasterizer: an `<img>` + canvas at the requested
 * size (createImageBitmap cannot scale SVG reliably, and cannot decode
 * it at all in a worker — measured in Chromium 149 and WebKit 26.5,
 * round 141).  Needs a document.
 */
export const rasterVectorInPage: VectorRasterizer = async (
  blob,
  targetPx,
  sdf,
) => {
  const url = URL.createObjectURL(blob);

  try {
    const img = new Image();

    img.src = url;
    await img.decode();

    // sdf-icon mode (15.5): raster at the fixed sdf size preserving
    // aspect and hand back the alpha grid
    if (sdf) {
      const natW = img.naturalWidth || targetPx;
      const natH = img.naturalHeight || targetPx;
      const k = targetPx / Math.max(natW, natH);
      const grid = toAlphaGrid(
        img,
        Math.max(1, Math.round(natW * k)),
        Math.max(1, Math.round(natH * k)),
      );

      return {
        data: grid,
        width: grid.width,
        height: grid.height,
        vector: true,
      };
    }

    const natW = img.naturalWidth || IMAGE_TIER_SIZES[0];
    const natH = img.naturalHeight || IMAGE_TIER_SIZES[0];
    const scale = targetPx > 0 ? targetPx / Math.max(natW, natH) : 1;
    const w = Math.max(1, Math.round(natW * scale));
    const h = Math.max(1, Math.round(natH * scale));
    const canvas = scratchCanvas(w, h);
    const ctx = canvas.getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D;

    ctx.drawImage(img, 0, 0, w, h);

    return {
      data: await createImageBitmap(canvas, { premultiplyAlpha: 'none' }),
      width: w,
      height: h,
      vector: true,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
};

/**
 * The decoder the renderer wires up at mount.  Raster sources decode
 * wherever it runs — the page, or the worker host's worker (round 141),
 * where `fetch` and `createImageBitmap` both exist; vector sources go
 * to `rasterVector`.
 *
 * @param capPx — the cap tier's size: larger rasters downscale at decode
 * @param rasterVector — the SVG rasterizer (the page's by default)
 * @throws (from the decoder it returns) when the fetch answers a non-2xx
 *   status, carrying it — the registry catches this, warns once per url and
 *   renders the node imageless (round 15's async-loading policy)
 */
export const createBrowserImageDecoder = (
  capPx: number = IMAGE_TIER_SIZES[IMAGE_TIER_SIZES.length - 1],
  rasterVector: VectorRasterizer = rasterVectorInPage,
): ImageDecoder => {
  return async (url: string, opts: ImageDecodeOpts): Promise<DecodedImage> => {
    const response = await fetch(url, {
      mode: opts.crossOrigin === 'null' ? 'same-origin' : 'cors',
      credentials:
        opts.crossOrigin === 'use-credentials' ? 'include' : 'same-origin',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const isSvg =
      SVG_TYPE.test(blob.type) || (blob.type === '' && SVG_URL.test(url));

    if (isSvg) {
      return rasterVector(blob, opts.targetPx, opts.sdf);
    }

    // sdf-icon mode (15.5): raster at the fixed sdf size preserving
    // aspect and hand back the alpha grid — the silhouette is all the
    // EDT consumes (a multi-color source collapses to it; recorded)
    if (opts.sdf) {
      const target = opts.targetPx;
      const bitmap = await createImageBitmap(blob, {
        premultiplyAlpha: 'none',
      });
      const k = target / Math.max(bitmap.width, bitmap.height);
      const grid = toAlphaGrid(
        bitmap,
        Math.max(1, Math.round(bitmap.width * k)),
        Math.max(1, Math.round(bitmap.height * k)),
      );

      bitmap.close();

      return {
        data: grid,
        width: grid.width,
        height: grid.height,
        vector: false,
      };
    }

    // raster source: decode natively, downscaling into the cap when the
    // source exceeds it (tier resolution is the recorded ceiling)
    let bitmap = await createImageBitmap(blob, { premultiplyAlpha: 'none' });
    const longest = Math.max(bitmap.width, bitmap.height);
    const cap =
      opts.sdf || (opts.targetPx > 0 && opts.targetPx < capPx)
        ? Math.min(opts.targetPx > 0 ? opts.targetPx : capPx, capPx)
        : capPx;

    if (longest > cap) {
      const scale = cap / longest;
      const scaled = await createImageBitmap(bitmap, {
        premultiplyAlpha: 'none',
        resizeWidth: Math.max(1, Math.round(bitmap.width * scale)),
        resizeHeight: Math.max(1, Math.round(bitmap.height * scale)),
        resizeQuality: 'high',
      });

      bitmap.close();
      bitmap = scaled;
    }

    return {
      data: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      vector: false,
    };
  };
};
