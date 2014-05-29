var fs = require('fs');
var Handlebars = require('handlebars');
var encoding = 'utf8';

var files = fs.readdirSync('.').sort().reverse().filter(function( file ){
  return file.match(/\.zip$/);
});

var builds = files.map(function( file ){
  return {
    filename: file
  };
});

var htmlTemplate = fs.readFileSync('./template.html', encoding);
var template = Handlebars.compile( htmlTemplate );
var context = {
  builds: builds
};
var html = template( context );

fs.writeFileSync('index.html', html, encoding);
