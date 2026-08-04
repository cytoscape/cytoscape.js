import { spawnSync } from 'node:child_process';
import { expect } from 'chai';

describe('Node test compatibility setup', function(){
  it('fails a test that calls done more than once', function(){
    let setup = new URL('./node-test-setup.mjs', import.meta.url).href;
    let source = `it('duplicate done', done => { done(); done(new Error('second call')); });`;
    let result = spawnSync(process.execPath, [
      '--import', setup,
      '--input-type=module',
      '--eval', source
    ], { encoding: 'utf8' });

    expect(result.status).not.to.equal(0);
    expect(result.stdout + result.stderr).to.contain('callback invoked multiple times');
  });
});
