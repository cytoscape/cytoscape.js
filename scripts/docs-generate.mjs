// Round 45: the documentation generator.
//
// Round 26 made JSDoc on the source v4's documentation source of truth and
// deferred the generator that turns it into docmaker input; the gates it put
// in place have kept that input complete ever since — a doc comment on every
// public member, `@throws` wherever one throws, `@param` on every member that
// takes arguments, `@returns` on every one that returns a value. This reads
// them and emits docmaker's shape.
//
//   node scripts/docs-generate.mjs [--out <file>] [--verbose]
//
// The output shape is v3's, because it is the shape the docmaker template
// already renders (`v3/documentation/docmaker.json`):
//
//   { name, descr, formats: [ { descr, args: [ { name, descr } ] } ] }
//
// grouped into the `// -- section --` banners that round 26 chose over a
// bespoke `@section` tag *for this* — which is why keeping them accurate is a
// documented rule rather than a courtesy.
//
// Three things this does not do, each deliberate:
//
//   - It writes no prose sections. Narrative documentation (getting started,
//     styling, performance) is hand-written, and is round 46's.
//   - It emits no `md` field. In v3 that names a markdown file holding a
//     member's long prose; in v4 the long prose *is* the doc comment, which
//     is the whole point of round 26.
//   - It does not decide what is published. The namespace table below is the
//     scope, and it follows v3's docmaker (which documents `cy`, `eles`,
//     `ani` and `layout` and not its internal renderer or style classes)
//     rather than inventing a rule.
//
// Validation is not this file's job either: `test/docs-generate.mjs`
// cross-checks the output against the *shipped* declaration, which is the
// artifact a consumer actually holds.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { auditFile, PUBLIC_API } from './jsdoc-coverage.mjs';

const ROOT = fileURLToPath( new URL( '..', import.meta.url ) );

/**
 * The consumer-reachable namespaces, and the docmaker prefix each takes.
 *
 * The prefixes are v3's where v4 has the same thing (`cy`, `eles`, `ani`,
 * `layout`), so an upgrading reader lands where they expect. Two are v4's
 * own: `event` (v4 owns its Event object since round 41, where v3's was
 * shared and undocumented as a type) and `ctx` (the round-17 layout
 * contract, which has no v3 counterpart at all — v3 layouts are registered
 * by string).
 */
export const NAMESPACES = {
  Core: 'cy',
  Collection: 'eles',
  Animation: 'ani',
  CustomLayout: 'layout',
  LayoutContext: 'ctx',
  Event: 'event'
};

/**
 * Exported classes in the audited files that are deliberately *not*
 * documented, with the reason — kept as a checked structure rather than an
 * omission, on round 37.1's maintained-allowlist terms: a class that stops
 * being internal should fail this file rather than quietly stay unpublished.
 *
 * These are in `jsdoc-coverage.mjs`'s public *tier* — they are gated at 100%
 * documentation coverage, and that is right, because the next maintainer
 * reads them. Being documented for a maintainer and being published in the
 * API reference are different questions.
 */
export const NOT_PUBLISHED = {
  Viewport: 'the engine half of the core viewport methods; a consumer reaches every one of these through `cy` (cy.zoom, cy.pan, cy.fit, …), so publishing it would document the same surface twice under two names',
  StyleEngine: 'the sheet compiler behind `cy.style()` and the read-only style getters; not constructible or reachable from a consumer',
  AnimationManager: 'the per-core scheduler behind `eles.animate()`; the handle a caller holds is Animation',
  Emitter: 'the listener store behind `on`/`off`/`emit`; a consumer never holds one'
};

/** `@tag` at the start of a doc-comment line. */
const TAG_RE = /^@(\w+)\s*(.*)$/;

/**
 * Split a doc comment into its summary prose and its tags.
 *
 * The convention this parses is round 26's: a summary (one sentence first,
 * then any number of paragraphs, markdown allowed), then standard tags. A
 * `@param` names its argument and separates the description with an em dash,
 * which is what lets an argument description contain a colon or a dash of its
 * own without the parse guessing.
 *
 * @param {string} block — the raw `/** … *\/` comment, or '' when absent
 * @returns {{ descr: string, params: object[], returns: string|null,
 *   throws: string[], see: string[] }}
 */
export function parseDoc( block ){
  const body = block
    .replace( /^\s*\/\*\*/, '' )
    .replace( /\*\/\s*$/, '' )
    .split( '\n' )
    .map( line => line.replace( /^\s*\* ?/, '' ) );

  const descrLines = [];
  const tags = [];

  for( const line of body ){
    const m = line.trim().match( TAG_RE );

    if( m ){
      tags.push( { tag: m[1], text: m[2] } );
    } else if( tags.length > 0 ){
      // a continuation of the tag above (indented under it)
      tags[ tags.length - 1 ].text += ` ${line.trim()}`;
    } else {
      descrLines.push( line );
    }
  }

  const params = [];
  const throwsList = [];
  const see = [];
  let returns = null;

  for( const { tag, text } of tags ){
    const clean = text.replace( /\s+/g, ' ' ).trim();

    if( tag === 'param' ){
      // `name — description`, with the em dash as the separator
      const split = clean.match( /^(\[?[\w$.]+\]?)\s*(?:—|--|-)?\s*(.*)$/ );

      if( split ) params.push( { name: split[1], descr: split[2] } );
    } else if( tag === 'returns' || tag === 'return' ){
      returns = clean;
    } else if( tag === 'throws' ){
      throwsList.push( clean );
    } else if( tag === 'see' ){
      see.push( clean );
    }
  }

  return { descr: paragraphs( descrLines ), params, returns, throws: throwsList, see };
}

/** Join wrapped lines into paragraphs, preserving blank-line breaks. */
function paragraphs( lines ){
  const out = [];
  let current = [];

  for( const line of lines ){
    if( line.trim() === '' ){
      if( current.length ) out.push( current.join( ' ' ).trim() );
      current = [];
    } else {
      current.push( line.trim() );
    }
  }

  if( current.length ) out.push( current.join( ' ' ).trim() );

  return out.join( '\n\n' ).trim();
}

/** The first paragraph of a summary — docmaker's one-sentence `descr` role. */
function firstParagraph( descr ){
  return descr.split( '\n\n' )[0] ?? '';
}

/**
 * The factory statics, read from `src/index.mts` rather than listed here.
 *
 * This is what decides whether an exported function is published: `wire.mts`
 * and `columnar.mts` export type predicates (`isPackedIds`,
 * `isColumnarElements`, `isSerializedElements`) beside the three functions
 * the factory actually hangs on itself, and a consumer can reach only the
 * latter. Deriving the set from the assignment lines keeps a hand-written
 * exclusion list from going stale the moment a fourth static is added.
 *
 * @returns {Set<string>} the names assigned as `cytoscape.<name> = …`
 */
export function factoryStatics(){
  const src = readFileSync( join( ROOT, 'src/index.mts' ), 'utf8' );

  return new Set(
    [ ...src.matchAll( /^cytoscape\.([A-Za-z_$][\w$]*)\s*=/gm ) ].map( m => m[1] )
  );
}

/**
 * Build the documentation model from the source.
 *
 * @returns {{ sections: object[], stats: object }}
 */
export function generate(){
  const statics = factoryStatics();
  const byPrefix = new Map();
  const aliasesFor = new Map(); // `${owner}.${target}` -> alias names
  const skipped = [];

  // aliases first: a fn needs every alias that points at it, and they can be
  // declared above or below their target
  for( const rel of PUBLIC_API ){
    for( const a of auditFile( join( ROOT, rel ) ).aliases ){
      const key = `${a.owner}.${a.target}`;

      if( !aliasesFor.has( key ) ) aliasesFor.set( key, [] );
      aliasesFor.get( key ).push( a.name );
    }
  }

  for( const rel of PUBLIC_API ){
    const { members } = auditFile( join( ROOT, rel ) );

    for( const m of members ){
      const prefix = prefixFor( m, statics );

      if( prefix == null ){
        skipped.push( `${m.owner ?? '(module)'}.${m.name} (${rel}:${m.line})` );
        continue;
      }

      const bucket = get( byPrefix, prefix, () => new Map() );
      const section = m.banner ?? defaultSection( prefix );
      const fns = get( bucket, section, () => new Map() );
      // members are visited in source order, so overload signatures of one
      // name arrive consecutively and merge into one fn with several formats
      const key = m.name;
      const fn = get( fns, key, () => ( {
        name: prefix === 'cytoscape' && m.owner == null && m.name === 'cytoscape'
          ? 'cytoscape'
          : `${prefix}.${m.name}`,
        blocks: [],
        src: `${rel}:${m.line}`,
        pureAliases: ( aliasesFor.get( `${m.owner}.${m.name}` ) ?? [] )
          .map( a => `${prefix}.${a}` )
      } ) );

      fn.blocks.push( parseDoc( m.doc ) );
    }
  }

  const sections = [];

  for( const [ prefix, bucket ] of byPrefix ){
    const children = [];

    for( const [ banner, fns ] of bucket ){
      children.push( {
        name: sectionTitle( banner ),
        banner,
        fns: [ ...fns.values() ].map( toDocmakerFn )
      } );
    }

    sections.push( { name: titleFor( prefix ), prefix, sections: children } );
  }

  const count = sections.reduce(
    ( n, s ) => n + s.sections.reduce( ( m, c ) => m + c.fns.length, 0 ), 0
  );

  return {
    sections,
    stats: {
      namespaces: sections.length,
      sections: sections.reduce( ( n, s ) => n + s.sections.length, 0 ),
      fns: count,
      skipped
    }
  };
}

/**
 * Shape one collected member into docmaker's `fns` entry.
 *
 * `descr` is the first paragraph of the primary block — docmaker's field is a
 * summary sentence — while each format keeps its own block's full prose, so
 * an overload's contract is never flattened into its sibling's. `returns`,
 * `throws` and `see` are emitted as their own fields rather than folded into
 * the description: docmaker has no field for them, but folding is lossy and a
 * template can ignore a field it does not know.
 */
function toDocmakerFn( fn ){
  const formats = fn.blocks.map( b => ( {
    descr: b.descr,
    args: b.params
  } ) );

  const primary = fn.blocks[0] ?? { descr: '', params: [], returns: null, throws: [], see: [] };
  const out = {
    name: fn.name,
    descr: firstParagraph( primary.descr ),
    formats
  };

  if( fn.pureAliases.length ) out.pureAliases = fn.pureAliases;
  if( primary.returns ) out.returns = primary.returns;

  const throwsList = fn.blocks.flatMap( b => b.throws );

  if( throwsList.length ) out.throws = [ ...new Set( throwsList ) ];

  const see = fn.blocks.flatMap( b => b.see );

  if( see.length ) out.see = [ ...new Set( see ) ];

  out.src = fn.src;

  return out;
}

/** The docmaker prefix a member belongs under, or null when unpublished. */
function prefixFor( member, statics ){
  if( member.owner == null ){
    // a top-level exported function: published iff the factory hangs it on
    // itself, plus the factory itself
    if( member.name === 'cytoscape' ) return 'cytoscape';

    return statics.has( member.name ) ? 'cytoscape' : null;
  }

  return NAMESPACES[ member.owner ] ?? null;
}

/** Members above the first banner in a class body. */
function defaultSection( prefix ){
  return prefix === 'cytoscape' ? 'entry point' : 'general';
}

/**
 * A banner as a section title.
 *
 * Two normalizations, both mechanical: capitalize (docmaker's sections are
 * sentence case), and drop a trailing `(round N)` parenthetical, which is a
 * code-navigation aid — this codebase cites its own history in comments — and
 * not something a reader of the API reference wants in a heading. Any other
 * parenthetical is the author's and survives verbatim.
 */
export function sectionTitle( banner ){
  const stripped = banner.replace( /\s*\((?:round\s+[\d.]+)\)\s*$/i, '' ).trim();

  return stripped.charAt( 0 ).toUpperCase() + stripped.slice( 1 );
}

const TITLES = {
  cytoscape: 'The cytoscape factory',
  cy: 'Core',
  eles: 'Collection',
  ani: 'Animation',
  layout: 'Layout',
  ctx: 'Layout context',
  event: 'Event'
};

function titleFor( prefix ){
  return TITLES[ prefix ] ?? prefix;
}

function get( map, key, make ){
  if( !map.has( key ) ) map.set( key, make() );

  return map.get( key );
}

// -- cli --

if( import.meta.url === `file://${process.argv[1]}` ){
  const args = process.argv.slice( 2 );
  const outIdx = args.indexOf( '--out' );
  const verbose = args.includes( '--verbose' );
  const model = generate();
  const json = JSON.stringify( { sections: model.sections }, null, 2 );

  if( outIdx !== -1 ){
    const out = join( ROOT, args[ outIdx + 1 ] );

    mkdirSync( dirname( out ), { recursive: true } );
    writeFileSync( out, `${json}\n` );
    console.log( `wrote ${args[ outIdx + 1 ]}` );
  } else if( !verbose ){
    console.log( json );
  }

  const { stats } = model;

  console.error(
    `\n  ${stats.fns} documented members over ${stats.sections} sections in ${stats.namespaces} namespaces`
  );

  if( verbose ){
    for( const s of model.sections ){
      console.error( `\n  ${s.name} (${s.prefix})` );

      for( const c of s.sections ){
        console.error( `    ${c.name}: ${c.fns.length}` );
      }
    }

    console.error( `\n  not published (${stats.skipped.length}):` );

    for( const name of stats.skipped ) console.error( `    ${name}` );
  }
}
