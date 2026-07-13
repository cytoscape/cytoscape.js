import * as marked from 'marked';
import hljs from 'highlight.js';

const runButton = '<button class="run run-inline-code"><span class="fa fa-play"></span></button>';

const languageName = lang => lang?.match(/^\S+/)?.[0];

const highlight = ({ text, lang }) => {
  let language = languageName(lang);

  if( language ){
    return hljs.highlight(text, { language }).value;
  }

  return hljs.highlightAuto(text).value;
};

export const makeMarkdownRenderer = ({ addRunButton = false } = {}) => {
  let renderer = new marked.Renderer();
  let renderCode = renderer.code;

  renderer.code = function(token){
    let language = languageName(token.lang);
    let code = renderCode.call(this, {
      ...token,
      text: highlight(token),
      escaped: true
    });
    let button = addRunButton && language === 'js' ? runButton : '';

    return code + button;
  };

  return renderer;
};
