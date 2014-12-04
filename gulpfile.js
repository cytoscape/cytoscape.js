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
var htmlmin = require('gulp-htmlmin');
var cssmin = require('gulp-cssmin');
var shell = require('gulp-shell');
var jshint = require('gulp-jshint');
var jshStylish = require('jshint-stylish');
var exec = require('child_process').exec;
var runSequence = require('run-sequence');
var browserify = require('browserify');
var source = require('vinyl-source-stream'); // converts node streams into vinyl streams

var version; // used for marking builds w/ version etc

var paths = {
  sources: [
    'src/preamble.js',
    'src/namespace.js',
    'src/promise.js',
    'src/is.js', 
    'src/util.js', 
    'src/math.js',  
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
  ],

  docs: {
    js: [
      'documentation/js/fastclick.js',
      'documentation/js/jquery.js',
      'documentation/js/cytoscape.js',
      'documentation/js/load.js',
      'documentation/js/script.js'
    ],

    css: [
      'documentation/css/reset.css',
      'documentation/css/font-awesome.css',
      'documentation/css/highlight/github.css',
      'documentation/css/style.css'
    ]
  }
};


gulp.task('default', ['build'], function(){
  
});

gulp.task('version', function( next ){
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
    next();
  }
  
});

gulp.task('clean', function(){
  return gulp.src(['build'])
    .pipe( clean({ read: false }) )
  ;
});

gulp.task('concat', ['version'], function(){
  return gulp.src( paths.sources )
    .pipe( replace('{{VERSION}}', version) )
    
    .pipe( concat('cytoscape.js') )
    
    .pipe( gulp.dest('build') )
  ;
});

gulp.task('build', ['version'], function(){
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

gulp.task('zip', ['version', 'build'], function(){
  return gulp.src(['build/cytoscape.js', 'build/cytoscape.min.js', 'LGPL-LICENSE.txt', 'lib/*.js'])
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

gulp.task('docsver', ['version'], function(){
  return gulp.src('documentation/docmaker.json')
    .pipe( replace(/\"version\"\:\s*\".*?\"/, '"version": "' + version + '"') )

    .pipe( gulp.dest('documentation') )
  ;
});

gulp.task('docsjs', ['version', 'build'], function(){
  return gulp.src([
    'build/cytoscape.js',
    'build/cytoscape.min.js',
    'lib/*.js'
  ])
    .pipe( gulp.dest('documentation/js') )

    .pipe( gulp.dest('documentation/api/cytoscape.js-' + version) )

    .pipe( gulp.dest('documentation/api/cytoscape.js-latest') )
  ;
});

gulp.task('docsdl', ['version', 'zip'], function(){
  return gulp.src('build/cytoscape.js-' + version + '.zip')
    .pipe( gulp.dest('documentation/download') )
  ;
});

gulp.task('docsbuildlist', ['docsdl'], function(next){
  var cwd = process.cwd();

  process.chdir('./documentation/download');
  require('./documentation/download/dlmaker')(function(){
    process.chdir( cwd );

    next();
  });
  
});

gulp.task('snapshotpush', ['docsdl'], shell.task([
  './publish-buildlist.sh'
]));

gulp.task('docs', function(next){
  var cwd = process.cwd();

  process.chdir('./documentation');
  require('./documentation/docmaker')( function(){
    process.chdir( cwd );

    next();
  } );
  
});

gulp.task('docsmin', function(next){
  runSequence( 'docs', 'docsminrefs', 'docshtmlmin', next );
});

gulp.task('docsclean', function(next){
  return gulp.src(['documentation/js/all.min.js', 'documentation/css/all.min.css', 'documentation/index.html'])
    .pipe( clean({ read: false }) )
  ;
});

gulp.task('docshtmlmin', function(){
  return gulp.src('documentation/index.html')
    .pipe( htmlmin({
      collapseWhitespace: true,
      keepClosingSlash: true
    }) )

    .pipe( gulp.dest('documentation') )
  ;
});

gulp.task('docsjsmin', function(){
  return gulp.src( paths.docs.js )
    .pipe( concat('all.min.js') )
    
    .pipe( uglify({
      mangle: true
    }) )

    .pipe( gulp.dest('documentation/js') )
  ;
});

gulp.task('docscssmin', function(){ 
  return gulp.src( paths.docs.css )
    .pipe( concat('all.min.css') )

    .pipe( cssmin() )

    .pipe( gulp.dest('documentation/css') )
  ;
});

gulp.task('docsminrefs', ['docscssmin', 'docsjsmin'], function(){
  return gulp.src('documentation/index.html')
    .pipe( inject( gulp.src([ 'documentation/js/all.min.js', 'documentation/css/all.min.css' ] ), {
      addRootSlash: false,
      ignorePath: 'documentation'
    } ) )

    .pipe( gulp.dest('documentation') )
  ;
});

gulp.task('docsrefs', function(){
  return gulp.src([ 'documentation/index.html', 'documentation/template.html' ])
    .pipe( inject( gulp.src(paths.docs.js.concat( paths.docs.css ), { read: false }), {
      addRootSlash: false,
      ignorePath: 'documentation'
    } ) )

    .pipe( gulp.dest('documentation') )
  ;
});

gulp.task('docsdemoshots', function(next){
  var cwd = process.cwd();

  process.chdir('./documentation');
  require('./documentation/demoshots')( function(){
    process.chdir( cwd );

    next();
  } );
});

gulp.task('docspub', function(next){
  runSequence( 'version', 'docsver', 'docsjs', 'docsbuildlist', 'docsdemoshots', 'docs', 'docsmin', next );
});

gulp.task('docsrebuild', function(next){
  runSequence( 'docs', 'docsmin', next );
});

gulp.task('pkgver', ['version'], function(){
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
    'build/cytoscape.min.js'
  ])
    .pipe( gulp.dest('dist') )
  ;
});

gulp.task('pub', function(next){
  runSequence('pkgver', 'dist', 'docspub', next);
});

gulp.task('tag', shell.task([
  './publish-tag.sh'
]));

gulp.task('docspush', shell.task([
  './publish-docs.sh'
]));

gulp.task('unstabledocspush', shell.task([
  './publish-unstable-docs.sh'
]));

// browserify debug build
gulp.task('browserify', ['build'], function(){
  var b = browserify({ debug: true, hasExports: true });
  
  b.add('./build/cytoscape.js', { expose: "cytoscape" });

  return b.bundle()
    .pipe( source('cytoscape.browserify.js') )
    .pipe( gulp.dest('build') )
  ;
});

gulp.task('sniper', ['browserify'], shell.task([
  'npm run sniper'
]));

gulp.task('npm', shell.task([
  './publish-npm.sh'
]));

gulp.task('watch', function(next){
  var watcher = gulp.watch(paths.sources, ['testrefs','debugrefs']);
  watcher.on('added deleted', function(event){
    console.log('File ' + event.path + ' was ' + event.type + ', updating lib refs in pages...');
  });

  var testWatcher = gulp.watch('test/*.js', ['testlist']);
  testWatcher.on('added deleted', function(event){
    console.log('File ' + event.path + ' was ' + event.type + ', updating test refs in pages...');
  });

  next();
});

// http://www.jshint.com/docs/options/
gulp.task('lint', function(){
  return gulp.src( paths.sources )
    .pipe( jshint({
      funcscope: true,
      laxbreak: true,
      loopfunc: true,
      strict: true,
      unused: 'vars',
      eqnull: true,
      sub: true,
      shadow: true,
      laxcomma: true
    }) )

    .pipe( jshint.reporter(jshStylish) )
  ;
});
