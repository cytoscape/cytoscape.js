/* eslint-disable no-console, no-unused-vars */

// Fixture conversion and the in-page generators (round 43).
//
// Split out of init.js so the same code can be exercised outside the browser —
// `test/modules/debug-harness.mjs` compiles every network's sheet against its
// real fixture, which is the check that would have caught both the round-42
// path breakage and a style property the engine no longer accepts.

var fixtures = ( function(){

  // EnrichmentMap stores `name` and `description` as one-element arrays, and
  // its own nodeLabel() prefers label -> description -> name.  Same rule here,
  // so the fixture's label key is a plain string by the time it reaches the
  // style engine.
  function unwrap( v ){
    return Array.isArray( v ) ? v[ 0 ] : v;
  }

  function deriveLabel( data ){
    var first = unwrap( data.label ) || unwrap( data.description ) || unwrap( data.name );

    return first == null ? undefined : String( first );
  }

  /** A v3 `{ nodes, edges }` (or flat array) export in v4 definition form. */
  function toGpuElements( elements ){
    var list = Array.isArray( elements )
      ? elements
      : ( elements.nodes || [] ).concat( elements.edges || [] );
    var nodes = [];
    var edges = [];

    for( var i = 0; i < list.length; i++ ){
      var ele = list[ i ];
      var data = ele.data || {};

      if( data.source != null && data.target != null ){
        edges.push( { data: Object.assign( {}, data, { // sidecar data() keys flow through
          id: data.id != null ? String( data.id ) : undefined,
          source: String( data.source ),
          target: String( data.target )
        } ) } );
      } else {
        var label = deriveLabel( data );
        var out = Object.assign( {}, data, { id: data.id != null ? String( data.id ) : undefined } );

        // array-valued name/description would stringify as "a,b" in a label
        if( Array.isArray( out.name ) ){ out.name = unwrap( out.name ); }
        if( Array.isArray( out.description ) ){ out.description = unwrap( out.description ); }
        if( label != null ){ out.label = label; }

        nodes.push( { data: out, position: ele.position } );
      }
    }

    return { nodes: nodes, edges: edges, hasPositions: nodes.some( function( n ){ return n.position != null; } ) };
  }

  // round 43.4: materialise EnrichmentMap's MCODE clusters as compound
  // parents.  The fixture ships `mcode_cluster_id` on 354 of its 569 nodes
  // (41 clusters, the rest 'None'), which is a real compound structure sitting
  // in real data — better than a synthesised one for eyeballing auto-sizing.
  function mcodeParents( gpuElements ){
    var parents = new Map();

    for( var i = 0; i < gpuElements.nodes.length; i++ ){
      var node = gpuElements.nodes[ i ];
      var cluster = node.data.mcode_cluster_id;

      if( cluster == null || cluster === 'None' ){ continue; }

      var id = 'cluster:' + cluster;

      if( !parents.has( id ) ){ parents.set( id, { data: { id: id, name: String( cluster ) } } ); }

      node.data.parent = id;
    }

    return Object.assign( {}, gpuElements, {
      // parents first: they carry no position and are auto-sized from children
      nodes: Array.from( parents.values() ).concat( gpuElements.nodes )
    } );
  }

  var derivations = { 'mcode-parents': mcodeParents };

  // a small ordinal band so the generated scenes have something to map a
  // colour from (an unlabelled monochrome scatter demos only fill rate)
  function band( i ){ return i % 5; }

  function generateNetwork( spec ){
    var match = /^(\d+)x(\d+)$/.exec( spec ) || [ null, '10000', '30000' ];
    var n = parseInt( match[ 1 ], 10 );
    var m = parseInt( match[ 2 ], 10 );
    var side = Math.ceil( Math.sqrt( n ) ) * 50;
    var nodes = [];
    var edges = [];

    for( var i = 0; i < n; i++ ){
      nodes.push( {
        data: { id: 'n' + i, band: band( i ) },
        position: { x: Math.random() * side, y: Math.random() * side }
      } );
    }

    for( var j = 0; j < m; j++ ){
      edges.push( { data: {
        id: 'e' + j,
        source: 'n' + Math.floor( Math.random() * n ),
        target: 'n' + Math.floor( Math.random() * n )
      } } );
    }

    return { nodes: nodes, edges: edges, hasPositions: true };
  }

  // round 14: clustered compound generator — N leaves under ~N/20 parents
  // (every 4th parent nested under the previous one), leaves blobbed per
  // cluster, mostly intra-cluster edges plus a sprinkle of child->parent edges
  // to exercise the compound loops
  function generateCompoundNetwork( spec ){
    var match = /^(\d+)x(\d+)$/.exec( spec ) || [ null, '10000', '20000' ];
    var n = parseInt( match[ 1 ], 10 );
    var m = parseInt( match[ 2 ], 10 );
    var clusters = Math.max( 1, Math.floor( n / 20 ) );
    var nodes = [];
    var edges = [];
    var c, i, j;

    for( c = 0; c < clusters; c++ ){
      var parentDef = { data: { id: 'p' + c, band: band( c ) } };

      if( c % 4 === 3 ){ parentDef.data.parent = 'p' + ( c - 1 ); } // every 4th nests

      nodes.push( parentDef );
    }

    var cols = Math.ceil( Math.sqrt( clusters ) );
    var cx = function( k ){ return ( k % cols ) * 400; };
    var cyy = function( k ){ return Math.floor( k / cols ) * 400; };

    for( i = 0; i < n; i++ ){
      c = i % clusters;

      nodes.push( {
        data: { id: 'n' + i, parent: 'p' + c, band: band( c ) },
        position: { x: cx( c ) + Math.random() * 220, y: cyy( c ) + Math.random() * 220 }
      } );
    }

    for( j = 0; j < m; j++ ){
      if( j % 50 === 49 ){ // a sprinkle of child->parent edges (compound loops)
        i = Math.floor( Math.random() * n );
        edges.push( { data: { id: 'e' + j, source: 'n' + i, target: 'p' + ( i % clusters ) } } );
        continue;
      }

      c = Math.floor( Math.random() * clusters );

      var perCluster = Math.floor( n / clusters );
      // leaves of cluster c are the ids i with i % clusters === c
      var pick = function(){ return c + Math.min( perCluster - 1, Math.floor( Math.random() * perCluster ) ) * clusters; };
      var intra = j % 5 !== 0; // 4 in 5 edges stay inside a cluster

      edges.push( { data: {
        id: 'e' + j,
        source: 'n' + ( intra ? pick() : Math.floor( Math.random() * n ) ),
        target: 'n' + ( intra ? pick() : Math.floor( Math.random() * n ) )
      } } );
    }

    return { nodes: nodes, edges: edges, hasPositions: true };
  }

  // round 43.4: v3's hand-built compound graph (v3/debug/compound.js).  It is
  // awkward on purpose — three levels of nesting, a self-loop on a parent,
  // edges crossing parent boundaries, one very long id — which is exactly what
  // makes it worth eyeballing next to the pretty fixtures.
  //
  // **The declaration order is load-bearing, which is why this is now a real
  // verbatim port and round 43's was not.**  Grid places leaves in declaration
  // order and parents derive their boxes from where their children land, so
  // reordering the node list reorders the grid and therefore reshapes every
  // parent.  Round 43 sorted the ids (n1, n2, n3, … ) and changed four edges
  // while claiming a verbatim port; the result put n5 and n8/n9 in different
  // grid rows, so n1's auto-box swallowed n2's and the graph was unreadable.
  // v3's order interleaves the ids deliberately — n8, n9, n4, n5, n1, … — so
  // that each parent's children land adjacent.  Keep it.
  function compoundFixture(){
    return {
      nodes: [
        { data: { id: 'n8', parent: 'n4' } },
        { data: { id: 'n9', parent: 'n4' } },
        { data: { id: 'n4', parent: 'n1' } },
        { data: { id: 'n5', parent: 'n1', shape: 'triangle' } },
        { data: { id: 'n1' } },
        { data: { id: 'n2' } },
        { data: { id: 'node-really-long-name-6', parent: 'n2' } },
        { data: { id: 'n7', parent: 'n2', shape: 'square' } },
        { data: { id: 'n3', parent: 'non-auto', shape: 'rectangle' } },
        { data: { id: 'non-auto' } }
      ],
      edges: [
        { data: { id: 'e1', source: 'n1', target: 'n3' } },
        { data: { id: 'e2', source: 'n3', target: 'n7' } },
        { data: { id: 'e3', source: 'node-really-long-name-6', target: 'n7' } },
        { data: { id: 'e4', source: 'node-really-long-name-6', target: 'n9' } },
        { data: { id: 'e5', source: 'n8', target: 'n9' } },
        { data: { id: 'e6', source: 'n5', target: 'n8' } },
        { data: { id: 'e7', source: 'n2', target: 'n4' } },
        { data: { id: 'e8', source: 'n8', target: 'n8' } }, // self-loop
        { data: { id: 'e9', source: 'n1', target: 'n1' } }, // self-loop on a parent
        { data: { id: 'e10', source: 'n1', target: 'n9' } }, // parent -> descendant
        { data: { id: 'e11', source: 'n4', target: 'n1' } } // child -> ancestor
      ],
      hasPositions: false
    };
  }

  /** Build a generated network by its `networks` entry. */
  // Round 46.6: v3's *default* debug graph — the one `v3/debug/init.js` builds
  // inline and the v3 page opens on.  It is small and deliberately loud: three
  // self-loops on `a`, two multi-edge fans (c->e, d->e x4), a compound parent
  // `p` with an edge into it, and a stylesheet that gives almost every edge a
  // different `curve-style`.  That is what makes it the fixture to open when
  // you want to see arrows and edge routing rather than scale.
  //
  // **Node order and `cols: 3` are load-bearing**, for the reason round 43.4
  // recorded about the other v3 port: grid places nodes in declaration order,
  // so reordering this list reshapes the whole graph and moves every edge.
  // This is v3's order, verbatim.
  //
  // Labels live in the data rather than the sheet because v4's `label` takes
  // only the passthrough mapper (`{ data: key }`) — there are no style
  // functions and no per-element bypass, so v3's per-id label overrides have
  // to be data.  The zero-width spaces (\u200b) are v3's, and they are the
  // point of those three labels: they mark where wrapping is allowed.
  function v3DefaultFixture(){
    var LONG_C = 'c has a long label over-\u200bflowing its max    width,\n but spa\u200bces are ke\u200bpt';
    var LONG_D = 'd has a long label over-\u200bflowing and its rotated by 45deg';
    var LONG_B = 'b has a long label over-\u200bflowing and its rotated by 38deg';

    return {
      nodes: [
        { data: { id: 'a', weight: 50, label: 'a' } },
        { data: { id: 'b', weight: 30, label: LONG_B } },
        { data: { id: 'c', weight: 20, label: LONG_C } },
        { data: { id: 'd', weight: 10, label: LONG_D } },
        { data: { id: 'e', weight: 75, label: 'e' } },
        { data: { id: 'f', weight: 100, label: 'f' } },
        { data: { id: 'g', weight: 40, label: 'g' } },
        { data: { id: 'h', weight: 16, parent: 'p', label: 'h' } },
        { data: { id: 'i', weight: 16, parent: 'p', label: 'i' } },
        { data: { id: 'p', label: 'p' } }
      ],
      edges: [
        { data: { id: 'ae', weight: 1, source: 'a', target: 'e' } },
        { data: { id: 'aa', weight: 2, source: 'a', target: 'a' } },
        { data: { id: 'aa2', weight: 2, source: 'a', target: 'a' } },
        { data: { id: 'aa3', weight: 2, source: 'a', target: 'a' } },
        { data: { id: 'ab', weight: 3, source: 'a', target: 'b' } },
        { data: { id: 'be', weight: 4, source: 'b', target: 'e' } },
        { data: { id: 'bc', weight: 5, source: 'b', target: 'c' } },
        { data: { id: 'ce', weight: 6, source: 'c', target: 'e' } },
        { data: { id: 'ce2', weight: 6, source: 'c', target: 'e' } },
        { data: { id: 'cf', weight: 2, source: 'c', target: 'f' } },
        { data: { id: 'de', weight: 7, source: 'd', target: 'e' } },
        { data: { id: 'ed', weight: 7, source: 'e', target: 'd' } },
        { data: { id: 'de2', weight: 7, source: 'd', target: 'e' } },
        { data: { id: 'de3', weight: 7, source: 'd', target: 'e' } },
        { data: { id: 'de4', weight: 7, source: 'd', target: 'e' } },
        { data: { id: 'de5', weight: 7, source: 'd', target: 'e' } },
        { data: { id: 'bf', weight: 3, source: 'b', target: 'f' } },
        { data: { id: 'eg', weight: 3, source: 'e', target: 'g' } },
        { data: { id: 'eh', weight: 3, source: 'e', target: 'h' } },
        { data: { id: 'ei', weight: 3, source: 'e', target: 'i' } },
        { data: { id: 'ep', weight: 3, source: 'e', target: 'p' } },
        { data: { id: 'fi', weight: 3, source: 'f', target: 'i' } },
        { data: { id: 'gh', weight: 3, source: 'g', target: 'h' } }
      ],
      hasPositions: false
    };
  }

  function generate( kind, spec ){
    if( kind === 'v3-default' ){ return v3DefaultFixture(); }
    if( kind === 'compound' ){ return generateCompoundNetwork( spec ); }
    if( kind === 'fixture' ){ return compoundFixture(); }

    return generateNetwork( spec );
  }

  // -- the binary wire form (round 46.5) --
  //
  // The status build ships each fetched fixture as v4's own binary wire format
  // rather than JSON: 102.5 MiB of JSON becomes 37.5 MiB, which is what puts
  // every fixture under Cloudflare Pages' 25 MiB per-file cap and so removes
  // the off-site bucket entirely.  (Gzipped the two are within 1% of each
  // other, so this is a *file at rest* win, not a transfer one.)
  //
  // The buffer is produced from the output of `toGpuElements` above, so what
  // comes back here is already normalised and the rest of the harness — the
  // sheet builders, which read `elements.nodes` for their mapper domains, and
  // the `derive` transforms below — is unchanged.

  /** Decode a PackedIds `{ offsets, blob }` into a plain string array. */
  function unpackIds( ids, count ){
    var out = new Array( count );
    var dec = new TextDecoder();
    var i, a, b;

    if( ids == null ){ return out; }

    for( i = 0; i < count; i++ ){
      a = ids.offsets[ i ];
      b = ids.offsets[ i + 1 ];
      // a zero-length id is a hole: the store generates one on ingest
      out[ i ] = b > a ? dec.decode( ids.blob.subarray( a, b ) ) : undefined;
    }

    return out;
  }

  // Three column kinds come off the wire and only one is indexable directly.
  // A dictionary column is `{ dict, indices }` with **1-based** indices and 0
  // meaning absent; reading it as an array yields `undefined` for every
  // element, which is what a first version of this did to every string column
  // in every fixture — silently, since the labels simply vanished.
  function valueAt( col, i ){
    var idx;

    if( col == null ){ return undefined; }

    if( col.dict != null && col.indices != null ){
      idx = col.indices[ i ];

      return idx === 0 ? undefined : col.dict[ idx - 1 ];
    }

    return col[ i ];
  }

  function readData( data, i ){
    var out = {};
    var keys = Object.keys( data || {} );
    var k, v;

    for( k = 0; k < keys.length; k++ ){
      v = valueAt( data[ keys[ k ] ], i );

      if( v === undefined || v === null ){ continue; }
      if( typeof v === 'number' && isNaN( v ) ){ continue; }

      out[ keys[ k ] ] = v;
    }

    return out;
  }

  /**
   * Columnar elements (from `cytoscape.deserializeElements`) back into the
   * `{ nodes, edges, hasPositions }` shape `toGpuElements` produces.
   */
  function fromColumnar( columnar ){
    var n = columnar.nodes || { count: 0 };
    var e = columnar.edges || { count: 0 };
    var nIds = unpackIds( n.ids, n.count );
    var eIds = unpackIds( e.ids, e.count );
    var nodes = [];
    var edges = [];
    var i, data;

    for( i = 0; i < n.count; i++ ){
      data = readData( n.data, i );

      if( nIds[ i ] !== undefined ){ data.id = nIds[ i ]; }

      nodes.push( n.positions != null
        ? { data: data, position: { x: n.positions[ i * 2 ], y: n.positions[ i * 2 + 1 ] } }
        : { data: data } );
    }

    for( i = 0; i < e.count; i++ ){
      data = readData( e.data, i );

      if( eIds[ i ] !== undefined ){ data.id = eIds[ i ]; }

      // sources/targets are node *indices* on the wire, not ids
      data.source = nIds[ e.sources[ i ] ];
      data.target = nIds[ e.targets[ i ] ];
      edges.push( { data: data } );
    }

    return {
      nodes: nodes,
      edges: edges,
      hasPositions: nodes.some( function( x ){ return x.position != null; } )
    };
  }

  /** Apply a network's `derive`, if it declares one. */
  function derive( name, gpuElements ){
    var fn = name != null ? derivations[ name ] : null;

    return fn != null ? fn( gpuElements ) : gpuElements;
  }

  return {
    toGpuElements: toGpuElements,
    fromColumnar: fromColumnar,
    deriveLabel: deriveLabel,
    derive: derive,
    generate: generate
  };

} )();

// Node (the module suite) loads this file as a script and reads the global;
// the browser just gets the global.
if( typeof module !== 'undefined' && module.exports ){ module.exports = fixtures; }
