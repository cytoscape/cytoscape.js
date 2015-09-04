var gulp = require('gulp');
var path = require('path');
var tap = require('gulp-tap');
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
var benchmark = require('gulp-benchmark');
var del = require('del');
var vinylPaths = require('vinyl-paths');
var clean = function(){ return vinylPaths(del) };
var decompress = require('gulp-decompress');
var rename = require("gulp-rename");
var unzip = require('gulp-unzip');
var request = require('request');
var download = require("gulp-download");
// var download = function(url){ return request.get(url); };
var prompt = require('gulp-prompt');
var browserifyHeader = require('browserify-header');
var vfs = require('vinyl-fs');
var transform = require('vinyl-transform');
var buffer = require('vinyl-buffer');
var sourcemaps = require('gulp-sourcemaps');
var livereload = require('gulp-livereload');
var watchify = require('watchify');
var derequire = require('gulp-derequire');

var benchmarkVersion = '2.3.15'; // old version to test against for benchmarks
var benchmarkVersionUrl = 'https://raw.githubusercontent.com/cytoscape/cytoscape.js/v' + benchmarkVersion + '/dist/cytoscape.js';

var weaverVersion = 'master';
var weaverUrlBase = 'https://raw.githubusercontent.com/maxkfranz/weaver/' + weaverVersion + '/';

var addWeaverUrlBase = function( path ){
  return weaverUrlBase + path;
};

var weaverSrc = [
  'src/thread.js',
  'src/fabric.js',
  'src/thread-node-fork.js'
].map( addWeaverUrlBase );

var weaverTest = [
  'test/thread.js',
  'test/fabric.js',
  'test/requires/foo.js'
].map( addWeaverUrlBase );

var weaverTestReqs = [
  'test/requires/foo.js'
].map( addWeaverUrlBase );

var version; // used for marking builds w/ version etc

var paths = {
  sourceEntry: 'src/index.js',

  preamble: 'src/preamble.js',

  nodethreadName: 'thread-node-fork.js',
  nodethreadSrc: [
    'src/preamble.js',
    'src/thread-node-fork.js'
  ],

  debugFiles: [
    'build/cytoscape.js'
  ],

  testFiles: [
    'build/cytoscape.js'
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

var browserifyOpts = {
  entries: paths.sourceEntry,
  debug: true,
  builtins: [],
  bundleExternal: false,
  detectGlobals: false,
  standalone: 'cytoscape'
};

// update these if you don't have a unix like env or these programmes aren't in your $PATH
var $GIT = 'git';
var $RM = 'rm -rf';
var $CP = 'cp -R';
var $TEMP_DIR = '/tmp';
var $DOC_DIR = 'documentation';
var $DL_DIR  = 'download';
var $NPM = 'npm';
var $METEOR = 'meteor';
var $SPM = 'spm';

var replaceShellVars = function( cmds ){
  return cmds.map(function( cmd ){
    return cmd
      //.replace(/\$VERSION/g, version)
      .replace(/\$GIT/g, 'git')
      .replace(/\$RM/g, 'rm -rf')
      .replace(/\$CP/g, 'cp -R')
      .replace(/\$TEMP_DIR/g, '/tmp')
      .replace(/\$DOC_DIR/g, 'documentation')
      .replace(/\$DL_DIR/g, 'download')
      .replace(/\$NPM/g, 'npm')
      .replace(/\$METEOR/g, 'meteor')
      .replace(/\$SPM/g, 'spm')
    ;
  });
};

gulp.task('default', ['build'], function( next ){
  next();
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

gulp.task('confver', ['version'], function(){
  return gulp.src('.')
    .pipe( prompt.confirm({ message: 'Are you sure version `' + version + '` is OK to publish?' }) )
  ;
});

gulp.task('clean', function(){
  return gulp.src(['build'])
    .pipe( clean({ read: false }) )
  ;
});



gulp.task('concat', ['version', 'nodeworker'], function(){
  return browserify( browserifyOpts )
    .plugin( browserifyHeader, { file: paths.preamble } )
    .bundle()
    .pipe( source('cytoscape.js') )
    .pipe( buffer() )
    .pipe( derequire() )
    .pipe( replace('{{VERSION}}', version) )
    .pipe( gulp.dest('build') )
  ;
});

gulp.task('build-unmin', ['version', 'nodeworker'], function(){
  return browserify( browserifyOpts )
    .plugin( browserifyHeader, { file: paths.preamble } )
    .bundle()
    .pipe( source('cytoscape.js') )
    .pipe( buffer() )
    .pipe( sourcemaps.init({ loadMaps: true }) )
    .pipe( derequire() )
    .pipe( replace('{{VERSION}}', version) )
    .pipe( sourcemaps.write('.') )
    .pipe( gulp.dest('build') )
  ;
});

gulp.task('build-min', ['version', 'nodeworker'], function(){
  return browserify( browserifyOpts )
    .plugin( browserifyHeader, { file: paths.preamble } )
    .bundle()
    .pipe( source('cytoscape.min.js') )
    .pipe( buffer() )
    .pipe( sourcemaps.init({ loadMaps: true }) )
    .pipe( derequire() )
    .pipe( replace('{{VERSION}}', version) )
    .pipe( uglify({ mangle: true, preserveComments: 'some' }) )
    .pipe( sourcemaps.write('.') )
    .pipe( gulp.dest('build') )
  ;
});

gulp.task('build', ['build-unmin', 'build-min'], function( next ){
  next();
});

gulp.task('nodeworker', ['version'], function(){
  return gulp.src( paths.nodethreadSrc )
    .pipe( replace('{{VERSION}}', version) )

    .pipe( concat(paths.nodethreadName) )

    .pipe( gulp.dest('build') )
  ;
});

gulp.task('debugrefs', function(){
  return gulp.src('debug/index.html')
    .pipe( inject( gulp.src(paths.debugFiles, { read: false }), {
      addPrefix: '..',
      addRootSlash: false
    } ) )

    .pipe( gulp.dest('debug') )
  ;
});

gulp.task('testrefs', function(){
  return gulp.src('test/index.html')
    .pipe( inject( gulp.src(paths.testFiles, { read: false }), {
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

gulp.task('refs', function(next){
  runSequence( 'debugrefs', 'testrefs', 'testlist', next );
});

gulp.task('zip', ['version', 'build'], function(){
  return gulp.src([
    'build/cytoscape.js',
    'build/cytoscape.js.map',
    'build/cytoscape.min.js',
    'build/cytoscape.min.js.map',
    'LGPL-LICENSE.txt',
    'lib/*.js'
  ])
    .pipe( zip('cytoscape.js-' + version + '.zip') )

    .pipe( gulp.dest('build') )
  ;
});

gulp.task('test', ['concat'], function(next){
  return gulp.src('test/*.js')
    .pipe( mocha({
      reporter: 'spec'
    }) )
  ;
});

gulp.task('weaver-src', function(){

  return download( weaverSrc )
    .pipe( replace('weaver', 'cytoscape') )
    .pipe( gulp.dest('src') )
  ;

});

gulp.task('weaver-test', function(){

  return download( weaverTest )
    .pipe( replace('weaver', 'cytoscape') )
    .pipe( gulp.dest('test') )
  ;

});

gulp.task('weaver-test-reqs', function(){

  return download( weaverTestReqs )
    .pipe( gulp.dest('test/requires') )
  ;

});

gulp.task('weaver', function(next){
  return runSequence(['weaver-src', 'weaver-test', 'weaver-test-reqs'], next);
});

gulp.task('benchmark-old-ver', function(){
  return download( benchmarkVersionUrl )
    .pipe(gulp.dest("benchmark/CySuite"));
});

gulp.task('benchmark', ['concat', 'benchmark-old-ver'], function(next){
  gulp.src('benchmark/*.js')
    .pipe( benchmark() )
  ;
});

gulp.task('benchmark-single', ['concat', 'benchmark-old-ver'], function(next){
  gulp.src('benchmark/single/index.js')
    .pipe( benchmark() )
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

gulp.task('snapshotpush', ['docsdl'], function(){
  return gulp.src('')
    .pipe( shell( replaceShellVars([
      '$RM $TEMP_DIR/cytoscape.js',
      '$GIT clone -b gh-pages https://github.com/cytoscape/cytoscape.js.git $TEMP_DIR/cytoscape.js',
      '$CP $DOC_DIR/$DL_DIR/* $TEMP_DIR/cytoscape.js/$DL_DIR',
    ]) ) )

    .pipe( shell( replaceShellVars([
      '$GIT add -A',
      '$GIT commit -a -m "updating list of builds"',
      '$GIT push origin'
    ]), { cwd: $TEMP_DIR + '/cytoscape.js' } ) )
  ;
});




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

gulp.task('docsdemoshots', function(next){ return next(); // disable for now since phantomjs doesn't work for this usecase
  var cwd = process.cwd();

  process.chdir('./documentation');
  require('./documentation/demoshots')( function(){
    process.chdir( cwd );

    next();
  } );
});

gulp.task('docsdemodl', function(){

  var docmaker = require('./documentation/docmaker.json');

  var demos = docmaker.sections.filter(function(s){
    return s.demos != null || s.demo != null;
  }).map(function( s ){
    return s.demos || [ s.demo ];
  }).map(function( ds ){
    return ds.map(function(d){
      return 'https://gist.github.com/' + d.id + '/download';
    });
  }).reduce(function(prevDs, currDs){
    return prevDs.concat( currDs );
  }, []);

  return download( demos )
    .pipe( unzip() )

    .pipe( rename(function( path ){
      // console.log(path)

      var match = path.dirname.match(/^(.+)\-master$/);

      if( match ){
        path.dirname = match[1];
      }
    }) )

    .pipe( replace(/".*cytoscape(\.min){0,1}\.js"/, '"../../js/cytoscape.min.js"') )

    .pipe( gulp.dest('documentation/demos') )
  ;
});

gulp.task('docspub', function(next){
  runSequence( 'version', 'docsver', 'docsjs', 'docsbuildlist', 'docsdemoshots', 'docsdemodl', 'docsmin', next );
});

gulp.task('docsrebuild', function(next){
  runSequence( 'docsmin', next );
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
    'build/cytoscape.min.js',
    'build/' + paths.nodethreadName
  ])
    .pipe( gulp.dest('dist') )
  ;
});

gulp.task('pubprep', function(next){
  runSequence('pkgver', 'dist', 'docspub', 'pubpush', next);
});

gulp.task('pubpush', shell.task( replaceShellVars([
  '$GIT add -A',
  '$GIT commit -m "preparing to publish $VERSION"',
  '$GIT push'
]) ));

gulp.task('publish', ['pubprep'], function(next){
  runSequence('confver', 'tag', 'docspush', 'npm', 'spm', 'meteor', next);
});

gulp.task('tag', shell.task( replaceShellVars([
  '$GIT tag -a v$VERSION -m "v$VERSION"',
  '$GIT push origin v$VERSION'
]) ));

gulp.task('docspush', function(){
  return gulp.src('')
    .pipe( shell( replaceShellVars([
      '$RM $TEMP_DIR/cytoscape.js',
      '$GIT clone -b gh-pages https://github.com/cytoscape/cytoscape.js.git $TEMP_DIR/cytoscape.js',
      '$CP $DOC_DIR/* $TEMP_DIR/cytoscape.js',
    ]) ) )

    .pipe( shell( replaceShellVars([
      '$GIT add -A',
      '$GIT commit -a -m "updating docs to $VERSION"',
      '$GIT push origin'
    ]), { cwd: $TEMP_DIR + '/cytoscape.js' } ) )
  ;
});

gulp.task('unstabledocspush', function(){
  return gulp.src('')
    .pipe( shell( replaceShellVars([
      '$RM $TEMP_DIR/cytoscape.js',
      '$GIT clone -b gh-pages https://github.com/cytoscape/cytoscape.js.git $TEMP_DIR/cytoscape.js',
      '$CP $DOC_DIR/* $TEMP_DIR/cytoscape.js/unstable',
    ]) ) )

    .pipe( shell( replaceShellVars([
      '$GIT add -A',
      '$GIT commit -a -m "updating unstable docs to $VERSION"',
      '$GIT push origin'
    ]), { cwd: $TEMP_DIR + '/cytoscape.js' } ) )
  ;
});

// browserify debug build
gulp.task('browserify', function(){
  var b = browserify( browserifyOpts );

  return b.bundle()
    .pipe( source('cytoscape.browserify.js') )
    .pipe( buffer() )
    .pipe( derequire() )
    .pipe( gulp.dest('build') )
  ;
});

gulp.task('sniper', ['browserify'], shell.task( replaceShellVars([
  '$NPM run sniper'
]) ));

gulp.task('npm', shell.task( replaceShellVars([
  '$NPM publish .'
]) ));

gulp.task('meteor', shell.task( replaceShellVars([
  '$METEOR publish'
]) ));

gulp.task('spm', shell.task( replaceShellVars([
  '$SPM publish'
]) ));



gulp.task('watch', function(next){
  livereload.listen();

  gulp.watch('test/*.js', ['testlist'])
    .on('added deleted', function( event ){
      console.log('File ' + event.path + ' was ' + event.type + ', updating test refs in pages...');
    })
  ;

  var b = watchify( browserify( browserifyOpts ) );

  var rebuild = function(){
    return b.bundle()
      .pipe( source('cytoscape.js') )
      .pipe( buffer() )
      .pipe( derequire() )
      .pipe( gulp.dest('build') )
      .pipe( livereload() )
    ;
  };

  rebuild();

  b.on('update', rebuild);

  next();
});

// http://www.jshint.com/docs/options/
gulp.task('lint', function(){
  return gulp.src( 'src/**' )
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
