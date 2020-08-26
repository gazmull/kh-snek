const fs = require('fs-extra');
const gulp = require('gulp');
const ts = require('gulp-typescript');
const eslint = require('gulp-eslint');

const project = ts.createProject('tsconfig.json');

const paths = {
  dist: './dist',
  src: './src'
};

gulp.task('lint', () => {
  return gulp.src(`${paths.src}/**/*.ts`)
    .pipe(eslint())
    .pipe(eslint.formatEach())
    .pipe(eslint.failOnError());
});

gulp.task('ts', () => {
  return project.src()
    .pipe(project())
    .js.pipe(gulp.dest(project.options.outDir));
});

const commonTasks = [ clean, 'lint', 'ts' ];

/** Removes dist directory. */
function clean () {
  return fs.remove(paths.dist);
}

gulp.task('default', gulp.series(...commonTasks));
