var gulp = require('gulp');
var path = require('path');
var tap = require('gulp-tap');
var clean = require('gulp-clean');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var replace = require('gulp-replace');
var inject = require('gulp-inject');
var zip = require('gulp-zip');

var now = new Date();
var version = process.env['VERSION'] || ['github', 'snapshot', +now].join('-');

var paths = {
  preamble: 'src/preamble.js',

  license: 'LGPL-LICENSE.txt',

  releases: 'releases',

  libs: {
    dir: 'lib',
    arbor: 'arbor.js'
  },

  sources: [
    'src/preamble.js',
    'src/namespace.js', 
    'src/is.js', 
    'src/util.js', 
    'src/math.js', 
    'src/instance-registration.js', 
    'src/extension.js',
    'src/jquery-plugin.js',
    'src/event.js',
    'src/define.js',
    'src/selector.js',
    'src/style.js',
    'src/core.js',
    'src/core-*.js',
    'src/collection.js',
    'src/collection-*.js',
    'src/extensions/renderer.canvas.define-and-init-etc.js',
    'src/extensions/renderer.canvas.*.js',
    'src/extensions/*.js'
  ],

  build: {
    dir: 'build',
    concatJs: 'cytoscape.js',
    minJs: 'cytoscape.min.js',
    zip: 'cytoscape.js-' + version + '.zip',
  },

  debug: {
    dir: 'debug',
    page: 'index.html'
  },

  test: {
    dir: 'test',
    page: 'index.html'
  }
};

paths.build.zipContents = [
  [paths.build.dir, paths.build.concatJs].join('/'),
  [paths.build.dir, paths.build.minJs].join('/'),
  [paths.libs.dir, paths.libs.arbor].join('/'),
  paths.license
];

gulp.task('default', function(){
  
});

gulp.task('version', function(){
  console.log('Using version number `%s` for building', version);
});

gulp.task('clean', function(){
  return gulp.src( paths.build.dir )
    .pipe( clean({ read: false }) )
  ;
});

gulp.task('build', function(){
  return gulp.src( paths.sources )
    .pipe( replace('{{VERSION}}', version) )
    
    .pipe( concat( paths.build.concatJs ) )
    
    .pipe( gulp.dest( paths.build.dir ) )
    
    .pipe( uglify({
      mangle: true,

      preserveComments: 'some'
    }) )

    .pipe( concat( paths.build.minJs ) )
    
    .pipe( gulp.dest( paths.build.dir ) )
  ;
});

gulp.task('debugrefs', function(){
  return gulp.src( [paths.debug.dir, paths.debug.page].join('/') )
    .pipe( inject( gulp.src(paths.sources, { read: false }), {
      addPrefix: '..',
      addRootSlash: false
    } ) )

    .pipe( gulp.dest( paths.debug.dir ) )
  ;
});

gulp.task('testrefs', function(){
  return gulp.src( [paths.test.dir, paths.test.page].join('/') )
    .pipe( inject( gulp.src(paths.sources, { read: false }), {
      addPrefix: '..',
      addRootSlash: false
    } ) )

    .pipe( gulp.dest( paths.test.dir ) )
  ;
});

gulp.task('zip', ['build'], function(){
  return gulp.src( paths.build.zipContents )
    .pipe( zip( paths.build.zip ) )

    .pipe( gulp.dest( paths.build.dir ) )
  ;
});