import { GlyphAtlas, SDF_FONT_SIZE, SDF_RADIUS } from './glyph-atlas.mjs';
import { layoutLabel } from './label-layout.mjs';
import { GLYPH_ROTATE, GLYPH_WORDS, GlyphBuffer } from './glyph-buffer.mjs';
import type { GraphStore } from '../store/graph-store.mjs';
import type { GroupName } from '../contract.mjs';

/**
 * Consumes the model's label-dirty channel each frame: lays out changed
 * labels against the SDF atlas and (re)writes their glyph runs in the
 * persistent GlyphBuffer.  Position changes never reach this layer —
 * glyphs follow their node on-GPU.
 */
export class LabelLayer {
  atlas: GlyphAtlas;
  glyphs: GlyphBuffer;
  /** the edge label stream: same instance layout, keyed by edge slot */
  edgeGlyphs: GlyphBuffer;

  private store: GraphStore;

  constructor( device: GPUDevice, store: GraphStore ){
    this.store = store;
    this.atlas = new GlyphAtlas( device );
    this.glyphs = new GlyphBuffer( device );
    this.edgeGlyphs = new GlyphBuffer( device );
  }

  count(): number {
    return this.glyphs.count() + this.edgeGlyphs.count();
  }

  /**
   * Rebuild every glyph run against freshly rasterized glyphs — for fonts
   * that finish loading after glyphs were cached from the fallback face.
   */
  reraster(): void {
    this.atlas.reraster();
    this.store.markAllLabelsDirty();
  }

  uploadedBytes(): number {
    return this.glyphs.uploadedBytes + this.edgeGlyphs.uploadedBytes;
  }

  /** Rebuild glyph runs for label-dirty elements and upload; no-op when clean. */
  process(): void {
    // a font change arrives with every labelled slot already label-dirty,
    // so the reset and the rebuild land in this same pass
    this.atlas.setFont( this.store.labelFont );

    this.processGroup( 'nodes', this.glyphs );
    this.processGroup( 'edges', this.edgeGlyphs );
  }

  private processGroup( group: GroupName, glyphs: GlyphBuffer ): void {
    const dirty = this.store.takeLabelDirty( group );

    for( const slot of dirty ){
      const entry = this.store.labelAt( slot, group );

      if( entry == null ){
        glyphs.set( slot, null );

        continue;
      }

      const laid = layoutLabel( entry.text, ch => this.atlas.metrics( ch ), this.atlas.ascent );

      if( laid.length === 0 ){
        glyphs.set( slot, null );

        continue;
      }

      const scale = entry.fontSize / SDF_FONT_SIZE;

      // outline width in SDF sample units: model px → raster px (/ scale)
      // → samples (/ SDF_RADIUS); clamped so it can't cross the whole range
      const outlineW = entry.outlineWidth > 0
        ? Math.min( entry.outlineWidth / scale / SDF_RADIUS, 0.45 )
        : 0;

      // an optional solid background quad precedes the glyphs in the run
      const hasBg = ( ( entry.bgColor >>> 24 ) & 0xff ) > 0;
      const count = laid.length + ( hasBg ? 1 : 0 );
      const scratch = new ArrayBuffer( count * GLYPH_WORDS * 4 );
      const u32 = new Uint32Array( scratch );
      const f32 = new Float32Array( scratch );
      let at = 0;

      // autorotate rides bit 31 of the owner word (edge stream only); the
      // background quad carries it too, so the box rotates with its text
      const owner = ( entry.rotate ? slot | GLYPH_ROTATE : slot ) >>> 0;

      if( hasBg ){
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        for( const g of laid ){
          minX = Math.min( minX, g.x );
          minY = Math.min( minY, g.y );
          maxX = Math.max( maxX, g.x + g.w );
          maxY = Math.max( maxY, g.y + g.h );
        }

        const pad = entry.bgPadding;

        u32[ at ] = owner;
        u32[ at + 1 ] = entry.bgColor;
        f32[ at + 2 ] = minX * scale + entry.marginX - pad;
        f32[ at + 3 ] = entry.anchorY + minY * scale - pad;
        f32[ at + 4 ] = ( maxX - minX ) * scale + 2 * pad;
        f32[ at + 5 ] = ( maxY - minY ) * scale + 2 * pad;
        f32[ at + 6 ] = -1; // u0 < 0: solid quad, no atlas sample
        f32[ at + 7 ] = ( maxY - minY ) * scale; // LOD height: the glyph block's
        f32[ at + 8 ] = -1;
        f32[ at + 9 ] = -1;
        u32[ at + 10 ] = 0;
        f32[ at + 11 ] = 0;
        at += GLYPH_WORDS;
      }

      for( let i = 0; i < laid.length; i++ ){
        const g = laid[ i ];

        u32[ at ] = owner;
        u32[ at + 1 ] = entry.color;
        f32[ at + 2 ] = g.x * scale + entry.marginX;
        f32[ at + 3 ] = entry.anchorY + g.y * scale;
        f32[ at + 4 ] = g.w * scale;
        f32[ at + 5 ] = g.h * scale;
        f32[ at + 6 ] = g.u0;
        f32[ at + 7 ] = g.v0;
        f32[ at + 8 ] = g.u1;
        f32[ at + 9 ] = g.v1;
        u32[ at + 10 ] = entry.outlineColor;
        f32[ at + 11 ] = outlineW;
        at += GLYPH_WORDS;
      }

      glyphs.set( slot, u32 );
    }

    glyphs.sync();
  }

  destroy(): void {
    this.glyphs.destroy();
    this.edgeGlyphs.destroy();
    this.atlas.destroy();
  }
}
