"use strict";

module.exports = function (active911Settings) {
    const app = require('electron').app;
    const ipcMain = require('electron').ipcMain;
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
    };

    Active911.prototype.callApi = function (apiPath, params, successCallback) {
        successCallback = successCallback || function () {};
        $.ajax({
            url: 'https://access.active911.com/interface/open_api/api/' + apiPath,
            type: 'GET',
            headers: {
                Authorization: 'Bearer ' + active911Settings.getOauthToken().access_token
            },
            parameters: params,
            success: successCallback
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
    },

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
            });
        }
        else {
            ipcMain.emit('oauth-complete');
        }
    };

    return new Active911();
}