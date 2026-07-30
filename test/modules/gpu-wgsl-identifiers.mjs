import { expect } from 'chai';

import { TWEEN_SHADERS } from '../../src/gpu/render/gpu-tween.mjs';
import { NODE_EVAL_SHADER, EDGE_EVAL_SHADER } from '../../src/gpu/render/mapper-shaders.mjs';
import {
  NODE_SHADER, EDGE_SHADER, CURVED_EDGE_SHADER, ARROW_SHADER, LABEL_SHADER
} from '../../src/gpu/render/shaders.mjs';

/*
WGSL keeps a large reserved-word list beyond the words it actually uses, and a
reserved identifier is a *compile* error — so the offending pipeline is simply
never created and the dispatch silently does nothing.  The Playwright webgpu
project catches that on a real adapter, but it soft-skips without one, so guard
the obvious cases here where every CI run sees them.

Only the words plausibly reachable as a shader variable name are listed; the
full reserved set is long and mostly exotic.
*/
const RESERVED = [
  'target', 'sample', 'filter', 'buffer', 'shared', 'input', 'output',
  'texture', 'typedef', 'template', 'union', 'enum', 'class', 'interface',
  'private', 'public', 'protected', 'static', 'virtual', 'inline', 'namespace',
  'new', 'delete', 'do', 'goto', 'try', 'catch', 'throw', 'auto', 'extern',
  'friend', 'operator', 'signed', 'unsigned', 'typename', 'using', 'where',
  'match', 'std', 'get', 'set', 'as', 'asm', 'become', 'binding', 'cast',
  'unless', 'until', 'yield'
];

const SHADERS = {
  'tween:position': TWEEN_SHADERS.position,
  'tween:scalar': TWEEN_SHADERS.scalar,
  'tween:color': TWEEN_SHADERS.color,
  'eval:nodes': NODE_EVAL_SHADER,
  'eval:edges': EDGE_EVAL_SHADER,
  'render:node': NODE_SHADER,
  'render:edge': EDGE_SHADER,
  'render:curved-edge': CURVED_EDGE_SHADER,
  'render:arrow': ARROW_SHADER,
  'render:label': LABEL_SHADER
};

/** every name the source declares: var/let/const/fn/struct and struct members */
const declaredNames = src => {
  const names = [];
  const decl = /(?:var(?:<[^>]*>)?|let|const|fn|struct|alias)\s+([A-Za-z_]\w*)/g;
  // struct members and fn params: `name: type`, at a line start or after a comma
  const field = /(?:^|[(,]\s*)\s*([A-Za-z_]\w*)\s*:/gm;

  for( const m of src.matchAll( decl ) ){ names.push( m[ 1 ] ); }
  for( const m of src.matchAll( field ) ){ names.push( m[ 1 ] ); }

  return names;
};

describe('gpu/wgsl identifiers', function(){

  for( const [ name, src ] of Object.entries( SHADERS ) ){
    it(`${name} declares no WGSL reserved word`, function(){
      const offenders = declaredNames( src ).filter( n => RESERVED.includes( n ) );

      expect( [ ...new Set( offenders ) ] ).to.deep.equal( [] );
    });
  }

  it('the guard actually catches one', function(){
    const bad = 'var<storage, read_write> target: array<f32>;';

    expect( declaredNames( bad ).filter( n => RESERVED.includes( n ) ) ).to.deep.equal( [ 'target' ] );
  });
});
