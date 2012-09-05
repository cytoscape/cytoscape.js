var fs = require('fs');
var Converter = require('./js/Markdown.Converter').Converter;
var converter = new Converter();
var Handlebars = require('./js/handlebars').Handlebars;
var config = require('./docmaker.json');
var encoding = 'utf8';


// var html = converter.makeHtml("**I am bold!**");
// var html = Handlebars.compile();

function md2html( file ){
  file = file.substr( file.length - 3 ) === '.md' ? file : file + '.md'; // add extension if need be

  var md = fs.readFileSync('./md/' + file, 'utf8');
  var html = converter.makeHtml( md );

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

  for( var i = 0; i < matches.length; i++ ){
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

function compileMarkdown( config ){
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

    if( section.sections ){ // then compile those subsections too
      compileMarkdown( section );
    }
  }
};

compileMarkdown( config );

var htmlTemplate = fs.readFileSync('./template.html', encoding);
var template = Handlebars.compile( htmlTemplate );
var context = config;
var html = template( context );

fs.writeFileSync('index.html', html, encoding);
