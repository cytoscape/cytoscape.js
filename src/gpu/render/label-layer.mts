import { GlyphAtlas, SDF_FONT_SIZE } from './glyph-atlas.mjs';
import { layoutLabel } from './label-layout.mjs';
import { GLYPH_WORDS, GlyphBuffer } from './glyph-buffer.mjs';
import type { GraphStore } from '../store/graph-store.mjs';

/**
 * Consumes the model's label-dirty channel each frame: lays out changed
 * labels against the SDF atlas and (re)writes their glyph runs in the
 * persistent GlyphBuffer.  Position changes never reach this layer —
 * glyphs follow their node on-GPU.
 */
export class LabelLayer {
  atlas: GlyphAtlas;
  glyphs: GlyphBuffer;

  private store: GraphStore;

  constructor( device: GPUDevice, store: GraphStore ){
    this.store = store;
    this.atlas = new GlyphAtlas( device );
    this.glyphs = new GlyphBuffer( device );
  }

  count(): number {
    return this.glyphs.count();
  }

  uploadedBytes(): number {
    return this.glyphs.uploadedBytes;
  }

  /** Rebuild glyph runs for label-dirty nodes and upload; no-op when clean. */
  process(): void {
    const dirty = this.store.takeLabelDirty();

    for( const slot of dirty ){
      const entry = this.store.labelAt( slot );

      if( entry == null ){
        this.glyphs.set( slot, null );

        continue;
      }

      const laid = layoutLabel( entry.text, ch => this.atlas.metrics( ch ), this.atlas.ascent );

      if( laid.length === 0 ){
        this.glyphs.set( slot, null );

        continue;
      }

      const scale = entry.fontSize / SDF_FONT_SIZE;
      const scratch = new ArrayBuffer( laid.length * GLYPH_WORDS * 4 );
      const u32 = new Uint32Array( scratch );
      const f32 = new Float32Array( scratch );

      for( let i = 0; i < laid.length; i++ ){
        const g = laid[ i ];
        const at = i * GLYPH_WORDS;

        u32[ at ] = slot;
        u32[ at + 1 ] = entry.color;
        f32[ at + 2 ] = g.x * scale;
        f32[ at + 3 ] = entry.anchorY + g.y * scale;
        f32[ at + 4 ] = g.w * scale;
        f32[ at + 5 ] = g.h * scale;
        f32[ at + 6 ] = g.u0;
        f32[ at + 7 ] = g.v0;
        f32[ at + 8 ] = g.u1;
        f32[ at + 9 ] = g.v1;
      }

      this.glyphs.set( slot, u32 );
    }

    this.glyphs.sync();
  }

  destroy(): void {
    this.glyphs.destroy();
    this.atlas.destroy();
  }
}
