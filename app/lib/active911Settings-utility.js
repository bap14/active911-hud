/**
 * Copied from https://github.com/de-luca/electron-json-config
 */
'use strict';

const fs = require('graceful-fs');

exports.exists = function(file) {
    try {
        fs.statSync(file);
        return true;
    } catch (err) {
        if (err.code === 'ENOENT') {
            return false;
        }
    }
};

exports.sync = function(file, object) {
    fs.writeFileSync(file, JSON.stringify(object));
};

exports.search = function(object, key) {
    let path = key.split('.');
    for(let i = 0; i < path.length; i++) {
        if(object[path[i]] === undefined) {
            return undefined;
        }
        object = object[path[i]];
    }
    return object;
};

exports.set = function(object, key) {
    let path = key.split('.');
    for(var i = 0; i < path.length - 1; ++i) {
        if(!object[path[i]]) {
            object[path[i]] = {};
        }
        object = object[path[i]];
    }
    return function(object, attribute) {
        return function(value) { object[attribute] = value; };
    } (object, path[i]);
};

exports.remove = function(object, key) {
    let path = key.split('.');
    for(var i = 0; i < path.length - 1; ++i) {
        if(!object[path[i]]) {
            object[path[i]] = {};
        }
        object = object[path[i]];
    }
    return function(object, attribute) {
        return function() { delete object[attribute]; };
    } (object, path[i]);
};

exports.mergeObjects = function () {
    let target = arguments[0];

    for (let i = 1; i<arguments.length; i++) {
        let source = arguments[i];

        for (let prop in source) {
            if (source.hasOwnProperty(prop)) {
                if (typeof source[prop] === 'object') {
                    target[prop] = exports.mergeObjects(target.hasOwnProperty(prop) ? target[prop] : {}, source[prop]);
                }
                else {
                    target[prop] = source[prop];
                }
            }
        }
    }

    return target;
}