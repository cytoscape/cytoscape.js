'use strict';

/* eslint-disable */

var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var fs = require('fs');
var exec = require('child_process').exec;
var runSequence = require('run-sequence');
var del = require('del');
var vinylPaths = require('vinyl-paths');
var clean = function(){ return vinylPaths(del); };
var notifier = require('node-notifier');
var assign = require('object-assign');
var pkg = require('./package.json');
var env = process.env;
var path = require('path');
var requireUncached = require('require-uncached');

var webpack = function(){
  var w = require('webpack');

  return w.apply( w, arguments );
};

process.on('SIGINT', function() {
  $.util.log($.util.colors.red('Successfully closed gulp process ' + process.pid));
  process.exit(1);
});

var benchmarkVersion = require('./benchmark/old-version.json'); // old version to test against for benchmarks
var benchmarkVersionUrl = 'https://raw.githubusercontent.com/cytoscape/cytoscape.js/v' + benchmarkVersion + '/dist/cytoscape.js';

var version; // used for marking builds w/ version etc

var relPath = function( pathStr ){
  return path.relative( './', pathStr );
};

var paths = {
  sourceEntry: 'src/index.js',

  debugFiles: [
    'build/cytoscape.js'
  ],

  testFiles: [
    'build/cytoscape.js'
  ],

  docs: {
    libs: [
      'documentation/js/jquery.js',
      'documentation/js/cytoscape.min.js'
    ],

    js: [
      'documentation/js/load.js',
      'documentation/js/script.js'
    ],

    css: [
      'documentation/css/reset.css',
      'documentation/css/font-awesome.css',
      'documentation/css/highlight/github.css',
      'documentation/css/style.css'
    ],

    jsmin: 'documentation/js/all.min.js',

    cssmin: 'documentation/css/all.min.css',

    index: 'documentation/index.html'
  }
};

var logError = function( err ){
  notifier.notify({ title: 'Cytoscape.js', message: 'Error: ' + err.message });
  $.util.log( $.util.colors.red('Error in build:'), $.util.colors.red(err) );
};

// update these if you don't have a unix like env or these programmes aren't in your $PATH
var $TEMP_DIR = '/tmp';
var $DOC_DIR = 'documentation';
var replaceShellVars = function( cmds ){
  return cmds.map(function( cmd ){
    return cmd
      //.replace(/\$VERSION/g, version)
      .replace(/\$GIT/g, 'git')
      .replace(/\$RM/g, 'rm -rf')
      .replace(/\$CP/g, 'cp -R')
      .replace(/\$MKDIR/g, 'mkdir -p')
      .replace(/\$TEMP_DIR/g, $TEMP_DIR)
      .replace(/\$DOC_DIR/g, $DOC_DIR)
      .replace(/\$DL_DIR/g, 'download')
      .replace(/\$DOC_TOP_FILES/g, [
        'CNAME',
        'img',
        'font',
        'demos',
        'index.html'
      ].join(' '))
      .replace(/\$DOC_CSS_FILE/g, paths.docs.cssmin)
      .replace(/\$DOC_JS_FILE/g, paths.docs.jsmin)
      .replace(/\$DOC_DIST_FILE/g, 'documentation/js/cytoscape.min.js')
      .replace(/\$DOC_JQ_FILE/g, 'documentation/js/cash.min.js')
      .replace(/\$NPM/g, 'npm')
    ;
  });
};

gulp.task('default', ['build'], function( next ){
  next();
});

gulp.task('version', function( next ){
  if( version ){ next(); return; }

  var now = new Date();
  version = process.env['VERSION'];

  if( version ){
    done();
  } else {
    exec('git rev-parse HEAD', function( error, stdout, stderr ){
      var sha = stdout.substring(0, 10); // shorten so not huge filename

      version = [ 'snapshot', sha, +now ].join('-');
      done();
    });
  }

  function done(){
    console.log('Using version number `%s` for building', version);

    fs.writeFileSync('./src/version.js', 'module.exports = "'+ version +'";\n');

    next();
  }

});

gulp.task('confirm-ver', ['version'], function(){
  return gulp.src('.')
    .pipe( $.prompt.confirm({ message: 'Are you sure version `' + version + '` is OK to publish?' }) )
  ;
});

gulp.task('clean', function(){
  return gulp.src(['build'])
    .pipe( clean({ read: false }) )
  ;
});

gulp.task('build-unmin', ['version'], function( next ){
  env.NODE_ENV = 'development';
  env.FILENAME = 'cytoscape.js';
  env.MINIFY = false;
  env.BABEL = true;
  env.SOURCEMAPS = false;

  webpack( requireUncached('./webpack.config'), next );
});

gulp.task('build-min', ['version'], function( next ){
  env.NODE_ENV = 'development';
  env.FILENAME = 'cytoscape.min.js';
  env.MINIFY = true;
  env.BABEL = true;
  env.SOURCEMAPS = false;

  webpack( requireUncached('./webpack.config'), next );
});

gulp.task('build-cjs', ['version'], function( next ){
  env.NODE_ENV = 'production';
  env.FILENAME = 'cytoscape.cjs.js';
  env.MINIFY = false;
  env.BABEL = true;
  env.SOURCEMAPS = false;

  webpack( requireUncached('./webpack.config'), next );
});

gulp.task('build', function( next ){
  return runSequence( 'build-unmin', 'build-min', 'build-cjs', next );
});

gulp.task('debug-refs', function(){
  return gulp.src('debug/index.html')
    .pipe( $.inject( gulp.src(paths.debugFiles, { read: false }), {
      addPrefix: '..',
      addRootSlash: false
    } ) )

    .pipe( gulp.dest('debug') )
  ;
});

gulp.task('test-refs', function(){
  return gulp.src('test/index.html')
    .pipe( $.inject( gulp.src(paths.testFiles, { read: false }), {
      addPrefix: '..',
      addRootSlash: false
    } ) )

    .pipe( gulp.dest('test') )
  ;
});

gulp.task('test-list', function(){
  return gulp.src('test/index.html')
    .pipe( $.inject( gulp.src('test/*.js', { read: false }), {
      addPrefix: '',
      ignorePath: 'test',
      addRootSlash: false,
      starttag: '<!-- inject:test:{{ext}} -->'
    } ) )

    .pipe( gulp.dest('test') )
  ;
});

gulp.task('refs', function(next){
  runSequence( 'debug-refs', 'test-refs', 'test-list', next );
});

gulp.task('zip', ['version', 'build'], function(){
  return gulp.src([
    'build/cytoscape.js',
    'build/cytoscape.min.js',
    'build/cytoscape.cjs.js',
    'LICENSE'
  ])
    .pipe( $.zip('cytoscape.js-' + version + '.zip') )

    .pipe( gulp.dest('build') )
  ;
});

gulp.task('test', function(){
  return gulp.src('test/*.js')
    .pipe( $.mocha({
      reporter: 'spec'
    }) )
  ;
});

gulp.task('test-build', function(next){
  process.env['TEST_BUILD'] = 'true';

  return runSequence('test', next);
});

gulp.task('benchmark-old-ver', function(){
  return $.download( benchmarkVersionUrl )
    .pipe(gulp.dest("benchmark/suite"));
});

gulp.task('benchmark', ['benchmark-old-ver'], function(next){
  gulp.src('benchmark/*.js')
    .pipe( $.benchmark() )
  ;
});

gulp.task('benchmark-single', ['benchmark-old-ver'], function(next){
  gulp.src('benchmark/single/index.js')
    .pipe( $.benchmark() )
  ;
});

gulp.task('docs-ver', ['version'], function(){
  return gulp.src('documentation/docmaker.json')
    .pipe( $.replace(/\"version\"\:\s*\".*?\"/, '"version": "' + version + '"') )

    .pipe( gulp.dest('documentation') )
  ;
});

gulp.task('docs-js', ['version', 'build-min'], function(){
  return gulp.src([
    'build/cytoscape.min.js'
  ])
    .pipe( gulp.dest('documentation/js') )
  ;
});

gulp.task('docs', function(next){
  require('./documentation/docmaker');
  next();
});

gulp.task('docs-min', function(next){
  runSequence( 'docs', 'docs-min-refs', 'docs-html-min', next );
});

gulp.task('docs-clean', function(next){
  return gulp.src([paths.docs.jsmin, paths.docs.cssmin, paths.docs.index])
    .pipe( clean({ read: false }) )
  ;
});

gulp.task('docs-html-min', function(){
  return gulp.src(paths.docs.index)
    .pipe( $.htmlmin({
      collapseWhitespace: true,
      keepClosingSlash: true
    }) )

    .pipe( gulp.dest('documentation') )
  ;
});

gulp.task('docs-js-min', function(){
  return gulp.src( paths.docs.js )
    .pipe( $.concat('all.min.js') )

    .pipe( $.uglify({
      mangle: true
    }) )

    .pipe( gulp.dest('documentation/js') )
  ;
});

gulp.task('docs-css-min', function(){
  return gulp.src( paths.docs.css )
    .pipe( $.concat('all.min.css') )

    .pipe( $.cssmin() )

    .pipe( gulp.dest('documentation/css') )
  ;
});

gulp.task('docs-min-refs', ['docs-css-min', 'docs-js-min'], function(){
  return gulp.src(paths.docs.index)
    .pipe( $.inject( gulp.src( paths.docs.libs.concat([ paths.docs.cssmin, paths.docs.jsmin ]) ), {
      addRootSlash: false,
      ignorePath: 'documentation'
    } ) )

    .pipe( gulp.dest('documentation') )
  ;
});

gulp.task('docs-refs', function(){
  return gulp.src([ paths.docs.index, 'documentation/template.html' ])
    .pipe( $.inject( gulp.src(paths.docs.libs.concat( paths.docs.js.concat( paths.docs.css ) ), { read: false }), {
      addRootSlash: false,
      ignorePath: 'documentation'
    } ) )

    .pipe( gulp.dest('documentation') )
  ;
});

gulp.task('docs-pub', function(next){
  runSequence( 'version', 'docs-ver', 'docs-js', 'docs-min', next );
});

gulp.task('docs-rebuild', function(next){
  runSequence( 'docs-min', next );
});

gulp.task('pkgver', ['version'], function(){
  return gulp.src([
    'package.json',
    'bower.json'
  ])
    .pipe( $.replace(/\"version\"\:\s*\".*?\"/, '"version": "' + version + '"') )

    .pipe( gulp.dest('./') )
  ;
});

gulp.task('dist', ['build'], function(){
  return gulp.src([
    'build/cytoscape.js',
    'build/cytoscape.min.js',
    'build/cytoscape.cjs.js'
  ])
    .pipe( gulp.dest('dist') )
  ;
});

gulp.task('pubprep', function(next){
  runSequence('pkgver', 'dist', 'copyright', 'docs-pub', 'pubpush', next);
});

gulp.task('pubpush', $.shell.task( replaceShellVars([
  '$GIT add -A',
  '$GIT commit -m "Preparing to publish $VERSION"',
  '$GIT push'
]) ));

gulp.task('publish', function(next){
  runSequence('confirm-ver', 'pubprep', 'tag', 'docs-push', 'npm', next);
});

gulp.task('tag', $.shell.task( replaceShellVars([
  '$GIT tag -a v$VERSION -m "v$VERSION"',
  '$GIT push origin v$VERSION'
]) ));

gulp.task('docs-push', function(){
  return gulp.src('')
    .pipe( $.shell( replaceShellVars([
      '$RM $TEMP_DIR/cytoscape.js',
      '$GIT clone -b gh-pages https://github.com/cytoscape/cytoscape.js.git $TEMP_DIR/cytoscape.js',
      '$RM $TEMP_DIR/cytoscape.js/**'
    ]) ) )

    .pipe( $.shell( replaceShellVars([
      '$CP $DOC_TOP_FILES $TEMP_DIR/cytoscape.js'
    ]), { cwd: $DOC_DIR } ) )

    .pipe( $.shell( replaceShellVars([
      '$MKDIR $TEMP_DIR/cytoscape.js/js',
      '$CP $DOC_JS_FILE $TEMP_DIR/cytoscape.js/js',

      '$MKDIR $TEMP_DIR/cytoscape.js/css',
      '$CP $DOC_CSS_FILE $TEMP_DIR/cytoscape.js/css',
    ].concat( paths.docs.libs.map(function(lib){
      return '$CP ' + lib + ' $TEMP_DIR/cytoscape.js/js';
    }) ) ) ) )

    .pipe( $.shell( replaceShellVars([
      '$GIT add -A',
      '$GIT commit -a -m "Updating docs to $VERSION"',
      '$GIT push origin'
    ]), { cwd: $TEMP_DIR + '/cytoscape.js' } ) )
  ;
});

gulp.task('sniper', ['build-min'], $.shell.task( replaceShellVars([
  '$NPM run sniper'
]) ));

gulp.task('copyright', $.shell.task( replaceShellVars([
  '$NPM run copyright'
]) ));

gulp.task('npm', $.shell.task( replaceShellVars([
  '$NPM publish .'
]) ));

gulp.task('watch-babel', function(next){
  env.BABEL = true;

  return runSequence('watch', next);
});

gulp.task('watch', function(next){
  if( env.BABEL === undefined ){
    env.BABEL = false;
  }

  env.MINIFY = false;
  env.FILENAME = 'cytoscape.js';
  env.NODE_ENV = 'development';
  env.SOURCEMAPS = true;

  var out = 'build/cytoscape.js';

  version = 'watch-build';

  $.livereload.listen();

  gulp.watch('test/*.js', ['test-list'])
    .on('added deleted', function( event ){
      $.util.log('File', $.util.colors.magenta( relPath(event.path) ), 'was', event.type);
    })
  ;

  gulp.watch('debug/**').on('change', function( event ){
    $.util.log('File', $.util.colors.magenta( relPath(event.path) ), ' was modified');

    $.livereload.reload();
  });

  gulp.watch( out ).on('change', function( event ){
    gulp.src( out ).pipe( $.livereload() );
  });

  var compiler = webpack( requireUncached('./webpack.config') );

  compiler.watch({}, function( err, stats ){
    console.log( stats.toString({ colors: true }) );
  });

  next();
});

// http://www.jshint.com/docs/options/
gulp.task('lint', function(){
  return gulp.src( 'src/**/*.js' )
    .pipe( $.eslint() )

    .pipe( $.eslint.format() )

    .pipe( $.eslint.failAfterError() )
  ;
});
