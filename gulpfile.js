var gulp = require('gulp');
var path = require('path');
var tap = require('gulp-tap');
var clean = require('gulp-clean');

var now = new Date();
var version = process.env['VERSION'] || ['snapshot', +now].join('-');

var paths = {
  sources: [
    'src/namespace.js', 
    'src/is.js', 
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

  build: 'build'
};

gulp.task('default', function(){
  gulp.src( paths.sources )
    .pipe( tap(function(file, t){
      console.log(file.path)
    }) )
  ;
});

gulp.task('version', function(){
  console.log('Using version number `%s` for building', version);
});

gulp.task('clean', function(){
  gulp.src( paths.build )
    .pipe( clean({ read: false }) )
  ;
});