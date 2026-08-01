/*
Multiline label shaping (round 16.1): line breaking with v3's
`text-wrap` semantics, justification, ellipsis truncation, and the
laid block metrics — a pure module with injected advances, so the same
breaking logic runs in two places:

- the renderer's LabelLayer lays glyphs with real atlas advances
  (exact dims, fed back to the store for the label bb term), and
- the store's headless estimator (`estimateBlock`) runs it with flat
  per-character advances, so `boundingBox()`/`fit()` stay meaningful
  with no renderer (a recorded approximation — headless label bounds
  are estimates; rendered instances upgrade them to exact).

Breaking rules (v3's, verbatim where they exist):
- `none`: one line; newlines/tabs collapse to spaces (the pass-1 rule).
- `wrap`: embedded \n are honored; each hard line wraps greedily at
  `text-max-width`.  `text-overflow-wrap: whitespace` breaks only at
  whitespace (an over-long word overflows on its own line — v3);
  `anywhere` splits words mid-run to fit.
- `ellipsis`: one line truncated to fit `text-max-width` with a
  trailing '…' (newlines collapse first).

Justification places each line inside the block (whose own center is
the anchor): left flush, centered, or right flush.  `auto` resolves
against `text-halign` before it gets here (v3's rule: a label hanging
left of its node right-justifies, and vice versa).
*/

import type { GlyphMetrics } from './render/glyph-atlas.mjs';
import type { LaidGlyph } from './render/label-layout.mjs';

export const WRAP_NONE = 0;
export const WRAP_WRAP = 1;
export const WRAP_ELLIPSIS = 2;

export const OFLOW_WHITESPACE = 0;
export const OFLOW_ANYWHERE = 1;

export const JUSTIFY_LEFT = 0;
export const JUSTIFY_CENTER = 1;
export const JUSTIFY_RIGHT = 2;

export const ELLIPSIS = '…';

export interface WrapOpts {
  wrap: number;
  /** the wrap/truncation width in the advance function's own units */
  maxWidth: number;
  overflowWrap: number;
  justification: number;
  /** line advance as a multiple of the em */
  lineHeight: number;
}

export interface BrokenLine {
  text: string;
  width: number;
}

export interface LaidBlock {
  glyphs: LaidGlyph[];
  /** widest line's advance width */
  width: number;
  /** (lines - 1) × lineAdvance + em */
  height: number;
  lines: number;
}

const measure = ( text: string, advanceOf: ( ch: string ) => number ): number => {
  let w = 0;

  for( const ch of text ){ w += advanceOf( ch ); }

  return w;
};

/** Break text into lines per the wrap opts; widths via advanceOf. */
export const breakLines = (
  text: string, advanceOf: ( ch: string ) => number, opts: WrapOpts
): BrokenLine[] => {
  const single = ( t: string ): string => t.replace( /[\n\t]/g, ' ' );

  if( opts.wrap === WRAP_NONE || !( opts.maxWidth > 0 ) || opts.maxWidth === Infinity && opts.wrap === WRAP_ELLIPSIS ){
    if( opts.wrap !== WRAP_WRAP ){
      const t = single( text );

      if( opts.wrap === WRAP_ELLIPSIS && opts.maxWidth !== Infinity ){
        return [ truncate( t, advanceOf, opts.maxWidth ) ];
      }

      return [ { text: t, width: measure( t, advanceOf ) } ];
    }
  }

  if( opts.wrap === WRAP_ELLIPSIS ){
    return [ truncate( single( text ), advanceOf, opts.maxWidth ) ];
  }

  // wrap: honor hard newlines, then wrap each hard line greedily
  const out: BrokenLine[] = [];

  for( const hard of text.split( '\n' ) ){
    if( hard === '' ){
      out.push( { text: '', width: 0 } );

      continue;
    }

    if( !( opts.maxWidth > 0 ) || opts.maxWidth === Infinity ){
      out.push( { text: hard, width: measure( hard, advanceOf ) } );

      continue;
    }

    wrapLine( hard, advanceOf, opts, out );
  }

  return out;
};

const truncate = (
  text: string, advanceOf: ( ch: string ) => number, maxWidth: number
): BrokenLine => {
  const full = measure( text, advanceOf );

  if( full <= maxWidth ){ return { text, width: full }; }

  const dots = advanceOf( ELLIPSIS );
  let width = 0;
  let kept = '';

  for( const ch of text ){
    const a = advanceOf( ch );

    if( width + a + dots > maxWidth ){ break; }

    kept += ch;
    width += a;
  }

  return { text: kept + ELLIPSIS, width: width + dots };
};

const wrapLine = (
  hard: string, advanceOf: ( ch: string ) => number, opts: WrapOpts, out: BrokenLine[]
): void => {
  const tokens = hard.split( /(\s+)/ ).filter( t => t !== '' );
  let line = '';
  let width = 0;

  const flush = (): void => {
    const trimmed = line.replace( /\s+$/, '' );

    out.push( { text: trimmed, width: measure( trimmed, advanceOf ) } );
    line = '';
    width = 0;
  };

  for( const token of tokens ){
    const isSpace = /^\s+$/.test( token );
    const tw = measure( token, advanceOf );

    if( isSpace ){
      line += token;
      width += tw;

      continue;
    }

    if( width + tw <= opts.maxWidth || line === '' ){
      if( line === '' && tw > opts.maxWidth && opts.overflowWrap === OFLOW_ANYWHERE ){
        // anywhere: split the over-long word to fit
        let piece = '';
        let pw = 0;

        for( const ch of token ){
          const a = advanceOf( ch );

          if( pw + a > opts.maxWidth && piece !== '' ){
            out.push( { text: piece, width: pw } );
            piece = '';
            pw = 0;
          }

          piece += ch;
          pw += a;
        }

        line = piece;
        width = pw;

        continue;
      }

      // fits (or a lone over-long word under whitespace: overflow, v3)
      line += token;
      width += tw;

      continue;
    }

    flush();

    if( tw > opts.maxWidth && opts.overflowWrap === OFLOW_ANYWHERE ){
      let piece = '';
      let pw = 0;

      for( const ch of token ){
        const a = advanceOf( ch );

        if( pw + a > opts.maxWidth && piece !== '' ){
          out.push( { text: piece, width: pw } );
          piece = '';
          pw = 0;
        }

        piece += ch;
        pw += a;
      }

      line = piece;
      width = pw;
    } else {
      line = token;
      width = tw;
    }
  }

  if( line !== '' || out.length === 0 ){ flush(); }
};

/**
 * Lay out a (possibly multiline) glyph block: lines broken per opts,
 * stacked by lineHeight × em, justified inside the block, the whole
 * block centered about x = 0 with y = 0 at the first line's top.
 */
export const layoutLabelBlock = (
  text: string,
  metricsFor: ( ch: string ) => GlyphMetrics | null,
  ascent: number,
  em: number,
  opts: WrapOpts
): LaidBlock => {
  const advanceOf = ( ch: string ): number => metricsFor( ch )?.advance ?? 0;
  const lines = breakLines( text, advanceOf, opts );
  const blockW = lines.reduce( ( w, l ) => Math.max( w, l.width ), 0 );
  const lineAdvance = em * opts.lineHeight;
  const glyphs: LaidGlyph[] = [];

  for( let li = 0; li < lines.length; li++ ){
    const line = lines[ li ];
    const x0 = opts.justification === JUSTIFY_LEFT ? -blockW / 2
      : opts.justification === JUSTIFY_RIGHT ? blockW / 2 - line.width
      : -line.width / 2;
    const y0 = li * lineAdvance;
    let pen = 0;

    for( const raw of line.text ){
      const ch = raw === '\t' ? ' ' : raw;
      const m = metricsFor( ch );

      if( m == null ){ continue; }

      if( m.w > 0 ){
        glyphs.push( {
          x: x0 + pen + m.planeX,
          y: y0 + ascent + m.planeY,
          w: m.w,
          h: m.h,
          u0: m.u0,
          v0: m.v0,
          u1: m.u1,
          v1: m.v1
        } );
      }

      pen += m.advance;
    }
  }

  return {
    glyphs,
    width: blockW,
    height: ( lines.length - 1 ) * lineAdvance + em,
    lines: lines.length
  };
};

/** flat advance ratios for the headless estimator (em fractions) */
const EST_ADVANCE = 0.54;
const EST_SPACE = 0.28;

/**
 * The headless dims estimator: the same breaking logic over flat
 * advances, in model px (fontSize is the em).  Rendered instances
 * overwrite these with exact laid dims; headless bounds are estimates
 * (recorded).
 */
export const estimateBlock = (
  text: string, fontSize: number, opts: WrapOpts
): { width: number; height: number; lines: number } => {
  const advanceOf = ( ch: string ): number =>
    ( ch === ' ' ? EST_SPACE : EST_ADVANCE ) * fontSize;
  const lines = breakLines( text, advanceOf, opts );

  return {
    width: lines.reduce( ( w, l ) => Math.max( w, l.width ), 0 ),
    height: ( lines.length - 1 ) * fontSize * opts.lineHeight + fontSize,
    lines: lines.length
  };
};
