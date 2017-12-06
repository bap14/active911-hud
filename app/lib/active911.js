"use strict";

module.exports = function (active911Settings) {
    const app = require('electron').app;
    const ipcMain = require('electron').ipcMain;
    const os = require('os');
    const queryString = require('querystring');
    const requestPromise = require('request-promise');

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
        this.devices = {};
    };

    Active911.prototype.agency = {};
    Active911.prototype.devices = {};
    Active911.prototype.alerts = [];

    Active911.prototype.cacheAgency = function () {
        let self = this;

        return this.callApi()
            .then((json) => {
                self.agency = json.agency;
            });
    };

    Active911.prototype.cacheDevice = function (deviceId) {
        let self = this;

        return this.callApi('devices/' + deviceId)
            .then((json) => {
                self.devices[json.device.id] = json.device;
            });
    };

    Active911.prototype.cacheDevices = function () {
        let self = this;

        return this.cacheAgency()
            .then(() => {
                let device;
                for (let i=0; i<self.agency.devices.length; i++) {
                    device = self.agency.devices[i];
                    self.cacheDevice(device.id)
                        .catch((err) => {
                            console.error(err);
                        });
                }
            })
            .catch((err) => {
                console.error(err);
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

    Active911.prototype.startup = function () {
        var that = this;

        this.cacheDevices()
            .then(() => {
                ipcMain.emit('active911-agency-updated');
            })
            .catch((err) => {
                console.error(err.message, err);
            });

        this.getAlerts()
            .then((response) => {
                let alerts = response.alerts;
                that.alerts = [];
                for (let i=0; i<alerts.length; i++) {
                    that.getAlert(alerts[i].id)
                        .then((response) => {
                            that.alerts.push(response.alert);
                        })
                        .then(() => {
                            ipcMain.emit('active911-alerts-updated');
                        })
                        .catch((err) => {
                            console.error(err.message, err);
                        });
                }
            })
            .catch((err) => {
                console.error(err.message, err);
            });

        setTimeout((() => { this.getAlerts(); }).bind(this), 60 * 1000);
        setTimeout((() => { this.cacheDevices(); }).bind(this), 5 * 60 * 1000);
    };

    Active911.prototype.validateToken = function () {
        let token = active911Settings.getOauthToken();
        if (token === false) {
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