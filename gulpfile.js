var gulp = require("gulp");
var deploy = require("gulp-gh-pages");
var sass = require("gulp-sass");
var minifyCSS = require('gulp-minify-css');
var browserSync = require('browser-sync').create();


// Static Server + watching scss/html files
gulp.task("preview", ["build"], function() {

    browserSync.init({
        server: "./dist/"
    });

    gulp.watch("./sass/**/*.scss", ["sass"]);
    gulp.watch("./dist/**/*.html").on('change', browserSync.reload);
});

// Build Sass files
gulp.task("sass", function() {
    gulp.src("./sass/style.scss")
        .pipe(sass().on('error', sass.logError))
        .pipe(minifyCSS()) // Optional minify step
        .pipe(gulp.dest('./dist/css'))
        .pipe(browserSync.stream());
});

gulp.task("copy-vendor-files", function() {
    gulp.src(['./vendor/**/*']).pipe(gulp.dest('./dist/dist'));
})

gulp.task("build", ["sass", "copy-vendor-files"]);

/**
 * Push build to gh-pages
 */
gulp.task('deploy', ["build"], function () {
    return gulp.src("./dist/**/*")
        .pipe(deploy({
            branch: "master"
        }))
});