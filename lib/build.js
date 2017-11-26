"use strict";

const less = require('less');
const copy = require('copy');
const copyFiles = require('copy-files');
const fs = require('fs');
const path = require('path');
const lessPluginCleanCss = require('less-plugin-clean-css');

less.render(
    fs.readFileSync('styles/style.less').toString(),
    {
        compress: true,
        plugins: [ new lessPluginCleanCss() ],
        paths: [ path.join(__dirname, '..', 'styles') ]
    },
    (e, output) => {
        if (e) throw e;
        if (!fs.existsSync('app/styles')) fs.mkdirSync('app/styles');

        fs.writeFileSync('app/styles/style.css', output.css);
    }
);

copyFiles({
    files: {
        'bootstrap.min.css': 'app/node_modules/bootstrap/dist/css/bootstrap.min.css',
        'bootstrap-theme.min.css': 'app/node_modules/bootstrap/dist/css/bootstrap-theme.min.css',
        'bootstrap-slider.min.css': 'app/node_modules/bootstrap-slider/dist/css/bootstrap-slider.min.css'
    },
    dest: 'app/styles/lib'
}, (err) => {});

copy('app/node_modules/bootstrap/dist/fonts/*', 'app/styles/fonts', () => {});

copyFiles({
    files: {
        'popper.min.js': 'app/node_modules/popper.js/dist/umd/popper.min.js',
        'popper-utils.min.js': 'app/node_modules/popper.js/dist/umd/popper-utils.min.js',
        'bootstrap.min.js': 'app/node_modules/bootstrap/dist/js/bootstrap.min.js',
        'bootstrap-slider.min.js': 'app/node_modules/bootstrap-slider/dist/bootstrap-slider.min.js',
        'knockout.js': 'app/node_modules/knockout/build/output/knockout-latest.js'
    },
    dest: 'app/js/lib'
}, (err) => {});

copy('build/icons/*', 'app/images/icons', (err) => {});