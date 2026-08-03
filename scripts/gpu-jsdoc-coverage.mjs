// Measures JSDoc coverage of the v4 GPU prototype (src/gpu), the authoring
// surface the release documentation is generated from (round 26; see PLAN.md
// and the "Documenting the source" section of src/gpu/README.md).
//
// A *public member* is a member of an exported class whose name does not begin
// with `_` and which is not marked `private`/`protected`, plus every top-level
// exported function — i.e. exactly what a consumer can reach and what a docs
// generator would emit. Coverage is split
// into two tiers: the PUBLIC_API files, which are the documented v4 surface and
// are gated at 100%, and everything else in src/gpu, which is documented for
// the next maintainer and carries a ratcheting floor.
//
// Run directly (`node scripts/gpu-jsdoc-coverage.mjs [--verbose]`) for a report;
// `test/gpu-jsdoc-coverage.mjs` imports `audit()` and enforces the thresholds.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath( new URL( '..', import.meta.url ) );
const GPU_DIR = join( ROOT, 'src/gpu' );

/**
 * The v4 public API: the files whose exported classes a consumer of
 * `cytoscape/gpu` actually holds. Gated at 100% public-member coverage.
 */
export const PUBLIC_API = [
  'src/gpu/index.mts',
  'src/gpu/core.mts',
  'src/gpu/collection.mts',
  'src/gpu/viewport.mts',
  'src/gpu/animation.mts',
  'src/gpu/style.mts',
  'src/gpu/columnar.mts',
  'src/gpu/wire.mts',
  'src/gpu/layout/contract.mts'
];

// A member declaration at class-body indentation: an optional modifier run,
// then the name, then `(`, `:` or `=`. Deliberately anchored at two spaces so
// nested function bodies inside a method never match.
const MEMBER_RE =
  /^ {2}(?:(public|private|protected)\s+)?(?:static\s+)?(?:readonly\s+)?(?:(get|set)\s+)?(?:async\s+)?(?:\*\s*)?([A-Za-z_$][\w$]*)\s*(?:<[^>=]*>)?\s*(?:\(|[:=])/;
const CLASS_RE = /^(export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/;

// Any other top-level declaration ends the class body we are inside. Without
// this an `interface`'s members read as members of the class above it.
const TOP_LEVEL_RE =
  /^(?:export\s+)?(?:declare\s+)?(?:default\s+)?(?:interface|type|function|const|let|var|enum|namespace|module)\b/;

// A top-level exported function, in either spelling: `export function f(` and
// `export const f = (` / `= async (` / `= function`. Exported consts that are
// not functions are data, not API surface, and are left out.
const EXPORTED_FN_RE =
  /^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^export\s+const\s+([A-Za-z_$][\w$]*)(?::[^=]+)?\s*=\s*(?:async\s*)?(?:function\b|(?:<[^>]*>)?\s*\()/;

// An overload *signature*: a call signature terminated by `;` rather than a
// body. The implementation signature that follows a run of these is not
// separately documentable — TypeScript hides it from callers — so it is
// skipped rather than counted as a miss.
const OVERLOAD_SIG_RE = /^ {2}(?:(?:public|private|protected|static|readonly|async)\s+)*([A-Za-z_$][\w$]*)\s*(?:<[^>=]*>)?\s*\([^;]*\)\s*:[^;]*;\s*$/;

// Statement keywords that can appear at two-space indentation inside a class
// body's methods and would otherwise read as member names.
const KEYWORDS = new Set( [
  'if', 'for', 'while', 'switch', 'return', 'case', 'catch', 'else', 'do',
  'try', 'const', 'let', 'var', 'new', 'await', 'throw', 'typeof', 'delete',
  'break', 'continue', 'yield', 'function', 'class'
] );

/** A doc comment is the nearest non-blank line above, ending the block. */
function hasDocAbove( lines, i ){
  let j = i - 1;

  while( j >= 0 && lines[j].trim() === '' ) j--;

  return j >= 0 && lines[j].trim().endsWith( '*/' );
}

/**
 * Audit one file's public members.
 *
 * @param {string} file — absolute path to a `.mts` source file
 * @returns {{ file: string, documented: number, missing: string[] }}
 */
export function auditFile( file ){
  const lines = readFileSync( file, 'utf8' ).split( '\n' );
  const rel = relative( ROOT, file );
  const missing = [];
  let documented = 0;
  let currentClass = null;
  let exported = false;
  let inComment = false;
  let overloaded = new Set();

  for( let i = 0; i < lines.length; i++ ){
    const line = lines[i];

    // Prose inside a block comment can look like a member declaration
    // ("rgba(...,0); label channels ..."), so skip comment bodies outright.
    if( inComment ){
      if( line.includes( '*/' ) ) inComment = false;
      continue;
    }

    const opened = line.lastIndexOf( '/*' );

    if( opened !== -1 && line.indexOf( '*/', opened ) === -1 ){
      inComment = true;
      continue;
    }

    const fn = line.match( EXPORTED_FN_RE );

    if( fn ){
      currentClass = null;

      const name = fn[1] ?? fn[2];

      if( hasDocAbove( lines, i ) ) documented++;
      else missing.push( `${name}() (${rel}:${i + 1})` );

      continue;
    }

    const cls = line.match( CLASS_RE );

    if( cls ){
      currentClass = cls[2];
      exported = Boolean( cls[1] );
      overloaded = new Set();
      continue;
    }

    if( TOP_LEVEL_RE.test( line ) ){
      currentClass = null;
      continue;
    }

    if( !currentClass || !exported ) continue;

    const sig = line.match( OVERLOAD_SIG_RE );
    const m = line.match( MEMBER_RE );

    if( !m ) continue;

    const [ , access, , name ] = m;

    if( name.startsWith( '_' ) || KEYWORDS.has( name ) ) continue;
    if( access === 'private' || access === 'protected' ) continue;

    // The implementation signature closing a run of overloads: callers only
    // ever see the overloads, each of which carries its own doc block.
    if( !sig && overloaded.has( name ) ) continue;

    if( sig ) overloaded.add( name );

    if( hasDocAbove( lines, i ) ) documented++;
    else missing.push( `${currentClass}.${name} (${rel}:${i + 1})` );
  }

  return { file: rel, documented, missing };
}

/** Every `.mts` file under src/gpu, sorted, repo-relative. */
function sources( dir = GPU_DIR, out = [] ){
  for( const entry of readdirSync( dir ).sort() ){
    const full = join( dir, entry );

    if( statSync( full ).isDirectory() ) sources( full, out );
    else if( entry.endsWith( '.mts' ) ) out.push( full );
  }

  return out;
}

/**
 * Audit the whole prototype, split into the public and internal tiers.
 *
 * @returns {{ public: object, internal: object, files: object[] }} per-tier
 *   `{ documented, total, pct, missing }` plus the per-file breakdown.
 */
export function audit(){
  const files = sources().map( auditFile );
  const tier = list => {
    const documented = list.reduce( ( n, f ) => n + f.documented, 0 );
    const total = list.reduce( ( n, f ) => n + f.documented + f.missing.length, 0 );

    return {
      documented,
      total,
      pct: total === 0 ? 100 : ( documented / total ) * 100,
      missing: list.flatMap( f => f.missing )
    };
  };

  const isPublic = f => PUBLIC_API.includes( f.file );

  return {
    public: tier( files.filter( isPublic ) ),
    internal: tier( files.filter( f => !isPublic( f ) ) ),
    files
  };
}

if( process.argv[1] && import.meta.url === pathToFileURL( process.argv[1] ).href ){
  const result = audit();
  const verbose = process.argv.includes( '--verbose' );
  const pct = t => `${t.documented}/${t.total} (${t.pct.toFixed( 1 )}%)`;

  for( const f of [ ...result.files ].sort( ( a, b ) => b.missing.length - a.missing.length ) ){
    const total = f.documented + f.missing.length;

    if( total === 0 ) continue;

    const mark = PUBLIC_API.includes( f.file ) ? '*' : ' ';

    console.log(
      `${mark} ${f.file}: ${f.documented}/${total} ` +
      `(${Math.round( ( f.documented / total ) * 100 )}%)`
    );

    if( verbose ) for( const m of f.missing ) console.log( `      MISSING  ${m}` );
  }

  console.log( `\n* public API tier: ${pct( result.public )}` );
  console.log( `  internal tier:   ${pct( result.internal )}` );
}
