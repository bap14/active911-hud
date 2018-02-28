"use strict";

module.exports = function (active911Settings) {
    const util = require('util');
    const EventEmitter = require('events');
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
        this.activeAlert = null;
        this.activeAlertId = null;
        this.activeAlertTimer = null;
        this.devices = {};
    };

    util.inherits(Active911, EventEmitter);

    Active911.prototype.agency = {};
    Active911.prototype.devices = {};
    Active911.prototype.alerts = [];
    Active911.prototype.alertUpdater = false;
    Active911.prototype.deviceUpdater = false;

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
                json.device.latitude = parseFloat(json.device.latitude);
                json.device.longitude = parseFloat(json.device.longitude);

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

    Active911.prototype.getActiveAlert = function () {
        if (this.activeAlert !== null) {
            return this.alerts[this.activeAlert];
        }
        return false;
    }

    Active911.prototype.setActiveAlert = function () {
        let that = this;
        return new Promise((resolve, reject) => {
            if (that.alerts.length > 0) {
                let alert = that.alerts[0], n = 0, oldDate, newDate, response, responses = {}, isNewActiveAlert = false;

                isNewActiveAlert = (
                    (that.activeAlert === null || alert.id !== that.activeAlertId)
                    //&& (new Date().getTime()) - active911Settings.get('active911.alerts.activeAlertAge') < alert.received.getTime()
                );
                if (isNewActiveAlert) {
                    /* Test for intersection routing: */
                    // active911.activeAlert = {"id":"114859145","received":"2018-02-05T02:12:08.000Z","sent":"2018-02-05T02:12:12.000Z","priority":"2","description":"VEHICLE COLLISION","details":"00:02:30 new units: M149 E141 DTY14\n\nNARRATIVE: SAW SMALL CAR SLIDE OFF ROAD AND HIT TREES/SPUN OUT/ON BRADDOCK RI        GHT AT SKIDMORE/UNK INJ\nFIREBOXINFO: 14 01 HC04 12 HC13 10 FC17 03 MC13 13 HC03 FC15 FC25 08 FC16 BC46 09 MC17 FC33 FC09 06 FC23 MC09 BC56 FC11 FC24 05 MC35 BC18 02 04 BC03 HC05 BC31 HC08 FC02 FC13 BC02 BC19 FC50 SFM 99\nCALLER_NAME: cody parks","external_data":"","place":"","address":"BRADDOCK RD / SKIDMORE RD","unit":"","cross_street":"FLEMING RD                   SKIDMORE RD","city":"MT AIRY","state":"MD","latitude":"0.00000000","longitude":"0.00000000","source":"","units":"M149 E141","cad_code":"18002271","map_code":"1417","agency":{"id":"22844","uri":"https://access.active911.com/interface/open_api/api/agencies/22844"},"pagegroups":[{"title":"Fire: E141 E142 TT14 B145 FR14 CS14 U14","prefix":"TE"},{"title":"EMS: M149 FR14 I149 A149 U14 U14-1","prefix":"BH"}],"responses":[{"response":"watch","timestamp":"2018-02-05 02:12:11","device":{"id":"506098","uri":"https://access.active911.com/interface/open_api/api/devices/506098"}},{"response":"watch","timestamp":"2018-02-05 02:12:16","device":{"id":"419626","uri":"https://access.active911.com/interface/open_api/api/devices/419626"}},{"response":"watch","timestamp":"2018-02-05 02:12:21","device":{"id":"486462","uri":"https://access.active911.com/interface/open_api/api/devices/486462"}},{"response":"watch","timestamp":"2018-02-05 02:12:25","device":{"id":"520295","uri":"https://access.active911.com/interface/open_api/api/devices/520295"}},{"response":"watch","timestamp":"2018-02-05 02:12:34","device":{"id":"506109","uri":"https://access.active911.com/interface/open_api/api/devices/506109"}},{"response":"watch","timestamp":"2018-02-05 02:12:41","device":{"id":"412607","uri":"https://access.active911.com/interface/open_api/api/devices/412607"}},{"response":"watch","timestamp":"2018-02-05 02:12:54","device":{"id":"508602","uri":"https://access.active911.com/interface/open_api/api/devices/508602"}},{"response":"watch","timestamp":"2018-02-05 02:13:00","device":{"id":"157251","uri":"https://access.active911.com/interface/open_api/api/devices/157251"}},{"response":"watch","timestamp":"2018-02-05 02:13:09","device":{"id":"514670","uri":"https://access.active911.com/interface/open_api/api/devices/514670"}},{"response":"watch","timestamp":"2018-02-05 02:14:03","device":{"id":"508599","uri":"https://access.active911.com/interface/open_api/api/devices/508599"}},{"response":"watch","timestamp":"2018-02-05 02:15:04","device":{"id":"508605","uri":"https://access.active911.com/interface/open_api/api/devices/508605"}},{"response":"watch","timestamp":"2018-02-05 02:16:54","device":{"id":"419052","uri":"https://access.active911.com/interface/open_api/api/devices/419052"}},{"response":"watch","timestamp":"2018-02-05 02:53:02","device":{"id":"509639","uri":"https://access.active911.com/interface/open_api/api/devices/509639"}},{"response":"watch","timestamp":"2018-02-05 03:01:16","device":{"id":"419050","uri":"https://access.active911.com/interface/open_api/api/devices/419050"}}]};
                    // active911.activeAlert = {"id":"115025578","received":"2018-02-06T16:58:14.000Z","sent":"2018-02-06T16:58:16.000Z","priority":"4","description":"WIRES DOWN","details":"\nNARRATIVE: BRANCH ON FIRE ON TOP OF WIRES\nFIREBOXINFO: 14 12 HC13 HC04 HC03 13 01 BC46 10 03 BC56 BC18 09 HC08 FC17 BC31 BC19 BC41 MC13 BC03 BC40 HC05 BC02 MC17 08 HC02 BC32 06 BC85 FC16 FC15 FC25 02 04 FC09 BC04 HC09 FC33 FC11 FC24 SFM 99\nCALLER_NAME: carol","external_data":"","place":"","address":"OLD WASHINGTON RD / PINEY VIEW CT","unit":"","cross_street":"W OLD LIBERTY RD             W OBRECHT RD","city":"SYKESVILLE","state":"MD","latitude":"0.00000000","longitude":"0.00000000","source":"","units":"E141","cad_code":"18002374","map_code":"1409","agency":{"id":"22844","uri":"https://access.active911.com/interface/open_api/api/agencies/22844"},"pagegroups":[{"title":"Fire: E141 E142 TT14 B145 FR14 CS14 U14","prefix":"TE"}],"responses":[{"response":"watch","timestamp":"2018-02-06 16:58:16","device":{"id":"506098","uri":"https://access.active911.com/interface/open_api/api/devices/506098"}},{"response":"watch","timestamp":"2018-02-06 16:58:33","device":{"id":"520295","uri":"https://access.active911.com/interface/open_api/api/devices/520295"}},{"response":"watch","timestamp":"2018-02-06 16:58:36","device":{"id":"419052","uri":"https://access.active911.com/interface/open_api/api/devices/419052"}},{"response":"watch","timestamp":"2018-02-06 16:58:43","device":{"id":"412607","uri":"https://access.active911.com/interface/open_api/api/devices/412607"}},{"response":"watch","timestamp":"2018-02-06 16:58:44","device":{"id":"486462","uri":"https://access.active911.com/interface/open_api/api/devices/486462"}},{"response":"watch","timestamp":"2018-02-06 16:59:26","device":{"id":"509639","uri":"https://access.active911.com/interface/open_api/api/devices/509639"}},{"response":"watch","timestamp":"2018-02-06 17:01:18","device":{"id":"507410","uri":"https://access.active911.com/interface/open_api/api/devices/507410"}},{"response":"watch","timestamp":"2018-02-06 17:02:27","device":{"id":"419626","uri":"https://access.active911.com/interface/open_api/api/devices/419626"}},{"response":"watch","timestamp":"2018-02-06 17:16:06","device":{"id":"508602","uri":"https://access.active911.com/interface/open_api/api/devices/508602"}},{"response":"watch","timestamp":"2018-02-06 23:13:25","device":{"id":"157251","uri":"https://access.active911.com/interface/open_api/api/devices/157251"}}]};
                    /* Test for mutual aid routing */
                    // active911.activeAlert = {"id":"117032679","received":"2018-02-25T18:24:30.000Z","sent":"2018-02-25T18:24:34.000Z","priority":"3","description":"MUTUAL AID ALARM","details":"","external_data":"","place":"BOX 1741 3814 JIM SMITH LN","address":"FC","unit":"","cross_street":"","city":"Westminster","state":"MD","latitude":"39.56945080","longitude":"-76.99037800","source":"","units":"M149","cad_code":"18003525","map_code":"FC00","agency":{"id":"22844","uri":"https://access.active911.com/interface/open_api/api/agencies/22844"},"pagegroups":[{"title":"EMS: M149 FR14 I149 A149 U14 U14-1","prefix":"BH"}],"responses":[{"response":"watch","timestamp":"2018-02-25 18:24:33","device":{"id":"506098","uri":"https://access.active911.com/interface/open_api/api/devices/506098"}},{"response":"watch","timestamp":"2018-02-25 18:24:39","device":{"id":"506109","uri":"https://access.active911.com/interface/open_api/api/devices/506109"}},{"response":"watch","timestamp":"2018-02-25 18:24:39","device":{"id":"419626","uri":"https://access.active911.com/interface/open_api/api/devices/419626"}},{"response":"watch","timestamp":"2018-02-25 18:24:45","device":{"id":"509639","uri":"https://access.active911.com/interface/open_api/api/devices/509639"}},{"response":"watch","timestamp":"2018-02-25 18:24:48","device":{"id":"520295","uri":"https://access.active911.com/interface/open_api/api/devices/520295"}},{"response":"watch","timestamp":"2018-02-25 18:24:55","device":{"id":"507410","uri":"https://access.active911.com/interface/open_api/api/devices/507410"}},{"response":"watch","timestamp":"2018-02-25 18:25:10","device":{"id":"419052","uri":"https://access.active911.com/interface/open_api/api/devices/419052"}},{"response":"watch","timestamp":"2018-02-25 18:25:13","device":{"id":"486462","uri":"https://access.active911.com/interface/open_api/api/devices/486462"}},{"response":"watch","timestamp":"2018-02-25 18:25:26","device":{"id":"508563","uri":"https://access.active911.com/interface/open_api/api/devices/508563"}},{"response":"watch","timestamp":"2018-02-25 18:25:45","device":{"id":"412607","uri":"https://access.active911.com/interface/open_api/api/devices/412607"}},{"response":"watch","timestamp":"2018-02-25 18:27:46","device":{"id":"508602","uri":"https://access.active911.com/interface/open_api/api/devices/508602"}},{"response":"watch","timestamp":"2018-02-25 18:27:56","device":{"id":"514670","uri":"https://access.active911.com/interface/open_api/api/devices/514670"}},{"response":"watch","timestamp":"2018-02-25 18:58:38","device":{"id":"157251","uri":"https://access.active911.com/interface/open_api/api/devices/157251"}}]}

                    that.activeAlert = 0;
                    that.activeAlertId = alert.id;
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
                console.log(that.alerts[0].responses);

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
        this.cacheDevices()
            .then(() => {
                ipcMain.emit('active911-agency-updated');

                this.updateAlerts();

                // Get alerts every 30-seconds
                this.alertUpdater = setInterval((() => { this.updateAlerts(); }).bind(this), 30 * 1000);
                this.updateDevicesEvery(30);
                // Cache device data every 2 minutes
                this.updateDevicesEvery(2 * 60);
            })
            .catch((err) => {
                console.error(err.message, err);
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
            this.emit('active-alert-timer-stop');
            clearTimeout(this.activeAlertTimer);
            this.activeAlertTimer = null;
        }
    };

    Active911.prototype.updateAlerts = function () {
        let that = this;
        that.emit('updating-alerts-start');
        that.getAlerts()
            .then((response) => {
                let alerts = response.alerts,
                    promises = [];
                that.alerts = [];
                for (let i=0; i<alerts.length; i++) {
                    promises.push(
                        that.getAlert(alerts[i].id)
                            .then((response) => {
                                response.alert.received = new Date(response.alert.received + " UTC");
                                response.alert.sent = new Date(response.alert.sent + " UTC");

                                that.alerts.push(response.alert);
                            })
                            .catch((err) => {
                                console.error(err);
                            })
                    );
                }
                Promise.all(promises)
                    .then(() => {
                        that.alerts.sort((a, b) => {
                            if (a.received.getTime() === b.received.getTime()) return 0;
                            return (a.received.getTime() > b.received.getTime()) ? -1 : 1;
                        });
                        that.setActiveAlert()
                            .then(() => {
                                that.emit('alerts-updated');
                                ipcMain.emit('active911-alerts-updated');
                            })
                            .catch((e) => { console.error(e); });
                    })
                    .catch((e) => { console.error(e); })
                    .then(() => {
                        that.emit('updating-alerts-end');
                    });
            })
            .catch((err) => {
                console.error(err.message);
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