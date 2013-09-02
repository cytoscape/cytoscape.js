var fs = require('fs');
// var Converter = require('./js/Markdown.Converter').Converter;
// var converter = new Converter();
var marked = require('marked');
// var mdConvertor = require('node-markdown').Markdown;
var Handlebars = require('./js/handlebars').Handlebars;
var encoding = 'utf8';
var config;
var configFile = './docmaker.json';
var demoFile = './js/load.js';

try {
  config = require(configFile);
} catch(e){
  throw '`' + configFile + '` could not be read; check the JSON is formatted correctly http://jsonlint.com/';
}

// load the demo file
try {
  config.demojs = fs.readFileSync(demoFile, 'utf8');
} catch(e){
  throw '`' + demoFile + '` could not be read';
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
  var html = marked( md );

  return html;
}

function toUrl( str ){
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
  var matches = html.match(/\<h2\>.+?\<\/h2\>/g);
  var psubs = [];

  for( var i = 0; matches && i < matches.length; i++ ){
    var match = matches[i];
    var name = match.match(/\<h2\>(.+)\<\/h2\>/)[1];
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

function compileConfig( config ){
  var sections = config.sections;
  var parent = config;

  for( var i = 0; sections && i < sections.length; i++ ){
    var section = sections[i];

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

    if( section.fns ){
      var fns = section.fns;
      for( var j = 0; j < fns.length; j++ ){
        var fn = fns[j];

        fn.id = section.id + '/' + fn.name;
        fn.bookmark = makeBookmark( fn.id );

        if( fn.md ){
          fn.html = md2html( fn.md );

          // the html for functions should only have h3 tags, not h1 or h2
          fn.html = fn.html.replace(/\<h2\>/g, '<h3>');
          fn.html = fn.html.replace(/\<\/h2\>/g, '</h3>');
          fn.html = fn.html.replace(/\<h1\>/g, '<h3>');
          fn.html = fn.html.replace(/\<\/h1\>/g, '</h3>');
        }

        var formatsHaveDiffNames = false;
        if( fn.formats && !fn.formatsSameFn ){
          var formats = fn.formats;

          for( var k = 0; k < formats.length; k++ ){
            var format = formats[k];

            format.name = format.name || fn.name; // copy name to format if not specified

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

compileConfig( config );

var htmlTemplate = fs.readFileSync('./template.html', encoding);
var template = Handlebars.compile( htmlTemplate );
var context = config;
var html = template( context );

fs.writeFileSync('index.html', html, encoding);
