/* eslint-disable no-console, no-useless-escape */

let fs = require('fs');
let marked = require('marked');
let Handlebars = require('handlebars');
let jsonlint = require('jsonlint');
let hljs = require('highlight.js');
let encoding = 'utf8';
let config;
let configFile = './docmaker.json';
let mdRend = new marked.Renderer();
let path = require('path');

let rendCode = mdRend.code;
mdRend.code = function(code, lang){
  let button = '';

  if( lang === 'js' ){
    button = '<button class="run run-inline-code"><span class="fa fa-play"></span></button>';
  }

  return rendCode.call(this, code, lang) + button;
};

try {
  jsonlint.parse( fs.readFileSync( path.join(__dirname, configFile), 'utf8') ); // validate first for convenience
  config = require( configFile );
} catch(e){
  console.error('\n`' + configFile + '` could not be read; check the JSON is formatted correctly via jsonlint');
  throw e;
}

config.version = process.env.VERSION || 'snapshot';

function linkifyArg( arg ){
  let link = config.fnArgLinks[ arg.name ];

  if( link ){
    arg.linkedName = '<a href="'+ link +'">' + arg.name + '</a>';
  } else {
    arg.linkedName = arg.name;
  }
}

// let html = converter.makeHtml("**I am bold!**");
// let html = Handlebars.compile();

function md2html( file ){
  file = file.substr( file.length - 3 ) === '.md' ? file : file + '.md'; // add extension if need be

  let md;
  try{
    md = fs.readFileSync( path.join(__dirname, './md', file) , 'utf8');
  } catch(e){
    throw 'A markdown file named `' + file + '` was referenced but could not be read';
  }

  // let html = converter.makeHtml( md );
  //let html = mdConvertor( md );
  let html = marked( md, {
    highlight: function(code, lang){
      let ret;

      if( lang ){
        ret = hljs.highlight(lang, code).value;
      } else {
        ret = hljs.highlightAuto(code).value;
      }

      return ret;

    },

    smartypants: true,

    renderer: mdRend,

    gfm: true
  } );


  return html;
}

function toUrl( str ){
  str = str || '';
  str = str.replace(/ /g, '-');
  str = str.replace(/\&|\,|\;|\(|\)/g, '');
  str = str.toLowerCase();

  return str;
}

function makeBookmark( id ){
  return '<a href="#'+ id +'"><span class="fa fa-bookmark"></span></a>';
}

function parseSubsections( section ){
  let parentName = section.name;
  let html = section.html;
  let matches = html.match(/\<h2.*?\>.+?\<\/h2\>/g);
  let psubs = [];

  for( let i = 0; matches && i < matches.length; i++ ){
    let match = matches[i];
    let name = match.match(/\<h2.*?\>(.+)\<\/h2\>/)[1];
    let id = toUrl(parentName) + '/' + toUrl(name);

    psubs.push({
      name: name,
      fromMd: true,
      id: id,
      bookmark: makeBookmark(id)
    });

    section.html = section.html.replace(match, '<h2 id="' + id + '">' + name + ' ' + makeBookmark(id) +  '</h2>');
  }

  return psubs;
}

function populateDemo( demo ){
  if( demo.github ){
    demo.githubUrl = 'https://github.com/' + demo.github;

    if( !demo.viewUrl ){ // use github pages url if unspecified
      let gh = demo.github.match(/([^/]+)\/([^/]+)/);

      demo.viewUrl = 'https://' + gh[1] + '.github.io/' + gh[2];
    }
  } else { // main repo demo
    demo.githubUrl = 'https://github.com/cytoscape/cytoscape.js/tree/master/documentation/demos/' + demo.id;
    demo.viewUrl = 'demos/' + demo.id;
  }

  demo.imgUrl = 'img/demos/' + demo.id + '.png';
}

function processFields( fields ){
  for( let i = 0; fields && i < fields.length; i++ ){
    let field = fields[i];

    field.descr = marked( field.descr  || '' );

    linkifyArg( field );

    let subfields = field.fields;

    if( subfields ){
      processFields( subfields );
    }
  }
}

function compileAliases( section, fn ){
  if( fn.pureAliases ){
    let procdAliases = [];

    for( let k = 0; k < fn.pureAliases.length; k++ ){
      let pa = '' + fn.pureAliases[k];

      procdAliases.push({
        name: pa,
        id: section.id + '/' + pa
      });
    }

    fn.processedPureAliases = procdAliases;
  }
}

function compileConfig( config ){
  let sections = config.sections;
  let parent = config;

  for( let i = 0; sections && i < sections.length; i++ ){
    let section = sections[i];

    if( section.layout ){ section.name = section.layout.name; }

    section.id = (parent.name ? (toUrl(parent.name) + '/') : '') + toUrl( section.name );
    section.bookmark = makeBookmark( section.id );

    if( section.md ){
      section.html = md2html( section.md );

      let psubs = parseSubsections( section );

      let subs = section.sections = section.sections || [];
      section.sections = subs.concat( psubs );
    }

    if( section.mddescr ){
      section.descr = md2html( section.mddescr );
    }

    if( section.demos ){
      let demos = section.demos;

      for( let j = 0; j < demos.length; j++ ){
        let demo = demos[j];

        populateDemo( demo );
      }
    }

    if( section.demo ){
      populateDemo( section.demo );
    }

    if( section.layout ){
      let layout = section.layout;

      section.name = layout.name;
      layout.code = fs.readFileSync( path.join(__dirname, '../src/extensions/layout/' + layout.name + '.js'), 'utf8' );

      try {
        layout.options = layout.code.match(/defaults\s*\=\s*(\{(?:.|\s)+?\}\;)/)[1];

        let lopts = layout.options;

        // cleanup indent
        lopts = lopts.replace(/\n[ ]{4}/g, '\n  ');
        lopts = lopts.replace(/[ ]{2}\}\;/g, '};');

        // add name
        lopts = lopts.replace(/\{/, '{\n  name: \'' + layout.name + '\',\n');

        // wrap w/ code
        lopts = 'let options = ' + lopts + '\n\ncy.layout( options );';

        // highlight
        lopts = hljs.highlight('js', lopts).value;

        layout.optionsFormatted = lopts;
      } catch(e){
        throw 'Error processing layout options for `'+ layout.name +'`; must have `defaults = { ... };`';
      }
    }

    // TODO check fnsOrder
    // build section.fns from separate json files
    // each fnsOrder => fns (read json file sync)

    if( section.fns ){
      let fns = section.fns;
      for( let j = 0; j < fns.length; j++ ){
        let fn = fns[j];

        fn.altIds = [];

        fn.altIds.push( section.id + '/' + fn.name );
        fn.id = fn.name;
        fn.bookmark = makeBookmark( fn.id );
        fn.descr = fn.descr ? marked( fn.descr ) : undefined;

        if( fn.md ){
          fn.html = md2html( fn.md );

          // the html for functions should only have h3 tags, not h1 or h2
          fn.html = fn.html.replace(/\<h2/g, '<h3');
          fn.html = fn.html.replace(/\<\/h2\>/g, '</h3>');
          fn.html = fn.html.replace(/\<h1/g, '<h3');
          fn.html = fn.html.replace(/\<\/h1\>/g, '</h3>');
        }

        if( fn.pureAliases ){
          fn.pureAliases.forEach(function( aId ){
            fn.altIds.push( section.id + '/' + aId );
            fn.altIds.push( aId );
          });
        }

        let formatsHaveDiffNames = false;
        if( fn.formats ){
          let formats = fn.formats;

          for( let k = 0; k < formats.length; k++ ){
            let format = formats[k];

            format.name = format.name || fn.name; // copy name to format if not specified
            format.descr = marked( format.descr || '' );

            fn.altIds.push( section.id + '/' + format.name );
            fn.altIds.push( format.name );

            if( format.args ){
              for( let m = 0; m < format.args.length; m++ ){
                let arg = format.args[m];

                linkifyArg( arg );

                arg.descr = marked( arg.descr || '' );

                processFields( arg.fields );
              }
            }

            if( format.name !== fn.name ){
              formatsHaveDiffNames = true;
            }

            compileAliases( section, format );
          }
        } // if

        // mark as diff names
        if( formatsHaveDiffNames ){
          fn.aliases = true;
        }

        compileAliases( section, fn );

      } // for

      // sort functions by name within a section
      // fns.sort(function(a, b){
      //   return a.name.toLowerCase() > b.name.toLowerCase();
      // });
    }

    if( section.sections ){ // then compile those subsections too
      compileConfig( section );
    }
  }
}

function writeDocs(){
  compileConfig( config );

  let htmlTemplate = fs.readFileSync( path.join(__dirname, './template.html'), encoding);
  let template = Handlebars.compile( htmlTemplate );
  let context = config;
  let html = template( context );

  fs.writeFileSync( path.join(__dirname, 'index.html'), html, encoding);
}

writeDocs();
