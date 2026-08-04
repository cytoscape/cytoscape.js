import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import cytoscapeGpu from '../src/gpu/index.mjs';
import { GpuCore } from '../src/gpu/core.mjs';
import { GpuCollection } from '../src/gpu/collection.mjs';

/*
Round 29.1: the alias surface.

v4 keeps v3's method aliases (`each` for `forEach`, `centre` for
`center`, `bc` for `betweennessCentrality`, ...) as two separate things:
a *type* declaration in the class body —

    declare each: this['forEach'];

— and a *runtime* assignment far below it —

    GpuCollection.prototype.each = GpuCollection.prototype.forEach;

Deleting the second line leaves `npm run typecheck` green, because the
`declare` goes on asserting the method exists, and breaks `eles.each()`
at runtime.  Nothing caught that before this file: 29 of the 83 aliases
were never called by any spec.

The table below is the written record of the surface.  The last two
specs close the loop in both directions — every declared alias must be
tabled, and every tabled alias must be declared — so adding an alias
without listing it here fails, and so does removing one silently.
*/

/** [ alias, target ] for every alias declared on GpuCore. */
const CORE_ALIASES = [
  [ 'makeLayout', 'layout' ],
  [ 'createLayout', 'layout' ],
  [ 'addListener', 'on' ],
  [ 'listen', 'on' ],
  [ 'bind', 'on' ],
  [ 'once', 'one' ],
  [ 'removeListener', 'off' ],
  [ 'unlisten', 'off' ],
  [ 'unbind', 'off' ],
  [ 'trigger', 'emit' ],
  [ 'pon', 'promiseOn' ],
  [ 'centre', 'center' ],
  [ 'invalidateSize', 'resize' ],
  [ 'jpeg', 'jpg' ],
  [ 'attr', 'data' ],
  [ 'removeAttr', 'removeData' ],
  // These two were listed as dropped by the 2026-07-29 "one name per
  // concept" triage and were nonetheless wired and working — an open call
  // until the fifth design sitting, which **kept them** as deliberate,
  // recorded exceptions ("possibly useful"), where the same call dropped
  // `roundrectangle` (round 37.2).  So these rows are now the pinned
  // contract rather than a pinned inconsistency; the exception is written
  // into the ledger's legacy-alias line.
  [ 'autolockNodes', 'autolock' ],
  [ 'autoungrabifyNodes', 'autoungrabify' ],
  [ '$id', 'getElementById' ]
];

/** [ alias, target ] for every alias declared on GpuCollection. */
const COLLECTION_ALIASES = [
  [ 'each', 'forEach' ],
  [ 'has', 'contains' ],
  [ 'equal', 'same' ],
  [ 'equals', 'same' ],
  [ 'allAreNeighbours', 'allAreNeighbors' ],
  [ 'u', 'union' ],
  [ 'or', 'union' ],
  [ 'add', 'union' ],
  [ 'merge', 'union' ],
  [ 'not', 'difference' ],
  [ 'subtract', 'difference' ],
  [ 'unmerge', 'difference' ],
  [ 'relativeComplement', 'difference' ],
  [ 'intersect', 'intersection' ],
  [ 'and', 'intersection' ],
  [ 'symdiff', 'symmetricDifference' ],
  [ 'xor', 'symmetricDifference' ],
  [ 'complement', 'absoluteComplement' ],
  [ 'abscomp', 'absoluteComplement' ],
  [ 'modelPosition', 'position' ],
  [ 'point', 'position' ],
  [ 'modelPositions', 'positions' ],
  [ 'points', 'positions' ],
  [ 'relativePoint', 'relativePosition' ],
  [ 'renderedPoint', 'renderedPosition' ],
  [ 'attr', 'data' ],
  [ 'removeAttr', 'removeData' ],
  [ 'css', 'style' ],
  [ 'renderedCss', 'renderedStyle' ],
  [ 'renderedBoundingbox', 'renderedBoundingBox' ],
  [ 'deselect', 'unselect' ],
  [ 'openNeighborhood', 'neighborhood' ],
  [ 'ancestors', 'parents' ],
  [ 'componentsOf', 'components' ],
  [ 'makeLayout', 'layout' ],
  [ 'createLayout', 'layout' ],
  [ 'bfs', 'breadthFirstSearch' ],
  [ 'dfs', 'depthFirstSearch' ],
  [ 'tsc', 'tarjanStronglyConnected' ],
  [ 'tscc', 'tarjanStronglyConnected' ],
  [ 'tarjanStronglyConnectedComponents', 'tarjanStronglyConnected' ],
  [ 'htbc', 'hopcroftTarjanBiconnected' ],
  [ 'htb', 'hopcroftTarjanBiconnected' ],
  [ 'hopcroftTarjanBiconnectedComponents', 'hopcroftTarjanBiconnected' ],
  [ 'dc', 'degreeCentrality' ],
  [ 'dcn', 'degreeCentralityNormalized' ],
  [ 'degreeCentralityNormalised', 'degreeCentralityNormalized' ],
  [ 'cc', 'closenessCentrality' ],
  [ 'ccn', 'closenessCentralityNormalized' ],
  [ 'closenessCentralityNormalised', 'closenessCentralityNormalized' ],
  [ 'bc', 'betweennessCentrality' ],
  [ 'fcm', 'fuzzyCMeans' ],
  [ 'hca', 'hierarchicalClustering' ],
  [ 'mcl', 'markovClustering' ],
  [ 'ap', 'affinityPropagation' ],
  [ 'addListener', 'on' ],
  [ 'once', 'one' ],
  [ 'listen', 'on' ],
  [ 'bind', 'on' ],
  [ 'removeListener', 'off' ],
  [ 'unlisten', 'off' ],
  [ 'unbind', 'off' ],
  [ 'trigger', 'emit' ],
  [ 'pon', 'promiseOn' ]
];

/** The `declare x: this['y']` pairs actually written in a source file. */
const declaredIn = relPath => {
  const src = readFileSync( fileURLToPath( new URL( relPath, import.meta.url ) ), 'utf8' );
  const out = [];

  for( const m of src.matchAll( /declare ([a-zA-Z_$][\w$]*): this\['([^']+)'\]/g ) ){
    out.push( `${m[ 1 ]} -> ${m[ 2 ]}` );
  }

  return out;
};

const key = pairs => pairs.map( ( [ a, b ] ) => `${a} -> ${b}` ).sort();

describe('gpu/aliases: the alias surface (29.1)', function(){

  describe('GpuCore', function(){

    for( const [ alias, target ] of CORE_ALIASES ){
      it(`cy.${alias} is wired to ${target}`, function(){
        expect( typeof GpuCore.prototype[ alias ], alias ).to.equal( 'function' );
        expect( GpuCore.prototype[ alias ], alias ).to.equal( GpuCore.prototype[ target ] );
      });
    }

  });

  describe('GpuCollection', function(){

    for( const [ alias, target ] of COLLECTION_ALIASES ){
      it(`eles.${alias} is wired to ${target}`, function(){
        expect( typeof GpuCollection.prototype[ alias ], alias ).to.equal( 'function' );
        expect( GpuCollection.prototype[ alias ], alias )
          .to.equal( GpuCollection.prototype[ target ] );
      });
    }

  });

  describe('reaching them through an instance', function(){

    // the prototype identity above is the contract; these confirm the
    // aliases are reachable and behave on a live graph, since a class
    // field or an own property could in principle shadow the prototype
    var cy;

    beforeEach(function(){
      cy = cytoscapeGpu({
        elements: [
          { data: { id: 'a' }, position: { x: 0, y: 0 } },
          { data: { id: 'b' }, position: { x: 100, y: 0 } },
          { data: { id: 'ab', source: 'a', target: 'b' } }
        ]
      });
    });

    afterEach(function(){ cy.destroy(); });

    it('cy.centre() centres like cy.center()', function(){
      cy.pan({ x: 500, y: 500 });
      cy.centre();

      var after = { ...cy.pan() };

      cy.pan({ x: 500, y: 500 });
      cy.center();

      expect( cy.pan() ).to.deep.equal( after );
    });

    it('cy.$id() is the id lookup', function(){
      expect( cy.$id('a').id() ).to.equal( 'a' );
      expect( cy.$id('a').same( cy.getElementById('a') ) ).to.equal( true );
    });

    it('eles.each() iterates like forEach', function(){
      var seen = [];

      cy.nodes().each( n => seen.push( n.id() ) );

      expect( seen.sort() ).to.deep.equal( [ 'a', 'b' ] );
    });

    it('eles.deselect() unselects', function(){
      cy.nodes().select();
      cy.nodes().deselect();

      expect( cy.nodes().filter({ selected: true }).length ).to.equal( 0 );
    });

    it('eles.bc() is betweennessCentrality', function(){
      var viaAlias = cy.elements().bc();
      var viaName = cy.elements().betweennessCentrality();

      expect( viaAlias.betweenness( cy.$id('a') ) )
        .to.equal( viaName.betweenness( cy.$id('a') ) );
    });

    it('eles.point() reads the model position', function(){
      expect( cy.$id('b').point() ).to.deep.equal( cy.$id('b').position() );
    });

  });

  describe('the table and the sources agree', function(){

    it('every alias declared on GpuCore is tabled here', function(){
      expect( declaredIn( '../src/gpu/core.mts' ).sort() )
        .to.deep.equal( key( CORE_ALIASES ) );
    });

    it('every alias declared on GpuCollection is tabled here', function(){
      expect( declaredIn( '../src/gpu/collection.mts' ).sort() )
        .to.deep.equal( key( COLLECTION_ALIASES ) );
    });

  });

});
