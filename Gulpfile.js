const fs = require('fs-extra');
const gulp = require('gulp');
const ts = require('gulp-typescript');
const tslint = require('gulp-tslint');

const project = ts.createProject('tsconfig.json');

const paths = {
  dist: './dist',
  src: './src'
};

gulp.task('lint', () => {
  return gulp.src(paths.src)
    .pipe(tslint({ configuration: './.tslint.js', fix: process.argv.includes('--fix') }))
    .pipe(tslint.report());
});

gulp.task('ts', () => {
  return project.src()
    .pipe(project())
    .js.pipe(gulp.dest(project.options.outDir));
});

const commonTasks = [ clean, 'lint', 'ts' ];

function clean () {
  return fs.remove(paths.dist);
}

gulp.task('default', gulp.series(...commonTasks));
