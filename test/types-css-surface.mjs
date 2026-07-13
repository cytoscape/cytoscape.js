// Docs/runtime-driven parity audit for the public `Css.*` style typing surface.
//
// The runtime style inventory in `src/style/properties.mts` is the source of
// truth for which style properties exist and which element kind they apply to.
// This audit cross-checks that the GENERATED declarations (build/dts/index.d.ts,
// emitted from `src/style/css-types.mts`) cover that inventory exactly:
//
//   * every runtime property is typed on the interface(s) it applies to, and
//   * every typed property (and alias) corresponds to a real runtime property.
//
// It is the style-property analogue of the method surface audit in
// `types-docmaker-surface.mjs`. Run via `npm run test:types:css` (which builds
// the declarations first). Needs tsx to import the .mts runtime inventory.
import fs from 'node:fs';
import ts from 'typescript-compiler-api';
import styfn from '../src/style/properties.mjs';

// --- runtime inventory ------------------------------------------------------

// Which generated interface each runtime property group maps onto. `common`
// groups apply to all elements (typed on CommonElement, which Node and Edge
// both extend); the rest are node-, edge-, or core-specific. Keep this in sync
// with the same mapping in scripts/gen-css-types.mjs.
const GROUP_TARGET = {
  behavior: 'common', transition: 'common', visibility: 'common',
  overlay: 'common', underlay: 'common', ghost: 'common',
  commonLabel: 'common', labelDimensions: 'common', mainLabel: 'common',
  sourceLabel: 'common', targetLabel: 'common',
  nodeBody: 'node', nodeBorder: 'node', nodeOutline: 'node',
  backgroundImage: 'node', pie: 'node', stripe: 'node', compound: 'node',
  edgeLine: 'edge', edgeArrow: 'edge',
  core: 'core'
};

const runtimeTarget = new Map(); // property name -> 'common' | 'node' | 'edge' | 'core'

for( let group of styfn.propertyGroupKeys ){
  let target = GROUP_TARGET[ group ];

  if( !target ){
    console.error( `Unmapped style property group '${group}'. Update GROUP_TARGET in test/types-css-surface.mjs and scripts/gen-css-types.mjs.` );
    process.exit( 1 );
  }

  for( let name of styfn.propertyGroupNames[ group ] ){
    runtimeTarget.set( name, target );
  }
}

// aliases inherit the target of the property they point to
for( let alias of styfn.aliases ){
  runtimeTarget.set( alias.name, runtimeTarget.get( alias.pointsTo ) );
}

const aliasNames = new Set( styfn.aliases.map( a => a.name ) );

// required (non-alias) property names per element kind
const requiredCore = new Set( [ ...runtimeTarget ].filter( ( [ n, t ] ) => t === 'core' && !aliasNames.has( n ) ).map( ( [ n ] ) => n ) );
const requiredNode = new Set( [ ...runtimeTarget ].filter( ( [ n, t ] ) => ( t === 'node' || t === 'common' ) && !aliasNames.has( n ) ).map( ( [ n ] ) => n ) );
const requiredEdge = new Set( [ ...runtimeTarget ].filter( ( [ n, t ] ) => ( t === 'edge' || t === 'common' ) && !aliasNames.has( n ) ).map( ( [ n ] ) => n ) );

// every known runtime name (incl. aliases) — used to flag typed-but-unknown props
const knownNames = new Set( runtimeTarget.keys() );

// --- generated declaration surface ------------------------------------------

const dtsPath = new URL( '../build/dts/index.d.ts', import.meta.url );
const dts = fs.readFileSync( dtsPath, 'utf8' );
const source = ts.createSourceFile( dtsPath.pathname, dts, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS );

// find the `Css` namespace and collect its interface declarations
let cssBody = null;

function findCss( node ){
  if( ts.isModuleDeclaration( node ) && node.name && node.name.text === 'Css' && node.body ){
    cssBody = node.body;
  }

  ts.forEachChild( node, findCss );
}

findCss( source );

if( !cssBody ){
  console.error( 'Could not find the exported `Css` namespace in the generated d.ts. Is build:types up to date?' );
  process.exit( 1 );
}

const cssInterfaces = new Map();

for( let stmt of cssBody.statements ){
  if( ts.isInterfaceDeclaration( stmt ) ){
    cssInterfaces.set( stmt.name.text, stmt );
  }
}

// own (non-index-signature) property names of a Css interface, plus inherited
function namesForCssInterface( name, seen = new Set() ){
  if( seen.has( name ) ){ return new Set(); }
  seen.add( name );

  let node = cssInterfaces.get( name );
  let names = new Set();

  if( !node ){ return names; }

  for( let member of node.members ){
    if( ts.isPropertySignature( member ) && member.name ){
      let text = member.name.text ?? ( ts.isStringLiteral( member.name ) ? member.name.text : undefined );

      if( text != null ){
        names.add( text );
      }
    }
  }

  for( let clause of node.heritageClauses || [] ){
    for( let type of clause.types ){
      if( ts.isIdentifier( type.expression ) ){
        for( let inherited of namesForCssInterface( type.expression.text, seen ) ){
          names.add( inherited );
        }
      }
    }
  }

  return names;
}

const groups = {
  'Css.Core': { iface: 'Core', required: requiredCore },
  'Css.Node': { iface: 'Node', required: requiredNode },
  'Css.Edge': { iface: 'Edge', required: requiredEdge }
};

let failed = false;

for( let [ label, config ] of Object.entries( groups ) ){
  if( !cssInterfaces.has( config.iface ) ){
    failed = true;
    console.error( `\n[${label}]\nMissing interface '${config.iface}' in the generated Css namespace.` );
    continue;
  }

  let actual = namesForCssInterface( config.iface );

  let missing = [ ...config.required ].filter( name => !actual.has( name ) ).sort();
  let extras = [ ...actual ].filter( name => !knownNames.has( name ) ).sort();

  if( missing.length || extras.length ){
    failed = true;
    console.error( `\n[${label}]` );

    if( missing.length ){
      console.error( `Documented style properties missing from the typed surface:\n${missing.join( '\n' )}` );
    }

    if( extras.length ){
      console.error( `Typed style properties not found in the runtime inventory:\n${extras.join( '\n' )}` );
    }
  }
}

if( failed ){
  console.error( '\nRegenerate the declarations with `npm run gen:css-types` after changing src/style/properties.mts.' );
  process.exit( 1 );
}

console.log( `css surface audit passed (core ${requiredCore.size}, node ${requiredNode.size}, edge ${requiredEdge.size} properties)` );
