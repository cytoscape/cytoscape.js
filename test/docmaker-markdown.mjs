import { expect } from 'chai';
import * as marked from 'marked';
import { makeMarkdownRenderer } from '../documentation/markdown-renderer.mjs';

describe('Documentation markdown renderer', function(){
  let markdown = '```js\nconst answer = 42;\n```';

  it('highlights fenced code and adds the runnable example button', function(){
    let html = marked.parse(markdown, {
      renderer: makeMarkdownRenderer({ addRunButton: true })
    });

    expect(html).to.contain('<span class="hljs-keyword">const</span>');
    expect(html).to.contain('<button class="run run-inline-code">');
  });

  it('highlights fenced code without adding a blocked run button', function(){
    let html = marked.parse(markdown, {
      renderer: makeMarkdownRenderer()
    });

    expect(html).to.contain('<span class="hljs-keyword">const</span>');
    expect(html).not.to.contain('run-inline-code');
  });
});
