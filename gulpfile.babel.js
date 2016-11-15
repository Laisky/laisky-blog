'use strict';

import path from 'path';

import gulp from 'gulp';
import runSequence from 'run-sequence';
import es6promise from 'es6-promise';
import loadPlugin from 'gulp-load-plugins';
import gulpwebpack from 'webpack-stream';
import through from 'through2';
import webpack from 'webpack';

import config from './config.json';


es6promise.polyfill();
const $ = loadPlugin();
const autoprefixerBrowsers = [
    'ie >= 9',
    'ie_mob >= 10',
    'ff >= 30',
    'chrome >= 34',
    'safari >= 6',
    'opera >= 23',
    'ios >= 6',
    'android >= 4.4',
    'bb >= 10'
];

const notifyInfo = {
    title: 'Gulp',
    icon: path.join(__dirname, 'gulp.png')
};


const plumberErrorHandler = {
    errorHandler: $.notify.onError({
        title: notifyInfo.title,
        icon: notifyInfo.icon,
        message: "Error: <%= error.message %>"
    })
};


/**
 * 处理 js vendor
 */
gulp.task('jslibs', () => {
    return gulp.src(config.jslibs.src)
        .pipe($.plumber(plumberErrorHandler))
        .pipe($.sourcemaps.init())
            .pipe($.concat(config.jslibs.debugname))
            .pipe($.uglify())
        .pipe($.sourcemaps.write('../maps'))
        .pipe($.rename((path) => {
            if(path.extname != '.map') path.basename += '.min';
        }))
        .pipe($.rev())
        .pipe($.rename(path => {
            if(path.extname != '.map') return;
            path.basename = path.basename.replace(/\-[\d\w]+\./, '.');
        }))
        .pipe(gulp.dest(config.jslibs.dest))
        .pipe($.rev.manifest(config.jslibs.revname))
        .pipe(gulp.dest(config.jslibs.revpath));
});

/**
 * 处理 reveal.js
 * 这玩意儿神烦，引入就执行，我又懒得 webpack
 */
gulp.task('reveallibs', () => {
    return gulp.src(config.reveallibs.src)
        .pipe($.plumber(plumberErrorHandler))
        .pipe($.sourcemaps.init())
            .pipe($.concat(config.reveallibs.debugname))
            .pipe($.uglify())
        .pipe($.sourcemaps.write('../maps'))
        .pipe($.rename((path) => {
            if(path.extname != '.map') path.basename += '.min';
        }))
        .pipe($.rev())
        .pipe($.rename(path => {
            if(path.extname != '.map') return;
            path.basename = path.basename.replace(/\-[\d\w]+\./, '.');
        }))
        .pipe(gulp.dest(config.reveallibs.dest))
        .pipe($.rev.manifest(config.reveallibs.revname))
        .pipe(gulp.dest(config.reveallibs.revpath));
});


/**
 * 处理 js sites
 */
gulp.task('jssites', () => {
    return gulp.src(config.jssites.entry)
        .pipe($.plumber(plumberErrorHandler))
            .pipe(gulpwebpack({
                externals: {
                    "react": "React",
                    "react-dom": "ReactDOM",
                    "react-router": "ReactRouter",
                    "redux": "Redux",
                    "react-redux": "ReactRedux"
                },
                devtool: 'source-map',
                resolve: {
                    root: path.resolve(__dirname, '.'),
                    extensions: ['', '.js', '.jsx'],
                    modulesDirectories: ["node_modules"],
                },
                output: {
                    filename: config.jssites.debugname
                },
                plugins: [
                    // new webpack.optimize.CommonsChunkPlugin('vendor', 'reactlibs.js'),
                    // new webpack.optimize.UglifyJsPlugin({ mangle: false, compress: { warnings: false } }),
                    new webpack.NoErrorsPlugin(),
                    new webpack.DefinePlugin({
                        'process.env': {
                            NODE_ENV: JSON.stringify('production'),
                            NODE_PATH: path.resolve(__dirname, 'node_modules')
                        }
                    })
                ],
                module: {
                    loaders: [{
                        loader: 'babel-loader',
                        exclude: /node_modules/,
                        query: {
                            presets: ['es2016', 'es2015', 'react'],
                            plugins: ['transform-runtime', 'transform-async-to-generator'],
                            compact: false
                        }
                    }]
                }
            }))
            .pipe($.sourcemaps.init({loadMaps: true}))
            .pipe(through.obj(function (file, enc, cb) {
              // Dont pipe through any source map files as it will be handled
              // by gulp-sourcemaps
              var isSourceMap = /\.map$/.test(file.path);
              if (!isSourceMap) this.push(file);
              cb();
            }))
            .pipe($.uglify())
            .pipe($.rename((path) => {
                if(path.extname != '.map') path.basename += '.min';
            }))
        .pipe($.sourcemaps.write('../maps'))
        .pipe($.rev())
        .pipe($.rename(path => {
            if(path.extname != '.map') return;
            path.basename = path.basename.replace(/\-[\d\w]+\./, '.');
        }))
        .pipe(gulp.dest(config.jssites.dest))
        .pipe($.rev.manifest(config.jssites.revname))
        .pipe(gulp.dest(config.jssites.revpath));
});


/**
 * 处理 css vendor
 */
gulp.task('csslibs', () => {
    return gulp.src(config.csslibs.src)
        .pipe($.plumber(plumberErrorHandler))
        .pipe($.sourcemaps.init({loadMaps: true}))
            .pipe($.concat(config.csslibs.debugname))
            .pipe($.autoprefixer({ browsers: autoprefixerBrowsers }))
            .pipe($.cleanCss({ compatibility: 'ie8' }))
        .pipe($.sourcemaps.write('../maps'))
        .pipe($.rename((path) => {
            if(path.extname != '.map') path.basename += '.min';
        }))
        .pipe($.rev())
        .pipe($.rename(path => {
            if(path.extname != '.map') return;
            path.basename = path.basename.replace(/\-[\d\w]+\./, '.');
        }))
        .pipe(gulp.dest(config.csslibs.dest))
        .pipe($.rev.manifest(config.csslibs.revname))
        .pipe(gulp.dest(config.csslibs.revpath));
});


/**
 * 处理 css sites
 */
gulp.task('csssites', () => {
    return gulp.src(config.csssites.src)
        .pipe($.plumber(plumberErrorHandler))
        .pipe($.compass(config.csssites.compass))
            .pipe($.sourcemaps.init())
            .pipe($.concat(config.csssites.debugname))
            .pipe($.autoprefixer({ browsers: autoprefixerBrowsers }))
            .pipe($.cleanCss({ compatibility: 'ie8' }))
        .pipe($.sourcemaps.write('../maps'))
        .pipe($.rename((path) => {
            if(path.extname != '.map') path.basename += '.min';
        }))
        .pipe($.rev())
        .pipe($.rename(path => {
            if(path.extname != '.map') return;
            path.basename = path.basename.replace(/\-[\d\w]+\./, '.');
        }))
        .pipe(gulp.dest(config.csssites.dest))
        .pipe($.rev.manifest(config.csssites.revname))
        .pipe(gulp.dest(config.csssites.revpath));
});


/**
 * 处理 rev 重命名
 */
gulp.task('clean', () => {
    return gulp.src([
            './gargantua/static/dist/.assets',
            './gargantua/static/dist/css',
            './gargantua/static/dist/js',
            './gargantua/static/dist/maps',
            './gargantua/html/*'
        ], {
            read: false
        })
        .pipe($.clean());
});

gulp.task('rev', () => {
    return gulp.src(['./gargantua/static/.assets/*.json', './gargantua/templates/**/*.html'])
        .pipe($.revCollector())
        .pipe(gulp.dest('./gargantua/html/'));
});

/**
 * 默认任务
 */
gulp.task('default', () => {
    runSequence(
        'clean', ['jslibs', 'reveallibs', 'csslibs', 'csssites', 'jssites'],
        'rev'
    );
    // 监听文件变化
    $.watch('./gargantua/static/vendor/**/*.js', () => {
        runSequence('jslibs', 'rev');
    });
    $.watch('./gargantua/static/vendor/**/*.css', () => {
        runSequence('csslibs', 'rev');
    });
    $.watch('./gargantua/static/src/sass/**/*.scss', () => {
        runSequence('csssites', 'rev');
    });
    $.watch(config.jssites.watch, () => {
        runSequence('jssites', 'rev');
    });
    $.watch('./gargantua/templates/**/*.html', () => {
        runSequence('rev');
    });
});
