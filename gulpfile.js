var gulp = require("gulp");
var deploy = require("gulp-gh-pages");
var sass = require("gulp-sass");

/**
 * Push build to gh-pages
 */
gulp.task('deploy', function () {
  return gulp.src("./dist/**/*")
    .pipe(deploy({
        branch: "master"
    }))
});