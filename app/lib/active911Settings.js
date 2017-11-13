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
            fs.mkdirSync(app.getPath("userData"), 644);
        }

        this.configFilePath = app.getPath("userData") + "/" + filePath;

        if (!util.exists(this.configFilePath)) {
            fs.writeFileSync(this.configFilePath, "{}");
        }

        this.config = JSON.parse(fs.readFileSync(this.configFilePath));
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
        if (this.config && this.config.googleMapsKey) {
            return this.config.googleMapsKey;
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

    active911Settings.prototype.setOauthToken = function (token) {
        if (!this.config) {
            this.config = {};
        }
        this.config.active911auth = token;
        return this;
    };

    return new active911Settings();
}