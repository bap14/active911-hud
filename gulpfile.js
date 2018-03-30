var gulp = require('gulp');
var less = require('gulp-less');
var run = require('gulp-run');
var LessCleanCss = require('less-plugin-clean-css');
var cleanCss = new LessCleanCss();

gulp.task('prepare', () => {
    "use strict";

    gulp.src('app/styles/src/style.less')
        .pipe(less({
            plugins: [cleanCss]
        }))
        .pipe(gulp.dest('app/styles'));

    gulp.src([
        'bower_components/bootstrap/dist/css/bootstrap.min.css'
    ]).pipe(gulp.dest('app/styles'));

    gulp.src([
        'bower_components/jquery/dist/jquery.min.js',
        'bower_components/popper.js/dist/umd/popper.min.js',
        'bower_components/popper.js/dist/umd/popper-utils.min.js',
        'bower_components/bootstrap/dist/js/bootstrap.min.js'
    ]).pipe(gulp.dest('app/js'));

    gulp.src('build/icons/**/*').pipe(gulp.dest('app/images/icons'));
});

gulp.task('start', ['prepare'], () => {
    "use strict";

    return run('electron .', { verbosity: 3 }).exec()
        .pipe(gulp.dest('output'));
});

gulp.task('default', ['start']);