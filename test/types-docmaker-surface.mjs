import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import ts from 'typescript';

const docs = JSON.parse( fs.readFileSync( new URL( '../documentation/docmaker.json', import.meta.url ), 'utf8' ) );
const dtsPath = fileURLToPath( new URL( '../build/dts/index.d.ts', import.meta.url ) );

const docByPrefix = new Map();

function addDocName( prefix, name ){
  if( !docByPrefix.has( prefix ) ){
    docByPrefix.set( prefix, new Set() );
  }

  docByPrefix.get( prefix ).add( name );
}

function walkDocs( value ){
  if( Array.isArray( value ) ){
    value.forEach( walkDocs );
    return;
  }

  if( value && typeof value === 'object' ){
    if( typeof value.name === 'string' && /^(cy|eles|ele|node|nodes|edge|edges)\./.test( value.name ) ){
      let [ prefix, name ] = value.name.split( '.' );
      addDocName( prefix, name );
    }

    if( Array.isArray( value.pureAliases ) ){
      for( let alias of value.pureAliases ){
        if( typeof alias === 'string' && /^(cy|eles|ele|node|nodes|edge|edges)\./.test( alias ) ){
          let [ prefix, name ] = alias.split( '.' );
          addDocName( prefix, name );
        }
      }
    }

    Object.values( value ).forEach( walkDocs );
  }
}

walkDocs( docs );

// The public node/edge types are `Omit<>`-based type aliases, not plain
// interfaces, so we resolve effective members through the TypeScript type
// checker rather than walking AST heritage clauses by hand.
const program = ts.createProgram( [ dtsPath ], {
  noEmit: true,
  strict: true,
  lib: [ 'lib.es2020.d.ts', 'lib.dom.d.ts' ],
  moduleResolution: ts.ModuleResolutionKind.Bundler
} );
const checker = program.getTypeChecker();
const source = program.getSourceFile( dtsPath );

// declaration name (as written in the d.ts, e.g. `Element$1`) -> type. Only
// top-level declarations are collected, so the audited `Core` is the public
// cytoscape instance type and not the namespaced `Css.Core` style block.
const declaredTypes = new Map();

for( let node of source.statements ){
  if( ( ts.isInterfaceDeclaration( node ) || ts.isTypeAliasDeclaration( node ) ) && node.name ){
    let symbol = checker.getSymbolAtLocation( node.name );

    if( symbol ){
      declaredTypes.set( node.name.text, checker.getDeclaredTypeOfSymbol( symbol ) );
    }
  }
}

function namesForInterface( name ){
  let type = declaredTypes.get( name );
  let names = new Set();

  if( !type ){
    return names;
  }

  // getPropertiesOfType resolves inherited, intersected, and Omit-projected
  // members into the effective property set.
  for( let prop of checker.getPropertiesOfType( type ) ){
    names.add( prop.getName() );
  }

  return names;
}

const groups = {
  Core: { iface: 'Core', allowed: [ 'cy' ], required: [ 'cy' ] },
  Collection: { iface: 'Collection', allowed: [ 'eles', 'ele', 'node', 'nodes', 'edge', 'edges' ], required: [ 'eles' ] },
  Element: { iface: 'Element$1', allowed: [ 'ele', 'eles', 'node', 'nodes', 'edge', 'edges' ], required: [ 'ele' ] },
  NodeCollection: { iface: 'NodeCollection', allowed: [ 'node', 'nodes', 'ele', 'eles' ], required: [ 'node', 'nodes' ] },
  EdgeCollection: { iface: 'EdgeCollection', allowed: [ 'edge', 'edges', 'ele', 'eles' ], required: [ 'edge', 'edges' ] }
};

// The public node/edge projections now omit cross-kind members at the type
// level (see EdgeOnlyKeys/NodeOnlyKeys in src/collection/eles-types.mts), so no
// residual cross-kind allowlist is needed: the audit holds the generated
// surface to the documented per-kind API exactly.
const allowedResidualExtras = {};

let failed = false;

for( let [ label, config ] of Object.entries( groups ) ){
  let actual = [ ...namesForInterface( config.iface ) ]
    .filter( name => name !== 'instanceString' && name !== 'length' )
    // drop symbol/computed members (e.g. the inherited Symbol.iterator, which
    // the checker names like `__@iterator@151`) and other internal `__`-prefixed
    .filter( name => !name.startsWith( '__@' ) )
    .sort();
  let allowed = new Set( config.allowed.flatMap( prefix => [ ...( docByPrefix.get( prefix ) || [] ) ] ) );
  let required = new Set( config.required.flatMap( prefix => [ ...( docByPrefix.get( prefix ) || [] ) ] ) );
  let residual = allowedResidualExtras[ label ] || new Set();

  let extras = actual.filter( name => !allowed.has( name ) && !residual.has( name ) );
  let missing = [ ...required ].filter( name => !actual.includes( name ) );

  if( extras.length || missing.length ){
    failed = true;
    console.error( `\n[${label}]` );

    if( extras.length ){
      console.error( `Unexpected undocumented members:\n${extras.join( '\n' )}` );
    }

    if( missing.length ){
      console.error( `Missing documented members:\n${missing.join( '\n' )}` );
    }
  }
}

if( failed ){
  process.exit( 1 );
}

console.log( 'docmaker surface audit passed' );