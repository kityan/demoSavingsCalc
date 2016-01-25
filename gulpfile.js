var
	gulp = require('gulp'),
	connect = require('gulp-connect'),
	open = require('gulp-open'),
	concat = require('gulp-concat-sourcemap'),
//	clean = require('gulp-clean');
	less = require('gulp-less');
 
gulp.task('webserver', function() {
  connect.server({
    root: 'dist',
    livereload: true
  });
});


gulp.task('uri', function(){
	gulp.src(__filename)
	.pipe(open({uri: 'http://localhost:8080', app: 'chrome'}));
});

gulp.task('reload', function(){
	gulp.src(__filename).pipe(connect.reload());
});

gulp.task('copy', function(){
	gulp.src('./app/libs/**/*.*').pipe(gulp.dest('./dist/libs/'));
	gulp.src('./app/fonts/**/*.*').pipe(gulp.dest('./dist/fonts/'));
	gulp.src('./app/views/**/*.*').pipe(gulp.dest('./dist/views/'));
	gulp.src('./app/*.html').pipe(gulp.dest('./dist/'));
	gulp.src('./app/*.css').pipe(gulp.dest('./dist/'));
	gulp.src('./app/src/**/*.*').pipe(gulp.dest('./dist/app/src/'));
});


gulp.task('clean', function () {
	return gulp.src('dist', {read: false}).pipe(clean());
});

gulp.task('less', function () {
	gulp.src('./app/**/*.less')
	.pipe(less({}))
	.pipe(gulp.dest('./dist/'));
});


gulp.task('concat', function() {

  var files = [
	'./app/src/misc.js',
	'./app/src/inital.js',
	'./app/src/filters.js',
	'./app/src/routing.js',
	'./app/src/services/**/*.*',
	'./app/src/directives/**/*.*',
	'./app/src/controllers/**/*.*'
	];

  gulp.src(files)
    .pipe(concat('app.js'))
    .pipe(gulp.dest('./dist/'));
});


gulp.task('watch', function() {
	gulp.watch('app/**/*.*', ['copy', 'less', 'concat', 'reload']);
})

gulp.task('default', ['copy', 'less', 'concat', 'webserver', 'uri', 'watch']);