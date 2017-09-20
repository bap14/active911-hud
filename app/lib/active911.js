"use strict";

module.exports = function (active911Settings) {
    const app = require('electron');
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
        oauth2,
        token;

    let Active911 = function () {
        // active911Settings = app.getGlobal('active911Settings');
        oauth2 = require('simple-oauth2').create(credentials);
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

    Active911.prototype.validateToken = function () {
        if (active911Settings.hasOauthToken()) {
            console.log('Oauth token found! Refreshing token');
            token = oauth2.accessToken.create(active911Settings.getOauthToken());
            token.refresh().then((result) => {
                token = result;
                active911Settings.setOauthToken(token).save();
            });
        }
        else {
            // Start auth workflow
            const authorizationUri = oauth2.authorizationCode.authorizeURL({
                response_type: "code",
                redirection_uri: 'http://localhost:3000/callback',
                scope: 'read_agency read_alert read_response read_device read_mapdata'
            });

            ipcMain.emit('oauth-authorize', authorizationUri);
        }
    };

    return new Active911();
}