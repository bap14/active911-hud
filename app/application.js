"use strict";
var path = require('path'),
    devMode = (process.argv || []).indexOf('--dev') !== -1;
if (devMode) {
    var PATH_APP_NODE_MODULES = path.join(__dirname, '..', 'app', 'node_modules');
    require('module').globalPaths.push(PATH_APP_NODE_MODULES);
}

const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const ipcMain = electron.ipcMain;
const remote = electron.remote;
const fs = require('graceful-fs');
const os = require('os');
const oauthCredentials = {
    client: {
        id: 'activehud',
        secret: 'e518b54e3c'
    },
    auth: {
        tokenHost: 'https://access.active911.com',
        tokenPath: '/interface/open_api/token.php',
        authorizePath: '/interface/open_api/authorize_agency.php'
    }
};
const oauthScope = 'read_agency read_alert read_response read_device read_mapdata';
const oauth2 = require('simple-oauth2').create(oauthCredentials);
let settingsWindow, splashScreen, hudWindow, oauthWindow, appIcon = __dirname + "/images/active911.ico";

if (os.platform().toLowerCase() === "darwin") {
    appIcon = __dirname + "/images/active911.icns";
}

global.active911Settings = require('./lib/active911Settings.js')(app);
global.active911 = require('./lib/active911.js')(global.active911Settings);

function createHUDWindow() {
    hudWindow = new BrowserWindow({ width: 1920, height: 1080, frame: false, icon: __dirname + "/images/active911.ico" });
    hudWindow.hide();
    hudWindow.loadURL('file://' + __dirname + '/views/monitor.html');
    hudWindow.webContents.on('did-finish-load', () => {
        hudWindow.show();

        if (splashScreen) {
            // let splashScreenBounds = splashScreen.getBounds();
            // hudWindow.setBounds(splashScreenBounds);
            splashScreen.close();
        }
    });
    hudWindow.webContents.openDevTools();
    hudWindow.on('closed', () => hudWindow = null);
}

/*
function createOauthWindow(authUri) {
    oauthWindow = new BrowserWindow({ width: 755, height: 550, parent: hudWindow, frame: false, icon: appIcon });
    oauthWindow.loadURL('file://' + __dirname + '/views/oauth.html');
    oauthWindow.webContents.on('did-finish-load', ()  => {
        oauthWindow.openDevTools();
        oauthWindow.send('load-oauth-url', { url: authUri });
    });
    oauthWindow.on("closed", () => oauthWindow = null);
}
*/

function createSplashScreen() {
    splashScreen = new BrowserWindow({ width: 460, height: 226, parent: hudWindow, frame: false, icon: appIcon });
    splashScreen.loadURL("file://" + __dirname + "/views/splash.html");
    splashScreen.on('closed', () => splashScreen = null);
    splashScreen.webContents.on('did-finish-load', () => {
        splashScreen.show();
    });
}

function createSettingsWindow(errorMessage) {
    settingsWindow = new BrowserWindow({ width: 650, height: 500, parent: hudWindow, frame: false, icon: appIcon });
    settingsWindow.hide();
    settingsWindow.errorMessage = errorMessage || false
    settingsWindow.loadURL('file://' + __dirname + '/views/settings.html');
    settingsWindow.on('closed', () => settingsWindow = null);
    settingsWindow.webContents.on('did-finish-load', () => {
        settingsWindow.show();

        if (settingsWindow.errorMessage) {
            settingsWindow.send('show-login-error', settingsWindow.errorMessage);
        }

        if (splashScreen) {
            //splashScreen.hide();
        }
    });
}

app.on('window-all-closed', () => {
    app.quit();
});
app.on('ready', () => {
    createSplashScreen();
});
app.on('activate', () => {
    if (hudWindow === null) {
        createHUDWindow();
    }
});

const isExtraInstance = app.makeSingleInstance((commandLine, workingDirectory) => {
   if (hudWindow !== null) {
       if (hudWindow.isMinimized()) hudWindow.restore();
       hudWindow.focus();
   }
   console.log(commandLine);
});
if (isExtraInstance) app.quit();

app.setAsDefaultProtocolClient('active911hud');

ipcMain.on('show-settings-window', () => {
    createSettingsWindow();
});

ipcMain.on('check-oauth', () => {
    active911.validateToken();
});
ipcMain.on('oauth-authorize', (authUrl) => {
    // createOauthWindow(authUrl);
    electron.openExternal(
        oauth2.authorizationCode.authorizeURL({
            response_type: "code",
            redirection_uri: 'http://bap14.github.io/oauth',
            scope: oauthScope
        })
    );
});
ipcMain.on('oauth-error', (error) => {
    console.error(error);
});
ipcMain.on('oauth-complete', () => {
    oauthWindow.close();
    splashScreen.send('oauth-complete');
});
ipcMain.on('active911-auth-complete', () => {
    // createHUDWindow();
});
ipcMain.on('settings-saved', () => {
    if (!hudWindow || hudWindow.isHidden()) {
        settingsWindow.close();
        splashScreen.show();
        splashScreen.send('settings-saved');
    } else {
        // Reinitialize with new settings
        hudWindow.close();
        createSplashScreen();
    }
});
ipcMain.on('login-failure', (evt, message) => {
    createSettingsWindow(message);
});
ipcMain.on('console.log', (evt, message) => {
    console.log(message);
});