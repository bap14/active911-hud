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
    }

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
            console.log('Oauth token not found, starting authorization');
            // Start auth workflow
            const authorizationUri = oauth2.authorizationCode.authorizeURL({
                client_id: credentials.client.id,
                response_type: "code",
                redirection_uri: 'http://localhost:3000/callback',
                scope: 'read_agency,read_alert,read_response,read_device,read_mapdata'
            });

            ipcMain.emit('oauth-authorize', authorizationUri);
        }
    };

    return new Active911();
}