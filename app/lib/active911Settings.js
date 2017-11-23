"use strict";

module.exports = function () {
    const app = require("electron").app;
    const fs = require("graceful-fs");
    const util = require("./active911Settings-utility.js");
    
    var active911Settings = function (filePath) {
        if (typeof filePath === "undefined" || !filePath) {
            filePath = "settings.json";
        }

        // Ensure userData path is available for writing
        if (!fs.existsSync(app.getPath("userData"))) {
            fs.mkdirSync(app.getPath("userData"), 0o755);
        }

        this.configFilePath = app.getPath("userData") + "/" + filePath;

        if (!util.exists(this.configFilePath)) {
            try {
                fs.writeFileSync(this.configFilePath, "{}");
            }
            catch (e) {
                console.log(e);
                throw e;
            }
        }

        let storedConfig = JSON.parse(fs.readFileSync(this.configFilePath));

        this.config = util.mergeObjects({
            active911auth: {
                token: {
                    access_token: false
                }
            },
            googleMapsApiKey: '',
            googleMaps: {
                center: {
                    lat: 38.89768,
                    lng: -77.038671
                },
                mapTypeId: 'roadmap',
                zoom: 12,
            }
        }, storedConfig);
        console.log(this.config);
    };

    active911Settings.prototype.save = function () {
        util.sync(this.configFilePath, this.config);
    };

    active911Settings.prototype.set = function (key, value) {
        util.set(this.config, key)(value);
        return this;
    };

    active911Settings.prototype.get = function (key, defaultValue) {
        const value = util.search(this.config, key);
        return value === undefined ? defaultValue : value;
    };

    active911Settings.prototype.getGoogleMapsApiKey = function () {
        if (this.config && this.config.googleMapsApiKey) {
            return this.config.googleMapsApiKey;
        }
        return false;
    };

    active911Settings.prototype.getOauthToken = function () {
        if (this.config && this.config.active911auth && this.config.active911auth.token) {
            return this.config.active911auth.token;
        }

        return false;
    };

    active911Settings.prototype.hasOauthToken = function () {
        var returnValue = false;

        if (
            this.config &&
            this.config.active911auth &&
            this.config.active911auth.token &&
            this.config.active911auth.token.access_token &&
            this.config.active911auth.token.refresh_token
        ) {
            returnValue = true;
        }

        return returnValue;
    };

    active911Settings.prototype.setGoogleMapsApiKey = function (key) {
        if (!this.config) {
            this.config = {};
        }
        this.config.googleMapsApiKey = key;
        this.save();
        return this;
    };

    active911Settings.prototype.setOauthToken = function (token) {
        if (!this.config) {
            this.config = {};
        }
        this.config.active911auth = token;
        this.save();
        return this;
    };

    return new active911Settings();
}