/*
ImageArrays (round 15.3): the size-tiered texture arrays behind
`background-image`.

Each rgba tier (IMAGE_TIER_SIZES: 128² / 512² / 1024²) is one
`texture_2d_array` with a full mip chain; a registry entry occupies one
layer of its tier.  Layers are slots — TierAllocator hands them out from
a per-tier free-list, re-alloc on tier promotion frees the old placement,
and growth doubles the layer count with a copyTextureToTexture of every
live mip (old textures destroy behind onSubmittedWorkDone, the
ColumnMirror discipline).  Layer counts cap at IMAGE_MAX_LAYERS (the
WebGPU base maxTextureArrayLayers) with a one-time warning — the glyph
atlas's full-atlas precedent.

The **image table** is a storage buffer indexed by registry entry id
(4 u32 per entry): [status | tier << 2 | layer << 4, natW | natH << 16,
rasW | rasH << 16, 0].  Natural dims size 'auto' images in model px;
raster dims scale UVs into the layer's occupied region (rasters smaller
than their tier upload at [0, 0, w, h] and the region outside stays
transparent black — WebGPU zero-initializes textures).

Uploads run in `sync()` each frame: drain the registry's freed ids
(reclaim layers), then its ready ids — `copyExternalImageToTexture` into
mip 0 of the assigned layer, then a blit chain renders each mip level
from the previous one (WebGPU has no generateMipmaps).  Mips are the
point of the tier design: minification samples a coherent low mip
instead of scattering across full-res texels.
*/

import {
  IMAGE_TIER_SIZES,
  IMAGE_KIND_SDF,
  IMAGE_READY,
  SDF_IMAGE_SIZE,
} from '../image-registry.mjs';
import type { ImageRegistry, ImageEntry } from '../image-registry.mjs';
import { computeSdf } from './glyph-atlas.mjs';
import type { SdfAlphaGrid } from './image-decoder.mjs';
import { BUFFER_USAGE, TEXTURE_USAGE } from './webgpu-constants.mjs';

/** WebGPU base maxTextureArrayLayers */
export const IMAGE_MAX_LAYERS = 256;

/** the r8 sdf-icon array's tier index (rides the 2-bit tier field) */
export const ICON_TIER = IMAGE_TIER_SIZES.length;

/** u32 words per image-table row */
export const IMAGE_TABLE_STRIDE = 4;

/** Pack one image-table row (status/tier/layer + natural + raster dims). */
export const packImageTableRow = (
  entry: { status: number; width: number; height: number },
  tier: number,
  layer: number,
  rasterW: number,
  rasterH: number,
): [number, number, number, number] => {
  const dim = (w: number, h: number): number =>
    (Math.min(0xffff, Math.max(0, Math.round(w))) |
      (Math.min(0xffff, Math.max(0, Math.round(h))) << 16)) >>>
    0;

  return [
    ((entry.status & 3) | ((tier & 3) << 2) | (layer << 4)) >>> 0,
    dim(entry.width, entry.height),
    dim(rasterW, rasterH),
    0,
  ];
};

/** Per-tier layer slots: free-list alloc/reclaim, doubling growth. */
export class TierAllocator {
  private caps: number[];
  private high: number[];
  private freeLayers: number[][];
  private byEntry = new Map<number, { tier: number; layer: number }>();
  private warnedFull = false;

  /**
   * Starts every tier empty (capacity 0, no free layers), so the first
   * alloc() in each tier reports `grew` and the caller creates that
   * tier's texture.
   *
   * @param tierCount — number of tiers to track: the rgba tiers plus the
   * r8 icon tier, indexed as ICON_TIER
   */
  constructor(tierCount: number) {
    this.caps = new Array(tierCount).fill(0);
    this.high = new Array(tierCount).fill(0);
    this.freeLayers = Array.from({ length: tierCount }, () => []);
  }

  /**
   * The tier's allocated layer count — what its texture must be sized
   * to.  Grows by doubling (minimum 4) and never shrinks, so it can
   * exceed the number of layers actually in use.
   *
   * @param tier — tier index
   */
  capacity(tier: number): number {
    return this.caps[tier];
  }

  /**
   * Where an entry currently lives, or null when it has none (never
   * allocated, or freed).
   *
   * @param entryId — registry entry id
   */
  placement(entryId: number): { tier: number; layer: number } | null {
    return this.byEntry.get(entryId) ?? null;
  }

  /**
   * Assign a layer in `tier` to the entry (freeing any previous
   * placement — tier promotion).  Returns null when the tier is full
   * (warn-once); `grew` means the tier's texture must reallocate.
   */
  alloc(
    entryId: number,
    tier: number,
  ): { layer: number; grew: boolean } | null {
    this.free(entryId);

    let grew = false;
    const freeList = this.freeLayers[tier];
    let layer: number;

    if (freeList.length > 0) {
      layer = freeList.pop()!;
    } else {
      if (this.high[tier] >= IMAGE_MAX_LAYERS) {
        if (!this.warnedFull) {
          this.warnedFull = true;
          console.warn(
            `The background-image tier ${IMAGE_TIER_SIZES[tier] ?? tier} is full ` +
              `(${IMAGE_MAX_LAYERS} unique images); further images will not render`,
          );
        }

        return null;
      }

      layer = this.high[tier]++;

      if (layer >= this.caps[tier]) {
        this.caps[tier] = Math.min(
          IMAGE_MAX_LAYERS,
          Math.max(4, this.caps[tier] * 2),
        );
        grew = true;
      }
    }

    this.byEntry.set(entryId, { tier, layer });

    return { layer, grew };
  }

  /**
   * Return an entry's layer to its tier's free list.  The layer's texels
   * are left as they are — the caller must also zero the entry's image
   * table row, or a stale row would still point at readable pixels.
   *
   * @param entryId — registry entry id; unknown ids are a no-op
   * @returns the placement that was freed, or null when there was none
   */
  free(entryId: number): { tier: number; layer: number } | null {
    const placement = this.byEntry.get(entryId);

    if (placement == null) {
      return null;
    }

    this.byEntry.delete(entryId);
    this.freeLayers[placement.tier].push(placement.layer);

    return placement;
  }
}

const MIPGEN_SHADER = `
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vsMip(@builtin(vertex_index) vi: u32) -> VSOut {
  var out: VSOut;
  let uv = vec2f(f32((vi << 1u) & 2u), f32(vi & 2u));

  out.position = vec4f(uv * 2.0 - 1.0, 0.0, 1.0);
  out.uv = vec2f(uv.x, 1.0 - uv.y);

  return out;
}

@fragment
fn fsMip(in: VSOut) -> @location(0) vec4f {
  return textureSampleLevel(src, samp, in.uv, 0.0);
}
`;

const mipCountFor = (size: number): number => Math.floor(Math.log2(size)) + 1;

/** The GPU half: per-tier array textures, uploads + mip blits, the table. */
export class ImageArrays {
  /** bumps when any texture or the table buffer reallocates */
  version = 0;

  private device: GPUDevice;
  private alloc = new TierAllocator(IMAGE_TIER_SIZES.length + 1); // + the icon tier
  private textures: (GPUTexture | null)[] = new Array(
    IMAGE_TIER_SIZES.length,
  ).fill(null);
  private views: (GPUTextureView | null)[] = new Array(
    IMAGE_TIER_SIZES.length,
  ).fill(null);
  /** the r8 sdf-icon array (round 15.5) */
  private icon: GPUTexture | null = null;
  private iconViewCache: GPUTextureView | null = null;
  private placeholder: GPUTexture;
  private placeholderView: GPUTextureView;
  private placeholderIcon: GPUTexture;
  private placeholderIconView: GPUTextureView;
  private table: GPUBuffer;
  private tableData: Uint32Array;
  /** the trilinear sampler the image fragment shader reads every tier
   * (and the icon array) with; mip filtering is the point of the tiers */
  readonly sampler: GPUSampler;
  private mipPipeline: GPURenderPipeline;
  private mipSampler: GPUSampler;
  private destroyed = false;

  /**
   * Builds the samplers, the mip-blit pipeline, the 1×1 placeholders and
   * a small image table.  No tier texture is created here: tiers
   * allocate lazily on their first upload, and until then view() hands
   * out the placeholder so bind groups can always be built.
   *
   * @param device — the device that owns every texture, the table buffer
   * and the mip pipeline
   */
  constructor(device: GPUDevice) {
    this.device = device;
    this.sampler = device.createSampler({
      label: 'cy-gpu:image-sampler',
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
    });
    this.mipSampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
    });

    // empty tiers bind a 1×1 placeholder (bindings must exist; content is
    // gated by the table's status word)
    this.placeholder = device.createTexture({
      label: 'cy-gpu:image-placeholder',
      size: { width: 1, height: 1, depthOrArrayLayers: 1 },
      format: 'rgba8unorm',
      usage: TEXTURE_USAGE.TEXTURE_BINDING,
    });
    this.placeholderView = this.placeholder.createView({
      dimension: '2d-array',
    });

    this.placeholderIcon = device.createTexture({
      label: 'cy-gpu:icon-placeholder',
      size: { width: 1, height: 1, depthOrArrayLayers: 1 },
      format: 'r8unorm',
      usage: TEXTURE_USAGE.TEXTURE_BINDING,
    });
    this.placeholderIconView = this.placeholderIcon.createView({
      dimension: '2d-array',
    });

    this.tableData = new Uint32Array(16 * IMAGE_TABLE_STRIDE);
    this.table = this.createTableBuffer();

    const module = device.createShaderModule({
      label: 'cy-gpu:image-mipgen',
      code: MIPGEN_SHADER,
    });

    this.mipPipeline = device.createRenderPipeline({
      label: 'cy-gpu:image-mipgen',
      layout: 'auto',
      vertex: { module, entryPoint: 'vsMip' },
      fragment: {
        module,
        entryPoint: 'fsMip',
        targets: [{ format: 'rgba8unorm' }],
      },
      primitive: { topology: 'triangle-list' },
    });
  }

  /** The image table storage buffer, indexed by registry entry id.  It
   * reallocates when the table outgrows its length, so re-read it (and
   * rebuild the bind group) whenever `version` changes. */
  tableBuffer(): GPUBuffer {
    return this.table;
  }

  /**
   * One rgba tier's array view, or the 1×1 placeholder while that tier
   * has no texture yet.  Valid only until the next `version` bump.
   *
   * @param tier — rgba tier index (not ICON_TIER; use iconView())
   */
  view(tier: number): GPUTextureView {
    return this.views[tier] ?? this.placeholderView;
  }

  /** The r8 sdf-icon array's view (round 15.5), or the r8 placeholder
   * while no icon has been uploaded.  Valid until the next `version`
   * bump. */
  iconView(): GPUTextureView {
    return this.iconViewCache ?? this.placeholderIconView;
  }

  /**
   * Drain the registry's freed and ready queues: reclaim layers, upload
   * new rasters into their tier layers (+ mip chain), refresh table
   * rows.  Returns the upload count (the promotion meter re-checks on
   * fresh arrivals, 15.6).
   */
  sync(registry: ImageRegistry): number {
    if (this.destroyed) {
      return 0;
    }

    for (const id of registry.takeFreed()) {
      this.alloc.free(id);
      this.writeTableRow(id, [0, 0, 0, 0]);
    }

    let uploaded = 0;

    for (const id of registry.takeReady()) {
      const entry = registry.get(id);

      if (entry == null || entry.status !== IMAGE_READY || entry.data == null) {
        continue;
      }

      if (entry.kind === IMAGE_KIND_SDF) {
        this.uploadSdf(id, entry);
      } else {
        this.uploadRgba(id, entry);
      }

      uploaded++;
    }

    return uploaded;
  }

  /**
   * Destroys every tier texture, the icon array, both placeholders and
   * the table buffer, and latches sync() to a no-op.  Textures already
   * retired by a realloc are not touched here — their destroy is still
   * pending behind onSubmittedWorkDone.
   */
  destroy(): void {
    this.destroyed = true;

    for (const texture of this.textures) {
      texture?.destroy();
    }

    this.icon?.destroy();
    this.placeholder.destroy();
    this.placeholderIcon.destroy();
    this.table.destroy();
  }

  /**
   * sdf-icon upload (round 15.5): run the glyph EDT over the decoder's
   * alpha grid and write the r8 distance field into an icon-array
   * layer.  One raster, crisp at every zoom — the glyph trick
   * generalized (threshold 0.5 + analytic AA in the FS, tinted by
   * background-image-color).
   */
  private uploadSdf(id: number, entry: ImageEntry): void {
    const grid = entry.data as SdfAlphaGrid;

    if (grid == null || grid.alpha == null) {
      return;
    }

    const placement = this.alloc.alloc(id, ICON_TIER);

    if (placement == null) {
      return;
    }

    if (placement.grew || this.icon == null) {
      this.reallocIcon();
    }

    const sdf = computeSdf(grid.alpha, grid.width, grid.height);

    this.device.queue.writeTexture(
      {
        texture: this.icon as GPUTexture,
        origin: { x: 0, y: 0, z: placement.layer },
      },
      sdf.buffer as ArrayBuffer,
      { bytesPerRow: grid.width, rowsPerImage: grid.height },
      { width: grid.width, height: grid.height, depthOrArrayLayers: 1 },
    );

    this.writeTableRow(
      id,
      packImageTableRow(
        entry,
        ICON_TIER,
        placement.layer,
        grid.width,
        grid.height,
      ),
    );
  }

  private reallocIcon(): void {
    const layers = Math.max(1, this.alloc.capacity(ICON_TIER));
    const old = this.icon;
    const texture = this.device.createTexture({
      label: 'cy-gpu:image-icons',
      size: {
        width: SDF_IMAGE_SIZE,
        height: SDF_IMAGE_SIZE,
        depthOrArrayLayers: layers,
      },
      format: 'r8unorm',
      usage:
        TEXTURE_USAGE.TEXTURE_BINDING |
        TEXTURE_USAGE.COPY_DST |
        TEXTURE_USAGE.COPY_SRC,
    });

    if (old != null) {
      const encoder = this.device.createCommandEncoder();

      encoder.copyTextureToTexture(
        { texture: old },
        { texture },
        {
          width: SDF_IMAGE_SIZE,
          height: SDF_IMAGE_SIZE,
          depthOrArrayLayers: Math.min(layers, old.depthOrArrayLayers),
        },
      );
      this.device.queue.submit([encoder.finish()]);
      this.device.queue.onSubmittedWorkDone().then(() => old.destroy());
    }

    this.icon = texture;
    this.iconViewCache = texture.createView({ dimension: '2d-array' });
    this.version++;
  }

  private uploadRgba(id: number, entry: ImageEntry): void {
    const tier = entry.tier;
    const tierSize = IMAGE_TIER_SIZES[tier];
    const placement = this.alloc.alloc(id, tier);

    if (placement == null) {
      return;
    } // tier full (warned once)

    if (placement.grew || this.textures[tier] == null) {
      this.reallocTier(tier);
    }

    const texture = this.textures[tier] as GPUTexture;
    const w = Math.min(entry.width, tierSize);
    const h = Math.min(entry.height, tierSize);

    this.device.queue.copyExternalImageToTexture(
      { source: entry.data as ImageBitmap },
      { texture, mipLevel: 0, origin: { x: 0, y: 0, z: placement.layer } },
      { width: w, height: h },
    );

    this.generateMips(texture, tierSize, placement.layer);
    this.writeTableRow(
      id,
      packImageTableRow(entry, tier, placement.layer, w, h),
    );
  }

  /** Blit-downsample the layer's mip chain (mip m samples mip m-1). */
  private generateMips(texture: GPUTexture, size: number, layer: number): void {
    const mips = mipCountFor(size);
    const encoder = this.device.createCommandEncoder({
      label: 'cy-gpu:image-mipgen',
    });

    for (let m = 1; m < mips; m++) {
      const src = texture.createView({
        dimension: '2d',
        baseMipLevel: m - 1,
        mipLevelCount: 1,
        baseArrayLayer: layer,
        arrayLayerCount: 1,
      });
      const dst = texture.createView({
        dimension: '2d',
        baseMipLevel: m,
        mipLevelCount: 1,
        baseArrayLayer: layer,
        arrayLayerCount: 1,
      });
      const bind = this.device.createBindGroup({
        layout: this.mipPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: src },
          { binding: 1, resource: this.mipSampler },
        ],
      });
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view: dst, loadOp: 'clear', storeOp: 'store' }],
      });

      pass.setPipeline(this.mipPipeline);
      pass.setBindGroup(0, bind);
      pass.draw(3);
      pass.end();
    }

    this.device.queue.submit([encoder.finish()]);
  }

  /** Reallocate a tier's texture at the allocator's capacity, copying live mips. */
  private reallocTier(tier: number): void {
    const tierSize = IMAGE_TIER_SIZES[tier];
    const layers = Math.max(1, this.alloc.capacity(tier));
    const old = this.textures[tier];
    const mips = mipCountFor(tierSize);
    const texture = this.device.createTexture({
      label: `cy-gpu:image-tier-${tierSize}`,
      size: { width: tierSize, height: tierSize, depthOrArrayLayers: layers },
      format: 'rgba8unorm',
      mipLevelCount: mips,
      usage:
        TEXTURE_USAGE.TEXTURE_BINDING |
        TEXTURE_USAGE.COPY_DST |
        TEXTURE_USAGE.COPY_SRC |
        TEXTURE_USAGE.RENDER_ATTACHMENT,
    });

    if (old != null) {
      const encoder = this.device.createCommandEncoder();
      const oldLayers = Math.min(layers, old.depthOrArrayLayers);

      for (let m = 0; m < mips; m++) {
        const dim = Math.max(1, tierSize >> m);

        encoder.copyTextureToTexture(
          { texture: old, mipLevel: m },
          { texture, mipLevel: m },
          { width: dim, height: dim, depthOrArrayLayers: oldLayers },
        );
      }

      this.device.queue.submit([encoder.finish()]);
      this.device.queue.onSubmittedWorkDone().then(() => old.destroy());
    }

    this.textures[tier] = texture;
    this.views[tier] = texture.createView({ dimension: '2d-array' });
    this.version++;
  }

  private createTableBuffer(): GPUBuffer {
    const buffer = this.device.createBuffer({
      label: 'cy-gpu:image-table',
      size: this.tableData.byteLength,
      usage: BUFFER_USAGE.STORAGE | BUFFER_USAGE.COPY_DST,
    });

    this.device.queue.writeBuffer(
      buffer,
      0,
      this.tableData.buffer,
      0,
      this.tableData.byteLength,
    );

    return buffer;
  }

  private writeTableRow(
    id: number,
    row: [number, number, number, number],
  ): void {
    if ((id + 1) * IMAGE_TABLE_STRIDE > this.tableData.length) {
      let len = this.tableData.length;

      while (len < (id + 1) * IMAGE_TABLE_STRIDE) {
        len *= 2;
      }

      const grown = new Uint32Array(len);

      grown.set(this.tableData);
      this.tableData = grown;

      const old = this.table;

      this.table = this.createTableBuffer();
      this.device.queue.onSubmittedWorkDone().then(() => old.destroy());
      this.version++;
    }

    this.tableData.set(row, id * IMAGE_TABLE_STRIDE);
    this.device.queue.writeBuffer(
      this.table,
      id * IMAGE_TABLE_STRIDE * 4,
      this.tableData.buffer,
      id * IMAGE_TABLE_STRIDE * 4,
      IMAGE_TABLE_STRIDE * 4,
    );
  }
}
