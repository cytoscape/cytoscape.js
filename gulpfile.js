'use strict';

var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var fs = require('fs');
var exec = require('child_process').exec;
var runSequence = require('run-sequence');
var del = require('del');
var vinylPaths = require('vinyl-paths');
var clean = function(){ return vinylPaths(del); };
var buffer = require('vinyl-buffer');
var notifier = require('node-notifier');
var watchify = require('watchify');
var browserify = require('browserify');
var source = require('vinyl-source-stream'); // converts node streams into vinyl streams
var assign = function( a, b ){
  if( b ){ for( var i in b ){ a[i] = b[i]; } }
  return a;
};

var benchmarkVersion = '2.5.3'; // old version to test against for benchmarks
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

  preamble: 'src/-preamble.js',

  nodethreadName: 'thread-node-fork.js',
  nodethreadSrc: [
    'src/-preamble.js',
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
  entries: [ paths.sourceEntry ],
  debug: true,
  builtins: [],
  bundleExternal: false,
  detectGlobals: false,
  standalone: 'cytoscape',
  cache: {}, // for watchify
  packageCache: {} // for watchify
};

var logError = function( err ){
  notifier.notify({ title: 'Cytoscape.js', message: 'Error: ' + err.message });
  $.util.log( $.util.colors.red('Error in build:'), $.util.colors.red(err) );
};

// update these if you don't have a unix like env or these programmes aren't in your $PATH
var $TEMP_DIR = '/tmp';
var replaceShellVars = function( cmds ){
  return cmds.map(function( cmd ){
    return cmd
      //.replace(/\$VERSION/g, version)
      .replace(/\$GIT/g, 'git')
      .replace(/\$RM/g, 'rm -rf')
      .replace(/\$CP/g, 'cp -R')
      .replace(/\$TEMP_DIR/g, $TEMP_DIR)
      .replace(/\$DOC_DIR/g, 'documentation')
      .replace(/\$DL_DIR/g, 'download')
      .replace(/\$NPM/g, 'npm')
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

    fs.writeFileSync('./src/version.json', '"'+ version +'"');

    next();
  }

});

gulp.task('confver', ['version'], function(){
  return gulp.src('.')
    .pipe( $.prompt.confirm({ message: 'Are you sure version `' + version + '` is OK to publish?' }) )
  ;
});

gulp.task('clean', function(){
  return gulp.src(['build'])
    .pipe( clean({ read: false }) )
  ;
});

gulp.task('format', $.shell.task([
  './node_modules/jscs/bin/jscs src/** --fix'
]));

var getBrowserify = function( opts ){
  opts = assign({
    file: 'cytoscape.js',
    sourceMaps: false,
    minify: false,
    handleErrors: true,
    bundle: true
  }, opts);

  var b = opts.stream || browserify( browserifyOpts );

  if( opts.bundle ){
    b = b.bundle();
  }

  if( opts.handleErrors ){
    b = b.on( 'error', logError );
  }

  var pipe = function( fn ){
    b = b.pipe( fn );
  };

  if( opts.file ){
    pipe( source( opts.file ) );
    pipe( buffer() );
  }

  //if( opts.sourceMaps ){
    pipe( $.sourcemaps.init({ loadMaps: true }) );
  //}

  pipe( $.derequire() );
  pipe( $.replace('{{VERSION}}', version) );

  if( opts.minify ){
    pipe( $.uglify({ mangle: true, preserveComments: 'license' }) );
  }

  if( opts.sourceMaps === true ){
    pipe( $.sourcemaps.write() );
  } else if( opts.sourceMaps ){
    pipe( $.sourcemaps.write( opts.sourceMaps ) );
  }

  return b;
};

gulp.task('concat', ['version', 'nodeworker'], function(){
  return getBrowserify({
    sourceMaps: true
  })
    .pipe( gulp.dest('build') )
  ;
});

gulp.task('build-unmin', ['version', 'nodeworker'], function(){
  return getBrowserify()
    .pipe( gulp.dest('build') )
  ;
});

gulp.task('build-min', ['version', 'nodeworker'], function(){
  return getBrowserify({
    file: 'cytoscape.min.js',
    preamble: true,
    minify: true
  })
    .pipe( gulp.dest('build') )
  ;
});

gulp.task('build', ['build-unmin', 'build-min'], function( next ){
  next();
});

gulp.task('nodeworker', ['version'], function(){
  return gulp.src( paths.nodethreadSrc )
    .pipe( $.concat(paths.nodethreadName) )

    .pipe( $.replace('{{VERSION}}', version) )

    .pipe( gulp.dest('build') )
  ;
});

gulp.task('debugrefs', function(){
  return gulp.src('debug/index.html')
    .pipe( $.inject( gulp.src(paths.debugFiles, { read: false }), {
      addPrefix: '..',
      addRootSlash: false
    } ) )

    .pipe( gulp.dest('debug') )
  ;
});

gulp.task('testrefs', function(){
  return gulp.src('test/index.html')
    .pipe( $.inject( gulp.src(paths.testFiles, { read: false }), {
      addPrefix: '..',
      addRootSlash: false
    } ) )

    .pipe( gulp.dest('test') )
  ;
});

gulp.task('testlist', function(){
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
  runSequence( 'debugrefs', 'testrefs', 'testlist', next );
});

gulp.task('zip', ['version', 'build'], function(){
  return gulp.src([
    'build/cytoscape.js',
    'build/cytoscape.js.map',
    'build/cytoscape.min.js',
    'build/cytoscape.min.js.map',
    'LICENSE',
    'lib/*.js'
  ])
    .pipe( $.zip('cytoscape.js-' + version + '.zip') )

    .pipe( gulp.dest('build') )
  ;
});

gulp.task('test', function(next){
  return gulp.src('test/*.js')
    .pipe( $.mocha({
      reporter: 'spec'
    }) )
  ;
});

gulp.task('test-browserify', ['concat'], function(next){
  return gulp.src('test/browserify/*.js')
    .pipe( $.mocha({
      reporter: 'spec'
    }) )
  ;
});

gulp.task('weaver-src', function(){

  return $.download( weaverSrc )
    .pipe( $.replace('weaver', 'cytoscape') )
    .pipe( gulp.dest('src') )
  ;

});

gulp.task('weaver-test', function(){

  return $.download( weaverTest )
    .pipe( $.replace('weaver', 'cytoscape') )
    .pipe( gulp.dest('test') )
  ;

});

gulp.task('weaver-test-reqs', function(){

  return $.download( weaverTestReqs )
    .pipe( gulp.dest('test/requires') )
  ;

});

gulp.task('weaver', function(next){
  return runSequence(['weaver-src', 'weaver-test', 'weaver-test-reqs'], next);
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

gulp.task('docsver', ['version'], function(){
  return gulp.src('documentation/docmaker.json')
    .pipe( $.replace(/\"version\"\:\s*\".*?\"/, '"version": "' + version + '"') )

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

gulp.task('snapshotpush', ['docsdl'], function(){
  return gulp.src('')
    .pipe( $.shell( replaceShellVars([
      '$RM $TEMP_DIR/cytoscape.js',
      '$GIT clone -b gh-pages https://github.com/cytoscape/cytoscape.js.git $TEMP_DIR/cytoscape.js',
      '$CP $DOC_DIR/$DL_DIR/* $TEMP_DIR/cytoscape.js/$DL_DIR',
    ]) ) )

    .pipe( $.shell( replaceShellVars([
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
    .pipe( $.htmlmin({
      collapseWhitespace: true,
      keepClosingSlash: true
    }) )

    .pipe( gulp.dest('documentation') )
  ;
});

gulp.task('docsjsmin', function(){
  return gulp.src( paths.docs.js )
    .pipe( $.concat('all.min.js') )

    .pipe( $.uglify({
      mangle: true
    }) )

    .pipe( gulp.dest('documentation/js') )
  ;
});

gulp.task('docscssmin', function(){
  return gulp.src( paths.docs.css )
    .pipe( $.concat('all.min.css') )

    .pipe( $.cssmin() )

    .pipe( gulp.dest('documentation/css') )
  ;
});

gulp.task('docsminrefs', ['docscssmin', 'docsjsmin'], function(){
  return gulp.src('documentation/index.html')
    .pipe( $.inject( gulp.src([ 'documentation/js/all.min.js', 'documentation/css/all.min.css' ] ), {
      addRootSlash: false,
      ignorePath: 'documentation'
    } ) )

    .pipe( gulp.dest('documentation') )
  ;
});

gulp.task('docsrefs', function(){
  return gulp.src([ 'documentation/index.html', 'documentation/template.html' ])
    .pipe( $.inject( gulp.src(paths.docs.js.$.concat( paths.docs.css ), { read: false }), {
      addRootSlash: false,
      ignorePath: 'documentation'
    } ) )

    .pipe( gulp.dest('documentation') )
  ;
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

  return $.download( demos )
    .pipe( $.unzip() )

    .pipe( $.rename(function( path ){
      // console.log(path)

      var match = path.dirname.match(/^(.+)\-master$/);

      if( match ){
        path.dirname = match[1];
      }
    }) )

    .pipe( $.replace(/".*cytoscape(\.min){0,1}\.js"/, '"../../js/cytoscape.min.js"') )

    .pipe( gulp.dest('documentation/demos') )
  ;
});

gulp.task('docspub', function(next){
  runSequence( 'version', 'docsdl', 'docsver', 'docsjs', 'docsdemodl', 'docsmin', next );
});

gulp.task('docsrebuild', function(next){
  runSequence( 'docsmin', next );
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
    'build/cytoscape.js.map',
    'build/cytoscape.min.js',
    'build/cytoscape.min.js.map',
    'build/' + paths.nodethreadName
  ])
    .pipe( gulp.dest('dist') )
  ;
});

gulp.task('pubprep', function(next){
  runSequence('pkgver', 'dist', 'docspub', 'pubpush', next);
});

gulp.task('pubpush', $.shell.task( replaceShellVars([
  '$GIT add -A',
  '$GIT commit -m "preparing to publish $VERSION"',
  '$GIT push'
]) ));

gulp.task('publish', function(next){
  runSequence('confver', 'pubprep', 'tag', 'docspush', 'npm', next);
});

gulp.task('tag', $.shell.task( replaceShellVars([
  '$GIT tag -a v$VERSION -m "v$VERSION"',
  '$GIT push origin v$VERSION'
]) ));

gulp.task('docspush', function(){
  return gulp.src('')
    .pipe( $.shell( replaceShellVars([
      '$RM $TEMP_DIR/cytoscape.js',
      '$GIT clone -b gh-pages https://github.com/cytoscape/cytoscape.js.git $TEMP_DIR/cytoscape.js',
      '$CP $DOC_DIR/* $TEMP_DIR/cytoscape.js',
    ]) ) )

    .pipe( $.shell( replaceShellVars([
      '$GIT add -A',
      '$GIT commit -a -m "updating docs to $VERSION"',
      '$GIT push origin'
    ]), { cwd: $TEMP_DIR + '/cytoscape.js' } ) )
  ;
});

gulp.task('unstabledocspush', function(){
  return gulp.src('')
    .pipe( $.shell( replaceShellVars([
      '$RM $TEMP_DIR/cytoscape.js',
      '$GIT clone -b gh-pages https://github.com/cytoscape/cytoscape.js.git $TEMP_DIR/cytoscape.js',
      '$CP $DOC_DIR/* $TEMP_DIR/cytoscape.js/unstable',
    ]) ) )

    .pipe( $.shell( replaceShellVars([
      '$GIT add -A',
      '$GIT commit -a -m "updating unstable docs to $VERSION"',
      '$GIT push origin'
    ]), { cwd: $TEMP_DIR + '/cytoscape.js' } ) )
  ;
});

gulp.task('sniper', ['build-min'], $.shell.task( replaceShellVars([
  '$NPM run sniper'
]) ));

gulp.task('npm', $.shell.task( replaceShellVars([
  '$NPM publish .'
]) ));


gulp.task('watch', function(next){
  $.livereload.listen();

  gulp.watch('test/*.js', ['testlist'])
    .on('added deleted', function( event ){
      console.log('File ' + event.path + ' was ' + event.type + ', updating test refs in pages...');
    })
  ;

  var b = watchify( browserify( browserifyOpts ), { poll: true } );

  var rebuild = function(){
    getBrowserify({
      stream: b,
      sourceMaps: true
    })
      .pipe( gulp.dest('build') )
      .pipe( $.livereload() )
    ;
  };

  rebuild();

  b.on('update', rebuild);

  next();
});

// http://www.jshint.com/docs/options/
gulp.task('lint', function(){
  return gulp.src( 'src/**.js' )
    .pipe( $.jshint( JSON.parse( fs.readFileSync('./.jshintrc', 'utf8') ) ) )

    .pipe( $.jshint.reporter( require('jshint-stylish') ) )
  ;
});
