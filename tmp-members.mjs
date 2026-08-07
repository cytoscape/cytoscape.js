import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { auditFile, auditThrowTags } from './scripts/jsdoc-coverage.mjs';

const ROOT = process.argv[ 2 ];
const files = [];
const walk = d => { for( const e of readdirSync( d ) ){ const p = join( d, e );
  if( statSync( p ).isDirectory() ) walk( p ); else if( p.endsWith( '.mts' ) ) files.push( p ); } };
walk( join( ROOT, 'src' ) );
files.sort();
const out = [];
for( const f of files ){
  const r = auditFile( f );
  for( const m of r.members ?? [] ){ out.push( `M ${f.replace(ROOT,'')} ${m.cls ?? ''}.${m.name}` ); }
  const t = auditThrowTags( f );
  out.push( `T ${f.replace(ROOT,'')} tagged=${t.tagged} missing=${(t.missing??[]).join('|')} total=${t.total ?? ''}` );
}
console.log( out.join( '\n' ) );
