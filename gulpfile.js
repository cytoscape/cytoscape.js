var gulp = require('gulp');
var path = require('path');
var tap = require('gulp-tap');
var clean = require('gulp-clean');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var replace = require('gulp-replace');
var inject = require('gulp-inject');
var zip = require('gulp-zip');
var mocha = require('gulp-mocha');
var child_process = require('child_process');
var fs = require('fs');

var now = new Date();
var version = process.env['VERSION'] || ['snapshot', +now].join('-');

var paths = {
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
    'src/style-*.js',
    'src/core.js',
    'src/core-*.js',
    'src/collection.js',
    'src/collection-*.js',
    'src/heap.js',
    'src/extensions/renderer.canvas.define-and-init-etc.js',
    'src/extensions/renderer.canvas.*.js',
    'src/extensions/*.js'
  ]
};


gulp.task('default', ['build'], function(){
  
});

gulp.task('version', function(){
  console.log('Using version number `%s` for building', version);
});

gulp.task('clean', function(){
  return gulp.src(['build', 'dist'])
    .pipe( clean({ read: false }) )
  ;
});

gulp.task('concat', function(){
  return gulp.src( paths.sources )
    .pipe( replace('{{VERSION}}', version) )
    
    .pipe( concat('cytoscape.js') )
    
    .pipe( gulp.dest('build') )
  ;
});

gulp.task('build', function(){
  return gulp.src( paths.sources )
    .pipe( replace('{{VERSION}}', version) )
    
    .pipe( concat('cytoscape.js') )
    
    .pipe( gulp.dest('build') )
    
    .pipe( uglify({
      mangle: true,

      preserveComments: 'some'
    }) )

    .pipe( concat('cytoscape.min.js') )
    
    .pipe( gulp.dest('build') )
  ;
});

gulp.task('debugrefs', function(){
  return gulp.src('debug/index.html')
    .pipe( inject( gulp.src(paths.sources, { read: false }), {
      addPrefix: '..',
      addRootSlash: false
    } ) )

    .pipe( gulp.dest('debug') )
  ;
});

gulp.task('testrefs', function(){
  return gulp.src('test/index.html')
    .pipe( inject( gulp.src(paths.sources, { read: false }), {
      addPrefix: '..',
      addRootSlash: false
    } ) )

    .pipe( gulp.dest('test') )
  ;
});

gulp.task('testlist', function(){
  return gulp.src('test/index.html')
    .pipe( inject( gulp.src('test/*.js', { read: false }), {
      addPrefix: '',
      ignorePath: 'test',
      addRootSlash: false,
      starttag: '<!-- inject:test:{{ext}} -->'
    } ) )

    .pipe( gulp.dest('test') )
  ;
});

gulp.task('refs', ['debugrefs', 'testrefs', 'testlist'], function(next){
  next();
});

gulp.task('zip', ['build'], function(){
  return gulp.src(['build/cytoscape.js', 'build/cytoscape.min.js', 'LGPL-LICENSE.txt', 'lib/arbor.js'])
    .pipe( zip('cytoscape.js-' + version + '.zip') )

    .pipe( gulp.dest('build') )
  ;
});

gulp.task('test', ['concat'], function(){
  return gulp.src('test/*.js')
    .pipe( mocha({
      reporter: 'spec'
    }) )
  ;
});

gulp.task('docsver', function(){
  return gulp.src('documentation/docmaker.json')
    .pipe( replace(/\"version\"\:\s*\".*?\"/, '"version": "' + version + '"') )

    .pipe( gulp.dest('documentation') )
  ;
});

gulp.task('docsjs', ['build'], function(){
  return gulp.src([
    'build/cytoscape.js',
    'build/cytoscape.min.js',
    'lib/arbor.js'
  ])
    .pipe( gulp.dest('documentation/js') )

    .pipe( gulp.dest('documentation/api/cytoscape.js-' + version) )

    .pipe( gulp.dest('documentation/api/cytoscape.js-latest') )
  ;
});

gulp.task('docsdl', ['zip'], function(){
  return gulp.src('build/cytoscape.js-' + version + '.zip')
    .pipe( gulp.dest('documentation/download') )
  ;
});

gulp.task('docs', ['docsver'], function(next){
  var cwd = process.cwd();

  process.chdir('./documentation');
  require('./documentation/docmaker');
  process.chdir( cwd );

  next();
});

gulp.task('docspub', ['docs', 'docsjs', 'docsdl'], function(){

});

gulp.task('pkgver', function(){
  return gulp.src([
    'package.json',
    'bower.json'
  ])
    .pipe( replace(/\"version\"\:\s*\".*?\"/, '"version": "' + version + '"') )

    .pipe( gulp.dest('./') )
  ;
});

gulp.task('dist', ['build'], function(){
  return gulp.src([
    'build/cytoscape.js',
    'build/cytoscape.min.js',
    'build/arbor.js'
  ])
    .pipe( gulp.dest('dist') )
  ;
});

gulp.task('pub', ['pkgver', 'dist', 'docspub'], function(next){

  fs.chmodSync('./publish-tag.sh', 0775);
  fs.chmodSync('./publish-docs.sh', 0775);
  fs.chmodSync('./publish-npm.sh', 0775);
  child_process.execFile('./publish-tag.sh');
  child_process.execFile('./publish-npm.sh');
  child_process.execFile('./publish-docs.sh');

  next();
});

gulp.task('watch', function(next){
  var watcher = gulp.watch(paths.sources, ['testrefs','debugrefs']);
  watcher.on('added deleted', function(event){
    console.log('File '+ event.path+ ' was ' + event.type + ', updating lib refs in pages...');
  });

  var testWatcher = gulp.watch('test/*.js', ['testlist']);
  testWatcher.on('added deleted', function(event){
    console.log('File '+ event.path+ ' was ' + event.type + ', updating test refs in pages...');
  });

  next();
});