var fs = require('fs');
// var Converter = require('./js/Markdown.Converter').Converter;
// var converter = new Converter();
var marked = require('marked');
// var mdConvertor = require('node-markdown').Markdown;
var Handlebars = require('handlebars');
var jsonlint = require('jsonlint');
var hljs = require('highlight.js');
var encoding = 'utf8';
var config;
var configFile = './docmaker.json';
var demoFile = './js/load.js';
var mdRend = new marked.Renderer();

rendCode = mdRend.code;
mdRend.code = function(code, lang){
  var button = '';

  if( lang === 'js' ){
    button = '<button class="run run-inline-code"><span class="icon-play"></span></button>';
  }

  return rendCode.call(this, code, lang) + button;
};

try {
  jsonlint.parse( fs.readFileSync(configFile, 'utf8') ); // validate first for convenience
  config = require( configFile );
} catch(e){
  console.error('\n`' + configFile + '` could not be read; check the JSON is formatted correctly via jsonlint');
  throw e;
}

// load the demo file
try {
  config.demojs = fs.readFileSync(demoFile, 'utf8');

  config.demojs = config.demojs.match(/\/\/\<demo\>\s*((?:\s|.)+?)\s*\/\/\<\/demo\>/)[1];

  config.demojs = hljs.highlight('js', config.demojs).value;
} catch(e){
  throw '`' + demoFile + '` could not be read and parsed: ' + e;
}

function linkifyArg( arg ){
  var link = config.fnArgLinks[ arg.name ];
  
  if( link ){
    arg.linkedName = '<a href="'+ link +'">' + arg.name + '</a>';
  } else {
    arg.linkedName = arg.name;
  }
}

// var html = converter.makeHtml("**I am bold!**");
// var html = Handlebars.compile();

function md2html( file ){
  file = file.substr( file.length - 3 ) === '.md' ? file : file + '.md'; // add extension if need be

  var md;
  try{
    md = fs.readFileSync('./md/' + file, 'utf8');
  } catch(e){
    throw 'A markdown file named `' + file + '` was referenced but could not be read';
  }

  // var html = converter.makeHtml( md );
  //var html = mdConvertor( md );
  var html = marked( md, {
    highlight: function(code, lang){
      var ret;

      if( lang ){
        ret = hljs.highlight(lang, code).value;
      } else {
        ret = hljs.highlightAuto(code).value;
      }

      return ret;
      
    },

    renderer: mdRend
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
  return '<a href="#'+ id +'"><span class="icon-bookmark"></span></a>';
}

function parseSubsections( section ){
  var parentName = section.name;
  var html = section.html;
  var matches = html.match(/\<h2.*?\>.+?\<\/h2\>/g);
  var psubs = [];

  for( var i = 0; matches && i < matches.length; i++ ){
    var match = matches[i];
    var name = match.match(/\<h2.*?\>(.+)\<\/h2\>/)[1];
    var id = toUrl(parentName) + '/' + toUrl(name);

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
  demo.viewUrl = 'http://jsbin.com/gist/' + demo.id + '?js,output';
  demo.imgUrl = 'img/demos/' + demo.id + '.png';
  demo.githubUrl = 'https://gist.github.com/' + demo.id;
  demo.downloadUrl = 'https://gist.github.com/' + demo.id + '/download';
}

function compileConfig( config ){
  var sections = config.sections;
  var parent = config;

  for( var i = 0; sections && i < sections.length; i++ ){
    var section = sections[i];

    if( section.layout ){ section.name = section.layout.name; }

    section.id = (parent.name ? (toUrl(parent.name) + '/') : '') + toUrl( section.name );
    section.bookmark = makeBookmark( section.id );

    if( section.md ){
      section.html = md2html( section.md );

      var psubs = parseSubsections( section );

      var subs = section.sections = section.sections || [];
      section.sections = subs.concat( psubs );
    }

    if( section.mddescr ){
      section.descr = md2html( section.mddescr );
    }

    if( section.demos ){
      var demos = section.demos;

      for( var j = 0; j < demos.length; j++ ){
        var demo = demos[j];

        populateDemo( demo );
      }
    }

    if( section.demo ){
      populateDemo( section.demo );
    }

    if( section.extensions ){
      var exts = section.extensions;

      for( var j = 0; j < exts.length; j++ ){
        var ext = exts[j];

        ext.url = 'https://github.com/' + ext.github;
      }

      section.extensions = exts.sort(function(a, b){
        if( a.name < b.name ){
          return -1;
        } else {
          return 1;
        }
      });
    }

    if( section.layout ){
      var layout = section.layout;

      section.name = layout.name;
      layout.code = fs.readFileSync( '../src/extensions/layout.' + layout.name + '.js', 'utf8' );

      try {
        layout.options = layout.code.match(/defaults\s*\=\s*(\{(?:.|\s)+?\}\;)/)[1];
        
        var lopts = layout.options;

        // cleanup indent
        lopts = lopts.replace(/\n[ ]{4}/g, '\n  ');
        lopts = lopts.replace(/[ ]{2}\}\;/g, '};');

        // add name
        lopts = lopts.replace(/\{/, '{\n  name: \'' + layout.name + '\',\n');
        
        // wrap w/ code
        lopts = 'var options = ' + lopts + '\n\ncy.layout( options );';

        // highlight
        lopts = hljs.highlight('js', lopts).value;

        layout.optionsFormatted = lopts;
      } catch(e){
        throw 'Error processing layout options for `'+ layout.name +'`; must have `defaults = { ... };`';
      }
    }


    function processFields( fields ){
      for( var i = 0; fields && i < fields.length; i++ ){
        var field = fields[i];

        field.descr = marked( field.descr  || '' );

        linkifyArg( field );

        if( field.fields ){
          processFields( field.fields );
        }
      }
    }

    if( section.fns ){
      var fns = section.fns;
      for( var j = 0; j < fns.length; j++ ){
        var fn = fns[j];

        fn.id = section.id + '/' + fn.name;
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

        var formatsHaveDiffNames = false;
        if( fn.formats ){
          var formats = fn.formats;

          for( var k = 0; k < formats.length; k++ ){
            var format = formats[k];

            format.name = format.name || fn.name; // copy name to format if not specified
            format.descr = marked( format.descr || '' );

            if( format.args ){
              for( var m = 0; m < format.args.length; m++ ){
                var arg = format.args[m];

                linkifyArg( arg );

                arg.descr = marked( arg.descr || '' );

                processFields( arg.fields );
              }
            }

            if( format.name !== fn.name ){
              formatsHaveDiffNames = true;
            }
          }
        } // if

        // mark as diff names
        if( formatsHaveDiffNames ){
          fn.aliases = true;
        }
        
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

module.exports = function( next ){
  compileConfig( config );

  var htmlTemplate = fs.readFileSync('./template.html', encoding);
  var template = Handlebars.compile( htmlTemplate );
  var context = config;
  var html = template( context );

  fs.writeFileSync('index.html', html, encoding);

  next && next();
};


