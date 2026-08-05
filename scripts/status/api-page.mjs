// Round 46.5: the API reference, rendered from round 45's generated model.
//
// This is a **preview**, and the page says so.  Round 46 owns the real
// documentation site at `documentation/`; when it ships, this page should
// become a link to it rather than a second renderer to maintain.
//
// It reads the model by importing `scripts/docs-generate.mjs` and calling it,
// not by reading `build/docs/api.json` — so `npm run status` cannot silently
// publish a stale artifact from a previous build.
import { esc } from '../theme.mjs';
import { renderMarkdown, slugify } from './markdown.mjs';

/**
 * Member prose is markdown (round 26's convention is that the doc comment *is*
 * the long prose), so it goes through the same renderer as the documents —
 * including the repo-path linking, which is where most of these prose blocks
 * point their readers.
 */
function prose( text, ctx ){
  if( text == null || text === '' ){ return ''; }

  // JSDoc's `{@link X}` has no markdown meaning and would render literally.
  // The generator does not resolve these (round 45 emits the comment as
  // written), so they become code spans rather than dangling braces.
  const md = String( text ).replace( /\{@link\s+([^}]+)\}/g, ( _, target ) => `\`${target.trim()}\`` );

  return renderMarkdown( md, { ...ctx, sectioned: false } ).html;
}

/**
 * `@throws` and `@see` are **arrays** in the model while `@returns` is a
 * string — round 45 emits one entry per tag occurrence for the first two.
 * Passing an array to the markdown lexer dies with `e.replace is not a
 * function`, which is how this was found.
 */
function tagBody( value, ctx, linkRef ){
  if( value == null ){ return ''; }

  const items = Array.isArray( value ) ? value : [ value ];
  const rendered = items.filter( v => v != null && v !== '' ).map( v => linkRef( prose( v, ctx ) ) );

  if( rendered.length === 0 ){ return ''; }
  if( rendered.length === 1 ){ return rendered[ 0 ]; }

  return `<ul>${rendered.map( r => `<li>${r}</li>` ).join( '' )}</ul>`;
}

function memberHtml( fn, prefix, ctx, seen, linkRef ){
  const slug = seen.get( `${prefix}#${fn.name}` );
  // the factory's members already carry their prefix in the model's `name`
  // (`cytoscape`, `cytoscape.toColumnarElements`), so prefixing again gives
  // `cytoscape.cytoscape.toColumnarElements`
  const sig = prefix == null || fn.name === prefix || fn.name.startsWith( `${prefix}.` )
    ? fn.name : `${prefix}.${fn.name}`;

  const formats = ( fn.formats ?? [] ).map( format => {
    const args = ( format.args ?? [] );
    const argList = args.length > 0
      ? `<dl class="args">${args.map( a =>
        `<dt><code>${esc( a.name )}</code></dt><dd>${prose( a.descr, ctx )}</dd>` ).join( '' )}</dl>`
      : '';

    return `<div class="format">${prose( format.descr, ctx )}${argList}</div>`;
  } ).join( '' );

  const tag = ( label, value ) => {
    const body = tagBody( value, ctx, linkRef );

    return body === '' ? '' : `<div class="tag"><span class="tag-label">${esc( label )}</span>${body}</div>`;
  };

  const aliases = ( fn.pureAliases ?? [] ).length > 0
    ? `<p class="aliases">Also spelled ${fn.pureAliases.map( a => `<code>${esc( a )}</code>` ).join( ', ' )}.</p>`
    : '';

  return `<article class="member" id="${esc( slug )}">
    <h3><a class="anchor" href="#${esc( slug )}" aria-hidden="true" tabindex="-1">#</a><code>${esc( sig )}</code></h3>
    ${formats}
    ${aliases}
    ${tag( 'Returns', fn.returns )}
    ${tag( 'Throws', fn.throws )}
    ${tag( 'See', fn.see )}
  </article>`;
}

/**
 * @param model — `{ sections: [...] }` as `scripts/docs-generate.mjs` emits
 * @returns `{ html, toc, members }`
 */
export function apiPage( model, ctx ){
  const tocSeen = new Map();
  const toc = [];
  let members = 0;

  // First pass: every member's anchor, keyed both by `prefix#name` (how
  // `memberHtml` finds its own) and by `Namespace#name` (how a `@see` spells a
  // cross-reference).  Two passes because a `@see` routinely points forward.
  const seen = new Map();
  const slugSeen = new Map();
  const refs = new Map();

  for( const ns of model.sections ?? [] ){
    for( const group of ns.sections ?? [] ){
      for( const fn of group.fns ?? [] ){
        const slug = slugify( `${ns.prefix}-${fn.name}`, slugSeen );

        seen.set( `${ns.prefix}#${fn.name}`, slug );
        // first spelling wins: an overload does not get a second anchor
        if( !refs.has( `${ns.name}#${fn.name}` ) ){ refs.set( `${ns.name}#${fn.name}`, slug ); }
      }
    }
  }

  /** Turn `Collection#layout` inside rendered prose into a link to its anchor. */
  const linkRef = html => html.replace( /<code>([A-Z]\w+)#(\w+)<\/code>/g, ( whole, nsName, name ) => {
    const slug = refs.get( `${nsName}#${name}` );

    return slug != null ? `<a href="#${esc( slug )}"><code>${esc( nsName )}#${esc( name )}</code></a>` : whole;
  } );

  const namespaces = ( model.sections ?? [] ).map( ns => {
    const nsSlug = slugify( `ns-${ns.name}`, tocSeen );

    toc.push( { depth: 2, text: ns.name, slug: nsSlug } );

    const groups = ( ns.sections ?? [] ).map( group => {
      const groupSlug = slugify( `${ns.name}-${group.name}`, tocSeen );

      toc.push( { depth: 3, text: group.name, slug: groupSlug } );
      members += ( group.fns ?? [] ).length;

      return `<section class="doc-section">
        <h2 id="${esc( groupSlug )}"><a class="anchor" href="#${esc( groupSlug )}" aria-hidden="true" tabindex="-1">#</a>${esc( group.name )}
          <small>${esc( ns.name )}</small></h2>
        ${( group.fns ?? [] ).map( fn => memberHtml( fn, ns.prefix, ctx, seen, linkRef ) ).join( '' )}
      </section>`;
    } ).join( '' );

    return `<h1 class="ns" id="${esc( nsSlug )}">${esc( ns.name )}</h1>${groups}`;
  } ).join( '' );

  const html = `<h1>API reference</h1>
  <p class="lede"><strong>Preview.</strong> Generated from the JSDoc on <code>src/</code> by
  <code>scripts/docs-generate.mjs</code> — the same model round 46 will build the real
  documentation site from. This page exists so the authoring surface can be read as a
  consumer reads it, not as a replacement for that site.</p>
  <p class="lede">${members} documented members.</p>
  ${namespaces}`;

  return { html, toc, members };
}

/** The extra CSS this page needs, appended to the shell's. */
export const API_CSS = `
h1.ns { font-size: 22px; margin: 40px 0 4px; }
.member { margin: 0 0 22px; padding-left: 14px; border-left: 2px solid var(--grid); }
.member h3 { margin: 0 0 4px; font-size: 14px; }
.member h3 code { background: none; border: 0; padding: 0; font-size: 14px; }
.format { margin-bottom: 8px; }
.args { margin: 6px 0 0; display: grid; grid-template-columns: max-content 1fr; gap: 2px 12px; font-size: 13px; }
.args dt { color: var(--ink-2); }
.args dd { margin: 0; }
.args dd p { margin: 0; }
.tag { font-size: 13px; margin: 4px 0; }
.tag p { display: inline; margin: 0; }
.tag-label { color: var(--ink-2); font-weight: 600; margin-right: 6px; }
.aliases { font-size: 13px; color: var(--ink-2); }
.lede { max-width: 82ch; color: var(--ink-2); }`;
