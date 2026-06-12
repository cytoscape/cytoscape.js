import fs from 'node:fs';
import ts from 'typescript';

const docs = JSON.parse( fs.readFileSync( new URL( '../documentation/docmaker.json', import.meta.url ), 'utf8' ) );
const dtsPath = new URL( '../build/dts/index.d.ts', import.meta.url );
const dts = fs.readFileSync( dtsPath, 'utf8' );
const source = ts.createSourceFile( dtsPath.pathname, dts, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS );

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

const interfaces = new Map();

function collectInterfaces( node ){
  if( ts.isInterfaceDeclaration( node ) ){
    interfaces.set( node.name.text, node );
  }

  ts.forEachChild( node, collectInterfaces );
}

collectInterfaces( source );

function namesForInterface( name, seen = new Set() ){
  if( seen.has( name ) ){
    return new Set();
  }

  seen.add( name );

  let node = interfaces.get( name );
  let names = new Set();

  if( !node ){
    return names;
  }

  for( let member of node.members ){
    if( ( ts.isMethodSignature( member ) || ts.isPropertySignature( member ) ) && member.name && ts.isIdentifier( member.name ) ){
      names.add( member.name.text );
    }
  }

  for( let clause of node.heritageClauses || [] ){
    for( let type of clause.types ){
      if( ts.isIdentifier( type.expression ) ){
        for( let inherited of namesForInterface( type.expression.text, seen ) ){
          names.add( inherited );
        }
      }
    }
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

const allowedResidualExtras = {
  NodeCollection: new Set( [
    'codirectedEdges', 'connectedNodes', 'controlPoints', 'isLoop', 'isSimple',
    'midpoint', 'parallelEdges', 'renderedControlPoints', 'renderedMidpoint',
    'renderedSegmentPoints', 'renderedSourceEndpoint', 'renderedTargetEndpoint',
    'segmentPoints', 'source', 'sourceEndpoint', 'sources', 'target',
    'targetEndpoint', 'targets'
  ] ),
  EdgeCollection: new Set( [
    'affinityPropagation', 'ancestors', 'ap', 'children', 'commonAncestors',
    'connectedEdges', 'degree', 'descendants', 'edgesTo', 'edgesWith', 'fcm',
    'fuzzyCMeans', 'grabbable', 'grabbed', 'grabify', 'hca',
    'hierarchicalClustering', 'incomers', 'indegree', 'isChild',
    'isChildless', 'isOrphan', 'isParent', 'kMeans', 'kMedoids',
    'layoutDimensions', 'layoutPositions', 'leaves', 'lock', 'locked',
    'maxDegree', 'maxIndegree', 'maxOutdegree', 'minDegree', 'minIndegree',
    'minOutdegree', 'modelPosition', 'modelPositions', 'nonorphans', 'orphans',
    'outdegree', 'outgoers', 'parent', 'parents', 'point', 'points',
    'position', 'positions', 'predecessors', 'relativePoint',
    'relativePosition', 'renderedPoint', 'renderedPosition', 'roots', 'shift',
    'siblings', 'successors', 'totalDegree', 'ungrabify', 'unlock'
  ] )
};

let failed = false;

for( let [ label, config ] of Object.entries( groups ) ){
  let actual = [ ...namesForInterface( config.iface ) ].filter( name => name !== 'instanceString' && name !== 'length' ).sort();
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