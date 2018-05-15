'use strict';

// Include promise polyfill for node 0.10 compatibility
require('es6-promise').polyfill();

// Include Gulp & tools we'll use
var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var htmlmin = require('gulp-htmlmin');
var del = require('del');
var runSequence = require('run-sequence');
var browserSync = require('browser-sync');
var reload = browserSync.reload;
var merge = require('merge-stream');
var path = require('path');
var fs = require('fs');
var glob = require('glob-all');
var historyApiFallback = require('connect-history-api-fallback');
var packageJson = require('./package.json');
var crypto = require('crypto');
var ensureFiles = require('./tasks/ensure-files.js');
var rev = require('gulp-rev-append');

// var ghPages = require('gulp-gh-pages');

var AUTOPREFIXER_BROWSERS = [
  'ie >= 10',
  'ie_mob >= 10',
  'ff >= 30',
  'chrome >= 34',
  'safari >= 7',
  'opera >= 23',
  'ios >= 7',
  'android >= 4.4',
  'bb >= 10'
];

var DIST = 'dist';

var dist = function(subpath) {
  return !subpath ? DIST : path.join(DIST, subpath);
};

var styleTask = function(stylesPath, srcs) {
  return gulp.src(srcs.map(function(src) {
      return path.join('app', stylesPath, src);
    }))
    .pipe($.changed(stylesPath, {
      extension: '.css'
    }))
    .pipe($.autoprefixer(AUTOPREFIXER_BROWSERS))
    .pipe(gulp.dest('.tmp/' + stylesPath))
    .pipe($.minifyCss())
    .pipe(gulp.dest(dist(stylesPath)))
    .pipe($.size({
      title: stylesPath
    }));
};

var imageOptimizeTask = function(src, dest) {
  return gulp.src(src)
    .pipe($.imagemin({
      progressive: true,
      interlaced: true
    }))
    .pipe(gulp.dest(dest))
    .pipe($.size({
      title: 'images'
    }));
};

// Compile and automatically prefix stylesheets
gulp.task('styles', function() {
  return styleTask('styles', ['**/*.css']);
});

// Ensure that we are not missing required files for the project
// "dot" files are specifically tricky due to them being hidden on
// some systems.
gulp.task('ensureFiles', function(cb) {
  var requiredFiles = ['.bowerrc'];

  ensureFiles(requiredFiles.map(function(p) {
    return path.join(__dirname, p);
  }), cb);
});

// Optimize images
gulp.task('images', function() {
  return imageOptimizeTask('app/images/**/*', dist('images'));
});

// Copy all files at the root level (app)
gulp.task('copy', function() {
  var app = gulp.src([
    'app/*',
    '!app/test',
    '!app/elements',
    '!app/bower_components',
    '!app/cache-config.json',
    '!app/licenses',
    '!**/.DS_Store'
  ], {
    dot: true
  }).pipe(gulp.dest(dist()));

  // Copy over only the bower_components we need
  // These are things which cannot be vulcanized
  // var bower = gulp.src([
    // 'app/bower_components/{webcomponentsjs,platinum-sw,sw-toolbox,promise-polyfill,things-libraries}/**/*'
  // ]).pipe(gulp.dest(dist('bower_components')));

  // Copy over only the specifically lib we need
  // These are things which cannot be vulcanized
  var licenses = gulp.src([
    'app/licenses/**/*'
  ]).pipe(gulp.dest(dist('licenses')));

  // var grid = gulp.src([
    // 'app/bower_components/things-grid-behavior/{dataludi-production.min.js,dataludi-report.min.js}'
  // ]).pipe(gulp.dest(dist('bower_components/things-grid-behavior')));

  return merge(app, licenses)
    .pipe($.size({
      title: 'copy'
    }));
});

// Copy web fonts to dist
gulp.task('fonts', function() {
  return gulp.src(['app/fonts/**'])
    .pipe(gulp.dest(dist('fonts')))
    .pipe($.size({
      title: 'fonts'
    }));
});

// Scan your HTML for assets & optimize them
gulp.task('build-app', ['images', 'fonts'], function() {
    var app = gulp.src(['app/**/*.html', '!app/{elements,test,bower_components}/**/*.html'])
              .pipe($.useref())
              .pipe($.if('*.js', $.uglify({
                preserveComments: 'all'
              })))
              .pipe($.if('*.css', $.minifyCss()))
              .pipe($.if('*.html', htmlmin({
                minifyJS: true,
                minifyCSS: true,
                removeComments: true
              })))
              .pipe(gulp.dest(dist()));

    var libs = gulp.src(['app/bower_components/things-libraries/*.html'])
              .pipe($.useref())
              .pipe($.if('*.js', $.uglify({
                preserveComments: 'all'
              })))
              .pipe($.if('*.css', $.minifyCss()))
              .pipe($.if('*.html', htmlmin({
                minifyJS: true,
                minifyCSS: true,
                removeComments: true
              })))
              .pipe(gulp.dest(dist('bower_components/things-libraries')));

  return merge(app, libs)
        .pipe($.size({
          title: 'build-app'
        }));
});

gulp.task('copy-bower', function() {
  var elements = gulp.src([
    'app/elements/**'
  ], {
    dot: true
  }).pipe(gulp.dest(dist('elements')));

  var style = gulp.src([
    'app/styles/**'
  ], {
    dot: true
  }).pipe(gulp.dest(dist('styles')));

  var bower = gulp.src([
    'app/bower_components/**'
  ], {
    dot: true
  }).pipe(gulp.dest(dist('bower_components')));

  return merge(elements, bower,style)
    .pipe($.size({
      title: 'copy-bower'
    }));
});

gulp.task('build-bower', function() {
  var bower = gulp.src([dist()+'/bower_components/**/iron-*.html', 
           dist()+'/bower_components/**/things-*.html', 
           dist()+'/bower_components/**/paper-*.html', 
           dist()+'/bower_components/**/app-*.html', 
           dist()+'/bower_components/**/gold-*.html', 
           dist()+'/bower_components/**/platinum-*.html', 
           dist()+'/bower_components/**/neon-*.html'])
    .pipe($.if('*.html', htmlmin({
      minifyJS: true,
      minifyCSS: true,
      removeComments: true
    })))
    .pipe(gulp.dest(dist('bower_components')));

  var elements = gulp.src([dist()+'/elements/**/*.html'])
    .pipe($.if('*.html', htmlmin({
      minifyJS: true,
      minifyCSS: true,
      removeComments: true
    })))
    .pipe(gulp.dest(dist('elements')));

  var styles = gulp.src([dist()+'/styles/**/*.html'])
    .pipe($.if('*.html', htmlmin({
      minifyJS: true,
      minifyCSS: true,
      removeComments: true
    })))
    .pipe(gulp.dest(dist('styles')));

  return merge(elements, bower, styles)
    .pipe($.size({
      title: 'copy-bower'
    }));
});
// Generate config data for the <sw-precache-cache> element.
// This include a list of files that should be precached, as well as a (hopefully unique) cache
// id that ensure that multiple sms-sub projects don't share the same Cache Storage.
// This task does not run by default, but if you are interested in using service worker caching
// in your project, please enable it within the 'default' task.
// See https://github.com/PolymerElements/polymer-starter-kit#enable-service-worker-support
// for more context.
gulp.task('cache-config', function(callback) {
  var dir = dist();
  var config = {
    cacheId: packageJson.name || path.basename(__dirname),
    disabled: false
  };

  glob([
    'index.html',
    'sw-import.js',
    'favicon.ico',
    './',
    'bower_components/webcomponentsjs/webcomponents-lite.min.js',
    'bower_components/things-libraries/**/*.html',
    '{scripts,images,styles,licenses,bower_components/things-grid-behavior}/**/*.*'
  ], {
    cwd: dir
  }, function(error, files) {
    if (error) {
      callback(error);
    } else {
      config.precache = files;

      var md5 = crypto.createHash('md5');
      md5.update(JSON.stringify(config.precache));
      config.precacheFingerprint = md5.digest('hex');

      var configPath = path.join(dir, 'cache-config.json');
      fs.writeFile(configPath, JSON.stringify(config), callback);
    }
  });
});

// Clean output directory
gulp.task('clean', function() {
  return del(['.tmp', dist()]);
});
// del elements
gulp.task('delete', function() {
  var bowerdel =
    del([dist('bower_components/{things-*,iron-*,paper-*,gold-*,neon-*,app-*,pouchdb*,prism*}/**'),
    '!'+dist('bower_components/things-libraries/**'),
    '!'+dist('bower_components/things-grid-behavior/**'),
    '!'+dist('bower_components/things-license-checker-min/**'),
    dist('bower_components/{threejs,TinyColor,test-fixture,bwip-js,chart.js,intl-messageformat,async}/**'),
    dist('bower_components/**/{locale*,dev*,example*,demo*,*test*,doc*,st,html,src}/**')],{force:true});

  var elementdel =
    del([dist('elements/{things-*}/**')],{force:true});
});

// version elements
gulp.task('version', function() {
  var indexes = gulp.src([
    dist()+'/index.html',
    dist()+'/index_oi.html',
    dist()+'/previewer.html'
  ])
  .pipe(rev())
  .pipe(gulp.dest(dist()));
});

// Vulcanize granular configuration
gulp.task('vulcanize', function() {
  return gulp.src(dist()+'/elements/elements.html')
    .pipe($.vulcanize({
      excludes:[
        dist()+'/bower_components/things-libraries/things-libraries.html',
        dist()+'/bower_components/things-libraries/things-enc-lib.html',
        dist()+'/bower_components/things-libraries/things-c3-lib.html',
        dist()+'/bower_components/things-libraries/things-d3-lib.html',
        dist()+'/bower_components/things-libraries/things-jquery-lib.html',
        dist()+'/bower_components/things-libraries/things-jsxlsx-lib.html',
        dist()+'/bower_components/things-libraries/things-jszip-lib.html',
        dist()+'/bower_components/things-libraries/things-momentjs-lib.html',
        dist()+'/bower_components/things-libraries/things-numeraljs-lib.html',
        dist()+'/bower_components/things-libraries/things-sockjs-lib.html',
        dist()+'/bower_components/things-libraries/things-sweetalert-lib.html',
        dist()+'/bower_components/things-libraries/things-fullcalendar-lib.html'
      ],
      stripComments: true,
      inlineCss: true,
      inlineScripts: true
    }))
    .on('error', function(e) { console.log('vulc',e); })
    .pipe(htmlmin({
      minifyJS: true,
      minifyCSS: true,
      removeComments: true
    }))
    .on('error', function(e) { console.log('minify',e); })
    .pipe(gulp.dest(dist('elements')))
    .on('error', function(e) { console.log('save',e); })
    .pipe($.size({
      title: 'vulcanize'
    }))
    .on('error', function(e) { console.log('final',e); });
});

// Vulcanize OI configuration
gulp.task('vulcanizeoi', function() {
  return gulp.src(dist()+'/elements/oi-bundle.html')
    .pipe($.vulcanize({
      excludes:[
        dist()+'/bower_components/things-libraries/things-libraries.html',
        dist()+'/bower_components/things-libraries/things-enc-lib.html',
        dist()+'/bower_components/things-libraries/things-c3-lib.html',
        dist()+'/bower_components/things-libraries/things-d3-lib.html',
        dist()+'/bower_components/things-libraries/things-jquery-lib.html',
        dist()+'/bower_components/things-libraries/things-jsxlsx-lib.html',
        dist()+'/bower_components/things-libraries/things-jszip-lib.html',
        dist()+'/bower_components/things-libraries/things-momentjs-lib.html',
        dist()+'/bower_components/things-libraries/things-numeraljs-lib.html',
        dist()+'/bower_components/things-libraries/things-sockjs-lib.html',
        dist()+'/bower_components/things-libraries/things-sweetalert-lib.html',
        dist()+'/bower_components/things-libraries/things-fullcalendar-lib.html'
      ],
      stripComments: true,
      inlineCss: true,
      inlineScripts: true
    }))
    .on('error', function(e) { console.log('vulc',e); })
    .pipe(htmlmin({
      minifyJS: true,
      minifyCSS: true,
      removeComments: true
    }))
    .on('error', function(e) { console.log('minify',e); })
    .pipe(gulp.dest(dist('elements')))
    .on('error', function(e) { console.log('save',e); })
    .pipe($.size({
      title: 'vulcanize oi'
    }))
    .on('error', function(e) { console.log('final',e); });
});

// Watch files for changes & reload
gulp.task('serve', ['styles'], function() {
  browserSync({
    port: 4000,
    notify: false,
    logPrefix: 'PSK',
    host: 'xmes.hatiolab.com',
    // open:'external',
    snippetOptions: {
      rule: {
        match: '<span id="browser-sync-binding"></span>',
        fn: function(snippet) {
          return snippet;
        }
      }
    },
    // Run as an https by uncommenting 'https: true'
    // Note: this uses an unsigned certificate which on first access
    //       will present a certificate warning in the browser.
    // https: true,
    server: {
      baseDir: ['.tmp', 'app'],
      middleware: [historyApiFallback()]
    }
  });

  gulp.watch(['app/**/*.html', '!app/bower_components/**/*.html'], reload);
  gulp.watch(['app/styles/**/*.css'], ['styles', reload]);
  gulp.watch(['app/scripts/**/*.js'], reload);
  gulp.watch(['app/images/**/*'], reload);
});

// Build and serve the output from the dist build
gulp.task('serve:dist', ['default'], function() {
  browserSync({
    port: 4002,
    notify: false,
    logPrefix: 'PSK',
    host: 'xmes.hatiolab.com',
    // open:'external',
    snippetOptions: {
      rule: {
        match: '<span id="browser-sync-binding"></span>',
        fn: function(snippet) {
          return snippet;
        }
      }
    },
    // Run as an https by uncommenting 'https: true'
    // Note: this uses an unsigned certificate which on first access
    //       will present a certificate warning in the browser.
    // https: true,
    server: dist(),
    middleware: [historyApiFallback()]
  });
});

// Build and serve the output from the dist build
gulp.task('serve:suite', ['suiteBuild'], function() {
  browserSync({
    port: 4002,
    notify: false,
    logPrefix: 'PSK',
    host: 'xmes.hatiolab.com',
    // open:'external',
    snippetOptions: {
      rule: {
        match: '<span id="browser-sync-binding"></span>',
        fn: function(snippet) {
          return snippet;
        }
      }
    },
    // Run as an https by uncommenting 'https: true'
    // Note: this uses an unsigned certificate which on first access
    //       will present a certificate warning in the browser.
    // https: true,
    server: dist(),
    middleware: [historyApiFallback()]
  });
});

// Build production files, the default task
gulp.task('default', ['clean'], function(cb) {
  runSequence(
    ['ensureFiles', 'copy', 'styles'],
    'build-app',
    'copy-bower',
    'build-bower',
    'vulcanize',
    'vulcanizeoi',
    'delete',
    'cache-config',
    'version',
    cb);
});

// Build production files, the default task
gulp.task('suiteBuild', ['clean'], function(cb) {
  DIST = '../things-suite-built/factory';
  runSequence(
    ['ensureFiles', 'copy', 'styles'],
    'build-app','copy-bower',
    'build-bower',
    'vulcanize',
    'vulcanizeoi',
    'delete',
    'cache-config',
    'version',
    cb);
});
