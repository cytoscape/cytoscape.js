import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import ts from 'typescript-compiler-api';

const docs = JSON.parse( fs.readFileSync( new URL( '../documentation/docmaker.json', import.meta.url ), 'utf8' ) );
const dtsPath = fileURLToPath( new URL( '../build/dts/index.d.ts', import.meta.url ) );

// Every dotted member namespace docmaker documents that maps to a public TS
// type. `nodes`/`edges` fold into the node/edge collection groups; `ani` and
// `layout` are the animation and layout instance types. (`Popper` in docmaker
// is extension prose, not a typed member surface, so it is intentionally out.)
const DOC_PREFIX = /^(cy|eles|ele|node|nodes|edge|edges|ani|layout)\./;

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
    if( typeof value.name === 'string' && DOC_PREFIX.test( value.name ) ){
      let [ prefix, name ] = value.name.split( '.' );
      addDocName( prefix, name );
    }

    // Aliases are part of the public API surface and must be exposed too (e.g.
    // `layout.bind` === `layout.on`, `ani.run` === `ani.play`).
    if( Array.isArray( value.pureAliases ) ){
      for( let alias of value.pureAliases ){
        if( typeof alias === 'string' && DOC_PREFIX.test( alias ) ){
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
  if( ( ts.isInterfaceDeclaration( node ) || ts.isTypeAliasDeclaration( node ) || ts.isClassDeclaration( node ) ) && node.name ){
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
  EdgeCollection: { iface: 'EdgeCollection', allowed: [ 'edge', 'edges', 'ele', 'eles' ], required: [ 'edge', 'edges' ] },
  Animation: { iface: 'Animation', allowed: [ 'ani' ], required: [ 'ani' ] },
  LayoutInstance: { iface: 'LayoutInstance', allowed: [ 'layout' ], required: [ 'layout' ] }
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

// --- callability audit -------------------------------------------------------
// The presence audit above resolves member *names* but ignores `this`
// constraints. A method typed `this: Collection` is still present on the
// `Omit<>`-based NodeCollection/NodeSingular/EdgeCollection/EdgeSingular
// projections, yet is NOT callable on them (those projections are not
// assignable to the wide `Collection`). This pass verifies every documented
// member is actually callable on each narrowed kind — i.e. the kind is
// assignable to the method's `this` type. It is how the broad `this: Collection`
// gap (`cy.nodes().style()`, algorithms, dimensions, …) was caught.
const callabilityKinds = {
  NodeSingular: [ 'ele', 'node', 'eles', 'nodes' ],
  EdgeSingular: [ 'ele', 'edge', 'eles', 'edges' ],
  NodeCollection: [ 'eles', 'nodes', 'ele', 'node' ],
  EdgeCollection: [ 'eles', 'edges', 'ele', 'edge' ]
};

for( let [ iface, prefixes ] of Object.entries( callabilityKinds ) ){
  let type = declaredTypes.get( iface );

  if( !type ){
    failed = true;
    console.error( `\n[${iface}] type not found in generated d.ts` );
    continue;
  }

  let docNames = new Set( prefixes.flatMap( prefix => [ ...( docByPrefix.get( prefix ) || [] ) ] ) );
  let props = new Map( checker.getPropertiesOfType( type ).map( sym => [ sym.getName(), sym ] ) );
  let uncallable = [];

  for( let name of [ ...docNames ].sort() ){
    let sym = props.get( name );

    if( !sym ){ continue; } // missing-name is the presence audit's job

    let decl = sym.valueDeclaration || ( sym.declarations && sym.declarations[0] );
    if( !decl ){ continue; }

    let sigs = checker.getTypeOfSymbolAtLocation( sym, decl ).getCallSignatures();
    if( !sigs.length ){ continue; } // not a method

    // callable on this kind iff some signature has no `this` constraint, or the
    // kind type is assignable to the declared `this` type
    let callable = sigs.some( sig => {
      let thisParam = sig.thisParameter;
      if( !thisParam ){ return true; }
      let thisDecl = thisParam.valueDeclaration || ( thisParam.declarations && thisParam.declarations[0] ) || decl;
      let thisType = checker.getTypeOfSymbolAtLocation( thisParam, thisDecl );
      return checker.isTypeAssignableTo( type, thisType );
    } );

    if( !callable ){ uncallable.push( name ); }
  }

  if( uncallable.length ){
    failed = true;
    console.error( `\n[${iface}] documented members present but NOT callable on this kind (this-incompatible):\n${uncallable.join( '\n' )}` );
  }
}

if( failed ){
  process.exit( 1 );
}

console.log( 'docmaker surface audit passed' );
