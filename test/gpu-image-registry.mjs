import { expect } from 'chai';
import {
  ImageRegistry, IMAGE_TIER_SIZES, IMAGE_KIND_AUTO, IMAGE_KIND_SDF,
  IMAGE_PENDING, IMAGE_READY, IMAGE_FAILED, SDF_IMAGE_SIZE
} from '../src/gpu/image-registry.mjs';

// round 15.1: the ImageRegistry — URL dedup/refcount, tier assignment,
// entry free-list reclaim, and async decode behind an injectable
// rasterizer.  Headless-safe: without a decoder entries stay pending and
// nothing throws.  Draw-path integration (tier arrays, uploads) is 15.3.

const tick = () => new Promise( resolve => setTimeout( resolve, 0 ) );

/** A fake decoder yielding fixed-size rasters; records its calls. */
const fakeDecoder = ( sizes = {}, opts = {} ) => {
  const calls = [];
  const decoder = ( url, o ) => {
    calls.push( { url, ...o } );

    if( opts.fail?.includes( url ) ){
      return Promise.reject( new Error( `no such image: ${url}` ) );
    }

    const size = sizes[ url ] ?? 30;
    const vector = url.endsWith( '.svg' );
    // vector sources raster at the requested target when one is given
    const px = vector && o.targetPx > 0 ? o.targetPx : size;

    return Promise.resolve( { data: { url, px }, width: px, height: px, vector } );
  };

  decoder.calls = calls;

  return decoder;
};

describe('gpu/render: image registry (round 15.1)', function(){

  it('dedups by url and refcounts', function(){
    const reg = new ImageRegistry();

    const a = reg.acquire( 'a.png', IMAGE_KIND_AUTO );
    const a2 = reg.acquire( 'a.png', IMAGE_KIND_AUTO );
    const b = reg.acquire( 'b.png', IMAGE_KIND_AUTO );

    expect( a2 ).to.equal( a );
    expect( b ).to.not.equal( a );
    expect( reg.get( a ).refCount ).to.equal( 2 );
    expect( reg.get( b ).refCount ).to.equal( 1 );
    expect( reg.liveCount() ).to.equal( 2 );

    // the same url in sdf-icon mode is a distinct raster
    const icon = reg.acquire( 'a.png', IMAGE_KIND_SDF );

    expect( icon ).to.not.equal( a );
    expect( reg.liveCount() ).to.equal( 3 );
  });

  it('stays pending headless (no decoder) and never throws', function(){
    const reg = new ImageRegistry();
    const id = reg.acquire( 'x.png', IMAGE_KIND_AUTO );

    expect( reg.get( id ).status ).to.equal( IMAGE_PENDING );
    expect( reg.pendingCount() ).to.equal( 1 );
    expect( reg.takeReady() ).to.deep.equal( [] );
  });

  it('release to zero frees the entry and recycles the id', function(){
    const reg = new ImageRegistry();
    const a = reg.acquire( 'a.png', IMAGE_KIND_AUTO );

    reg.acquire( 'a.png', IMAGE_KIND_AUTO );
    reg.release( a );
    expect( reg.get( a ).refCount ).to.equal( 1 );

    reg.release( a );
    expect( reg.get( a ) ).to.equal( null );
    expect( reg.takeFreed() ).to.deep.equal( [ a ] );
    expect( reg.takeFreed() ).to.deep.equal( [] ); // returns-and-clears
    expect( reg.liveCount() ).to.equal( 0 );

    // the freed id recycles for the next distinct url
    const c = reg.acquire( 'c.png', IMAGE_KIND_AUTO );

    expect( c ).to.equal( a );
  });

  it('decodes on acquire and assigns size tiers', async function(){
    const decoder = fakeDecoder( { 'small.png': 40, 'mid.png': 300, 'big.png': 2000 } );
    const reg = new ImageRegistry();

    reg.setDecoder( decoder );

    const small = reg.acquire( 'small.png', IMAGE_KIND_AUTO );
    const mid = reg.acquire( 'mid.png', IMAGE_KIND_AUTO );
    const big = reg.acquire( 'big.png', IMAGE_KIND_AUTO );

    await tick();

    expect( reg.get( small ).status ).to.equal( IMAGE_READY );
    expect( reg.get( small ).tier ).to.equal( 0 ); // 40 <= 128
    expect( reg.get( mid ).tier ).to.equal( 1 ); // 300 <= 512
    expect( reg.get( big ).tier ).to.equal( 2 ); // capped at the top tier
    expect( reg.get( big ).width ).to.equal( 2000 ); // native dims kept
    expect( reg.takeReady().sort() ).to.deep.equal( [ small, mid, big ].sort() );
    expect( reg.takeReady() ).to.deep.equal( [] );
  });

  it('setDecoder kicks entries acquired while headless', async function(){
    const reg = new ImageRegistry();
    const id = reg.acquire( 'late.png', IMAGE_KIND_AUTO );

    expect( reg.get( id ).status ).to.equal( IMAGE_PENDING );

    const decoder = fakeDecoder( { 'late.png': 64 } );

    reg.setDecoder( decoder );
    await tick();

    expect( reg.get( id ).status ).to.equal( IMAGE_READY );
    expect( decoder.calls.length ).to.equal( 1 );
  });

  it('warns once per url on decode failure and marks the entry failed', async function(){
    const warnings = [];
    const origWarn = console.warn;

    console.warn = ( ...args ) => warnings.push( args.join( ' ' ) );

    try {
      const reg = new ImageRegistry();

      reg.setDecoder( fakeDecoder( {}, { fail: [ 'gone.png' ] } ) );

      const id = reg.acquire( 'gone.png', IMAGE_KIND_AUTO );

      await tick();

      expect( reg.get( id ).status ).to.equal( IMAGE_FAILED );
      expect( warnings.length ).to.equal( 1 );
      expect( warnings[ 0 ] ).to.contain( 'gone.png' );

      // re-acquiring a failed url neither re-decodes nor re-warns
      reg.acquire( 'gone.png', IMAGE_KIND_AUTO );
      await tick();

      expect( warnings.length ).to.equal( 1 );
      expect( reg.takeReady() ).to.deep.equal( [] );
    } finally {
      console.warn = origWarn;
    }
  });

  it('drops a decode that resolves after the entry was freed', async function(){
    const resolvers = [];
    const reg = new ImageRegistry();

    reg.setDecoder( () => new Promise( resolve => { resolvers.push( resolve ); } ) );

    const id = reg.acquire( 'slow.png', IMAGE_KIND_AUTO );

    reg.release( id ); // freed while the decode is in flight
    expect( reg.takeFreed() ).to.deep.equal( [ id ] );

    // the id recycles for a different url before the stale decode lands
    const other = reg.acquire( 'other.png', IMAGE_KIND_AUTO );

    expect( other ).to.equal( id );

    // resolve only the stale first decode; other.png's stays pending
    resolvers[ 0 ]( { data: {}, width: 999, height: 999, vector: false } );
    await tick();

    // the stale decode must not have landed on the recycled entry
    expect( reg.get( other ).url ).to.equal( 'other.png' );
    expect( reg.get( other ).width ).to.not.equal( 999 );
    expect( reg.takeReady() ).to.deep.equal( [] );
  });

  it('sdf icons decode at the fixed sdf size', async function(){
    const decoder = fakeDecoder();
    const reg = new ImageRegistry();

    reg.setDecoder( decoder );

    const id = reg.acquire( 'icon.svg', IMAGE_KIND_SDF );

    await tick();

    expect( decoder.calls[ 0 ].sdf ).to.equal( true );
    expect( decoder.calls[ 0 ].targetPx ).to.equal( SDF_IMAGE_SIZE );
    expect( reg.get( id ).status ).to.equal( IMAGE_READY );
    expect( reg.get( id ).tier ).to.equal( -1 ); // icons live in the r8 array, not an rgba tier
  });

  it('promotes vector entries to a higher raster and re-queues them', async function(){
    const decoder = fakeDecoder( { 'logo.svg': 100, 'photo.png': 100 } );
    const reg = new ImageRegistry();

    reg.setDecoder( decoder );

    const svg = reg.acquire( 'logo.svg', IMAGE_KIND_AUTO );
    const png = reg.acquire( 'photo.png', IMAGE_KIND_AUTO );

    await tick();
    reg.takeReady();

    expect( reg.get( svg ).rasterPx ).to.equal( 100 );
    expect( reg.get( svg ).tier ).to.equal( 0 );

    // vector: re-rasters at the next tier that covers the demand
    reg.promote( svg, 400 );
    await tick();

    expect( reg.get( svg ).rasterPx ).to.equal( 512 );
    expect( reg.get( svg ).tier ).to.equal( 1 );
    expect( reg.takeReady() ).to.deep.equal( [ svg ] );

    // raster sources never promote (source resolution is the ceiling)
    reg.promote( png, 400 );
    await tick();

    expect( reg.get( png ).rasterPx ).to.equal( 100 );
    expect( reg.takeReady() ).to.deep.equal( [] );

    // promotion clamps at the cap tier
    reg.promote( svg, 100000 );
    await tick();

    expect( reg.get( svg ).rasterPx ).to.equal( IMAGE_TIER_SIZES[ IMAGE_TIER_SIZES.length - 1 ] );

    // and an already-covered demand is a no-op
    const callsBefore = decoder.calls.length;

    reg.promote( svg, 200 );
    await tick();

    expect( decoder.calls.length ).to.equal( callsBefore );
  });

  it('tracks in-flight decodes and settles (15.6)', async function(){
    const resolvers = [];
    const reg = new ImageRegistry();

    // idle registries settle immediately
    let settledEarly = false;

    reg.whenSettled().then( () => { settledEarly = true; } );
    await tick();
    expect( settledEarly ).to.equal( true );

    reg.setDecoder( () => new Promise( resolve => { resolvers.push( resolve ); } ) );

    const id = reg.acquire( 'slow.svg', IMAGE_KIND_AUTO );

    expect( reg.busy() ).to.equal( true );

    let settled = false;

    reg.whenSettled().then( () => { settled = true; } );
    await tick();
    expect( settled ).to.equal( false );

    resolvers[ 0 ]( { data: {}, width: 32, height: 32, vector: true } );
    await tick();
    expect( reg.busy() ).to.equal( false );
    expect( settled ).to.equal( true );

    // promotion re-decodes count as busy too
    reg.promote( id, 400 );
    expect( reg.busy() ).to.equal( true );

    resolvers[ 1 ]( { data: {}, width: 512, height: 512, vector: true } );
    await tick();
    expect( reg.busy() ).to.equal( false );
  });

  it('fires onChange on ready and on free', async function(){
    let changes = 0;
    const reg = new ImageRegistry();

    reg.onChange = () => changes++;
    reg.setDecoder( fakeDecoder() );

    const id = reg.acquire( 'a.png', IMAGE_KIND_AUTO );

    await tick();
    expect( changes ).to.be.greaterThan( 0 );

    const before = changes;

    reg.release( id );
    expect( changes ).to.be.greaterThan( before );
  });

});
