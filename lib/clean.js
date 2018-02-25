"use strict";

const rimraf = require('rimraf');

rimraf.sync("dist/win-unpacked/");
rimraf.sync("app/styles/fonts/");
rimraf.sync("app/styles/lib/");
rimraf.sync("app/styles/");
rimraf.sync("app/images/icons/");
rimraf.sync("app/js/lib/");