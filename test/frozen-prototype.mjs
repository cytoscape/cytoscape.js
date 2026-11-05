import { expect } from 'chai';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

// Freezing Object.prototype affects the whole realm, so the check runs in a separate Node
// process instead of in Mocha's own.
describe('Frozen Object.prototype', function(){

  let srcDir = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '../src' );
  let srcUrl = file => JSON.stringify( pathToFileURL( path.join( srcDir, file ) ).href );

  let run = function( body ){
    let code = `
      Object.freeze( Object.prototype );
      const { default: cytoscape } = await import( ${ srcUrl('index.mjs') } );
      const { default: Selector } = await import( ${ srcUrl('selector/index.mjs') } );
      ${ body }
    `;

    return execFileSync( process.execPath, [ '--input-type=module', '-e', code ], { encoding: 'utf8' } );
  };

  it('loads the library', function(){
    expect( run(`process.stdout.write( typeof cytoscape );`) ).to.equal('function');
  });

  it('creates a graph and resolves selectors', function(){
    let out = run(`
      const cy = cytoscape({ headless: true, elements: [ { data: { id: 'a' } }, { data: { id: 'b' } } ] });
      process.stdout.write( JSON.stringify( [ cy.$('#a').length, cy.nodes().length, cy.$('#a').filter('node').length ] ) );
    `);

    expect( JSON.parse( out ) ).to.deep.equal( [ 1, 2, 1 ] );
  });

  it('keeps Selector.prototype.toString', function(){
    let out = run(`
      process.stdout.write( new Selector('node.foo').toString() );
    `);

    expect( out ).to.equal('node.foo');
  });

});
