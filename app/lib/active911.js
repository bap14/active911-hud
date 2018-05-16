"use strict";

module.exports = function (active911Settings) {
    const util = require('util');
    const EventEmitter = require('events');
    const app = require('electron').app;
    const ipcMain = require('electron').ipcMain;
    const os = require('os');
    const queryString = require('querystring');
    const requestPromise = require('request-promise');
    const ko = require('knockout');

    let credentials = {
            client: {
                id: 'activehud',
                secret: 'e518b54e3c'
            },
            auth: {
                tokenHost: 'https://access.active911.com',
                tokenPath: '/interface/open_api/token.php',
                authorizePath: '/interface/open_api/authorize_agency.php'
            }
        },
        expirationWindow = 3600,
        oauthScope = 'read_agency read_alert read_response read_device read_mapdata',
        oauth2,
        token;

    let Active911 = function () {
        oauth2 = require('simple-oauth2').create(credentials);
        this.activeAlert = null;
        this.activeAlertId = null;
        this.activeAlertTimer = null;
        this.devices = {};
    };

    Active911.Device = function (config) {
        if (typeof config === "undefined") {
            config = {};
        }

        this.id = ko.observable(config.id || null);
        this.name = ko.observable(config.name || null);
        this.latitude = ko.observable(config.latitude || null);
        this.longitude = ko.observable(config.longitude || null);
        this.position_accuracy = ko.observable(config.position_accuracy || null);
        this.position_timestamp = ko.observable(config.position_timestamp || null);
    };

    util.inherits(Active911, EventEmitter);

    Active911.prototype.agency = {};
    Active911.prototype.devices = {};
    Active911.prototype.alerts = [];
    Active911.prototype.alreadyAlerted = [];
    Active911.prototype.alertUpdater = false;
    Active911.prototype.deviceUpdater = false;

    Active911.prototype.cacheAgency = function () {
        let self = this;

        return this.callApi()
            .catch((err) => {
                console.error('API Error: ' + err);
            })
            .then((json) => {
                self.agency = json.agency;
            });
    };

    Active911.prototype.cacheDevice = function (deviceId) {
        let deviceKeys = ['id', 'name', 'latitude', 'longitude', 'position_accuracy', 'position_timestamp'],
            i = 0,
            self = this;

        return this.callApi('devices/' + deviceId)
            .catch((err) => {
                console.error('API response error: ' + err);
            })
            .then((json) => {
                json.device.latitude = parseFloat(json.device.latitude);
                json.device.longitude = parseFloat(json.device.longitude);

                if (typeof self.devices[json.device.id] === "undefined") {
                    self.devices[json.device.id] = new Active911.Device(json.device);
                }

                for (i = 0; i < deviceKeys.length; i++) {
                    self.devices[json.device.id][deviceKeys[i]](json.device[deviceKeys[i]]);
                }

                return self.devices[json.device.id];
            });
    };

    Active911.prototype.cacheDevices = function () {
        let self = this;

        return this.cacheAgency()
            .catch((err) => {
                console.error('Error caching agency: ' + err);
            })
            .then(() => {
                let device;
                for (let i=0; i<self.agency.devices.length; i++) {
                    device = self.agency.devices[i];
                    self.cacheDevice(device.id)
                        .catch((err) => {
                            console.error('Error caching device: ' + err);
                        });
                }
            })
            .catch((err) => {
                console.error('Error caching devices: ' + err);
            });
    };

    Active911.prototype.callApi = function (apiPath, params) {
        let path = '/interface/open_api/api';
        if (typeof apiPath !== 'undefined') path += '/' + apiPath;
        if (typeof params !== 'undefined' && params !== '') path += '?' + queryString.stringify(params);

        return new Promise((resolve, reject) => {
            let options = {
                uri: 'https://access.active911.com' + path,
                headers: {
                    'Authorization': 'Bearer ' + active911Settings.getOauthToken().access_token,
                    'User-Agent': 'Active911-HUD / electron-' + process.versions.electron
                        + ' (' + os.type() + ' ' + os.release() + ' ' + os.arch() + ')'
                },
                followAllRedirects: true,
                json: true
            };
            requestPromise(options)
                .then((json) => {
                    if (json.result === "success") resolve(json.message);
                    else reject(json.message);
                })
                .catch((err) => {
                    reject(err.message);
                });
        });
    };

    Active911.prototype.exchangeAuthToken = function (accessToken) {
        oauth2.authorizationCode.getToken({
            grant_type: "authorization_code",
            scope: oauthScope,
            code: accessToken
        })
        .then((result) => {
            token = oauth2.accessToken.create(result);
            active911Settings.setOauthToken(token).save();

            ipcMain.emit('oauth-complete');
        })
        .catch((error) => {
            ipcMain.emit('oauth-error', [ error ]);
        });
    };

    Active911.prototype.expiringSoon = function (token) {
        let expirationTime = (new Date(token.expires_at)).getTime() / 1000;
        let now = (new Date()).getTime() / 1000;

        if (now >= (expirationTime - expirationWindow)) {
            return true;
        }
        else {
            return false;
        }
    };

    Active911.prototype.getActiveAlert = function () {
        if (this.activeAlert !== null) {
            return this.alerts[this.activeAlert];
        }
        return false;
    };

    Active911.prototype.getAgency = function () {
        return this.agency;
    };

    Active911.prototype.getAlerts = function () {
        return this.callApi('alerts', {alert_minutes: active911Settings.getAlertsTimeframe()});
    };

    Active911.prototype.getAlert = function (alertId) {
        return this.callApi('alerts/' + alertId);
    };

    Active911.prototype.getDevice = function (deviceId) {
        return this.devices[deviceId];
    };

    Active911.prototype.hasActiveAlert = function () {
        return this.activeAlert !== null;
    };

    Active911.prototype.parseURI = function (str, options) {
        let o = Object.assign({
                    strictMode: false,
                    key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path",
                            "directory","file","query","anchor"],
                    q: {
                        name:   "queryKey",
                        parser: /(?:^|&)([^&=]*)=?([^&]*)/g
                    },
                    parser: {
                        strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
                        loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
                    }
                }, options || {}),
            m = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
            uri = {},
            i = 14;

        while (i--) uri[o.key[i]] = m[i] || "";
        uri[o.q.name] = {};
        uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
            if ($1) uri[o.q.name][$1] = $2;
        });
        return uri;
    };

    Active911.prototype.refreshToken = function () {
        let token = active911Settings.getOauthToken();
        token = oauth2.accessToken.create(token);
        token.refresh().then((result) => {
            active911Settings.setOauthToken(result).save();
            ipcMain.emit('oauth-complete');
        }).catch((error) => {
            active911Settings.setOauthToken({}).save();
        });
    };

    Active911.prototype.removeAgedAlerts = function () {
        let that = this;
        return new Promise((resolve, reject) => {
            let alert, n = that.alerts.length - 1, alertAge = 0;

            for (n; n >= 0; n--) {
                alert = that.alerts[n];

                alertAge = Math.round(((new Date().getTime() - alert.received.getTime()) / 1000) / 60);

                if (alertAge >= active911Settings.get('active911.alerts.clearAfter')) {
                    that.alerts.splice(n, 1);
                }
            }

            resolve();
        });
    };

    Active911.prototype.setActiveAlert = function () {
        let that = this;
        return new Promise((resolve, reject) => {
            if (that.alerts.length > 0) {
                let alert = that.alerts[0], n = 0, oldDate, newDate, response, responses = {}, isNewActiveAlert;

                isNewActiveAlert = (
                    // If it's not the current active alert
                    (that.activeAlert === null || alert.id !== that.activeAlertId)
                    // If it's not an alert that's been shown
                    && !that.alreadyAlerted.includes(alert.id)
                    // If it's an alert within the "active" timeframe
                    && (new Date().getTime()) - (active911Settings.getActiveAlertAge()) < alert.received.getTime()
                );
                if (isNewActiveAlert) {
                    that.activeAlert = 0; // Index of alert in that.alerts array
                    that.activeAlertId = alert.id;
                    that.alreadyAlerted.push(alert.id);
                }

                /* Fix for multiple responses */
                for (n; n < alert.responses.length; n++) {
                    response = alert.responses[n];
                    if (
                        (
                            active911Settings.config.active911.showWatchers === true
                            && response.response.toLowerCase() === "watch"
                        )
                        || response.response.toLowerCase() !== "watch"
                    ) {
                        if (typeof responses[response.device.id] === "undefined") {
                            responses[response.device.id] = response;
                        } else {
                            oldDate = new Date(responses[response.device.id].timestamp);
                            newDate = new Date(response.timestamp);

                            if (newDate > oldDate) {
                                responses[response.device.id] = response;
                            }
                        }
                    }
                }
                that.alerts[0].responses = Object.values(responses);

                if (isNewActiveAlert) {
                    that.emit('new-alert');
                    that.stopActiveAlertTimer();
                    that.startActiveAlertTimer();
                }
            }
            else {
                that.activeAlert = null;
            }

            resolve();
        });
    };

    Active911.prototype.startup = function () {
        let that = this;
        this.cacheDevices()
            .then(() => {
                ipcMain.emit('active911-agency-updated');

                that.updateAlerts()
                    .catch((err) => {
                        console.error('Error updating alerts:' + err);
                    })
                    .then(() => {
                        ipcMain.emit('active911-ready');
                        // Get alerts every 30-seconds
                        that.alertUpdater = setInterval((() => {
                            this.updateAlerts();
                        }).bind(this), active911Settings.get('active911.alerts.updateInterval') * 1000);
                        // Cache device data every 2 minutes
                        that.updateDevicesEvery(2 * 60);
                    });
            })
            .catch((err) => {
                console.error('Error caching devices:' + err);
            });
    };

    Active911.prototype.startActiveAlertTimer = function () {
        let self = this;
        this.emit('active-alert-timer-start');
        this.cacheDevices();
        this.updateDevicesEvery(30);
        this.activeAlertTimer = setTimeout(
            self.stopActiveAlertTimer.bind(self),
            active911Settings.config.active911.alerts.activeAlertAge * (1000 * 60)
        );
    };

    Active911.prototype.stopActiveAlertTimer = function () {
        this.updateDevicesEvery(2 * 60);
        if (this.activeAlertTimer !== null) {
            this.activeAlert = null;
            clearTimeout(this.activeAlertTimer);
            this.activeAlertTimer = null;
            this.emit('active-alert-timer-stop');
        }
    };

    Active911.prototype.stopUpdatingAlerts = function () {
        clearInterval(this.alertUpdater);
        this.alertUpdater = null;
    };

    Active911.prototype.stopUpdatingDevices = function () {
        clearTimeout(this.deviceUpdater);
        this.deviceUpdater = null;
    };

    Active911.prototype.updateAlerts = function () {
        let that = this;
        that.emit('updating-alerts-start');
        return that.getAlerts()
            .then((response) => {
                let alerts = response.alerts,
                    promises = [];
                that.alerts = [];
                for (let i=0; i<alerts.length; i++) {
                    promises.push(
                        that.getAlert(alerts[i].id)
                            .catch((err) => {
                                throw 'Error retrieving alert: ' + err;
                            })
                            .then((response) => {
                                if (typeof response !== "undefined") {
                                    response.alert.received = new Date(response.alert.received + " UTC");
                                    response.alert.sent = new Date(response.alert.sent + " UTC");

                                    that.alerts.push(response.alert);
                                }
                            })
                            .catch((err) => {
                                throw 'Uncaught alert data error: ' + err;
                            })
                    );
                }
                Promise.all(promises)
                    .then(() => {
                        that.alerts.sort((a, b) => {
                            if (a.received.getTime() === b.received.getTime()) return 0;
                            return (a.received.getTime() > b.received.getTime()) ? -1 : 1;
                        });
                        that.removeAgedAlerts()
                            .catch((e) => { console.error('Error removing "aged" alerts: ' + e); })
                            .then(() => {
                                that.setActiveAlert()
                                    .catch((e) => { console.error('Error setting active alert: ' + e); })
                                    .then(() => {
                                        that.emit('alerts-updated');
                                        ipcMain.emit('active911-alerts-updated');
                                    });
                            });
                    })
                    .catch((e) => { console.error('Error retrieving alerts: ' + e); })
                    .then(() => {
                        that.emit('updating-alerts-end');
                    });
            })
            .catch((err) => {
                console.error(err);
            });
    };

    Active911.prototype.updateDevicesEvery = function (seconds) {
        if (typeof seconds === "undefined" || isNaN(seconds) || parseInt(seconds) < 30) {
            seconds = 30;
        } else {
            seconds = parseInt(seconds);
        }

        if (this.deviceUpdater) {
            clearInterval(this.deviceUpdater);
        }
        this.deviceUpdater = setInterval((() => { this.cacheDevices(); }).bind(this), seconds * 1000);
        return this;
    }

    Active911.prototype.validateToken = function () {
        let token = active911Settings.getOauthToken();
        if (
            token === false ||
            (
                typeof token === "object" &&
                typeof token.access_token !== "undefined" &&
                token.access_token === false
            )
        ) {
            const authorizationUri = oauth2.authorizationCode.authorizeURL({
                response_type: "code",
                redirection_uri: 'https://bap14.github.io/active911-hud/oauth.html',
                scope: oauthScope
            });

            ipcMain.emit('oauth-authorize', authorizationUri);
        }
        else if (this.expiringSoon(token)) {
            token = oauth2.accessToken.create(token);
            token.refresh().then((result) => {
                active911Settings.setOauthToken(result).save();
                ipcMain.emit('oauth-complete');
            }).catch((error) => {
                active911Settings.setOauthToken({}).save();
                this.validateToken();
            });
        }
        else {
            ipcMain.emit('oauth-complete');
        }
    };

    return new Active911();
}