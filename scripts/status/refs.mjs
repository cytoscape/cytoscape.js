// Round 46.5: every URL the deployed site will ask for.
//
// Two collectors, and the second is the point:
//
//   markup   — `src` / `href` in the emitted HTML
//   runtime  — URLs built in JS and handed to `fetch()`
//
// Round 42 verified every `src`/`href` in all six harness pages and four of the
// debug page's seven networks were 404ing the whole time, because their URLs
// live in `debug/networks.js` and are handed to `fetch()`.  The page rendered
// nothing, said nothing, and no test noticed.  AGENTS.md draws the general
// lesson — *enumerate what the runtime asks for, not what the markup declares*
// — and this module is that lesson made executable.
import { createContext, runInContext } from 'node:vm';
import { posix } from 'node:path';

/**
 * URLs in emitted HTML, split by what the browser does with them.
 *
 * The distinction is load-bearing.  A **resource** (`src`, `<link href>`) is
 * fetched whether the reader wants it or not, so an external one is a
 * dependency of the page and has to be a decision.  A **link** (`<a href>`) is
 * navigation the reader chooses; the documents link freely to the wider web,
 * and an allowlist over those hosts would be unbounded churn that says nothing
 * about whether the site works.
 *
 * @returns `[ { url, kind: 'resource' | 'link' } ]`
 */
export function markupRefs( html ){
  const refs = [];

  for( const tag of html.matchAll( /<(a|img|script|link|source|iframe)\b([^>]*)>/gi ) ){
    const name = tag[ 1 ].toLowerCase();
    const attrs = tag[ 2 ];

    for( const attr of attrs.matchAll( /\b(src|href)\s*=\s*"([^"]*)"/g ) ){
      const url = attr[ 2 ];

      if( url === '' || url.startsWith( '#' ) || url.startsWith( 'data:' ) || url.startsWith( 'mailto:' ) ){
        continue;
      }

      refs.push( { url, kind: name === 'a' ? 'link' : 'resource' } );
    }
  }

  return refs;
}

/**
 * The URLs `debug/init.js` will fetch, read out of the **emitted**
 * `networks.js` — so the generated patch is what is exercised, not the source
 * file.  Same technique as `test/modules/debug-harness.mjs`.
 */
export function networkRefs( networksSource ){
  const ctx = createContext( { module: undefined } );

  runInContext( networksSource, ctx );

  return Object.entries( ctx.networks )
    .filter( ( [ , def ] ) => !def.generated && def.url != null )
    .map( ( [ id, def ] ) => ( { id, url: def.url, remoteUrl: def.remoteUrl ?? null } ) );
}

/**
 * Every reference the site makes, resolved against the page that makes it.
 *
 * @param plan — the ops from `buildPlan()`
 * @returns `[ { page, url, resolved, external } ]` where `resolved` is the
 *   site-relative path a local reference points at
 */
export function enumerateRefs( ops ){
  const refs = [];
  const written = new Map( ops.filter( op => op.kind === 'write' ).map( op => [ op.to, op.text ] ) );

  const add = ( from, url, source, kind = 'resource' ) => {
    const external = /^[a-z]+:/i.test( url ) || url.startsWith( '//' );

    refs.push( {
      page: from,
      url,
      source,
      kind,
      external,
      // a leading slash is site-absolute; anything else resolves against the
      // directory of the page that wrote it
      resolved: external ? null
        : url.startsWith( '/' ) ? url.slice( 1 )
          : posix.normalize( posix.join( posix.dirname( from ), url ) )
    } );
  };

  for( const [ to, text ] of written ){
    if( to.endsWith( '.html' ) ){
      for( const ref of markupRefs( text ) ){ add( to, ref.url, 'markup', ref.kind ); }
    }

    if( to === 'debug/networks.js' ){
      for( const net of networkRefs( text ) ){
        // *One* url per network, and it must be the one the deployed page will
        // actually request.  The status build sets `DEBUG_FIXTURE_SOURCE =
        // 'remote'`, so `debug/init.js` prefers `remoteUrl` wherever there is
        // one — enumerating the local url as well would demand a file the
        // hosted page never asks for, and enumerating only the local one would
        // miss the request it does make.
        net.remoteUrl != null
          ? add( 'debug/networks.js', net.remoteUrl, `runtime:${net.id}:remote` )
          : add( 'debug/networks.js', net.url, `runtime:${net.id}` );
      }
    }
  }

  return refs;
}
