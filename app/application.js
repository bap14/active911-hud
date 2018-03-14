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
let settingsWindow,
    splashScreen,
    hudWindow,
    oauthWindow,
    iconName = "active911.ico",
    appIcon = path.join(__dirname, "images", "icons"),
    tokenRefreshInterval;

if (os.platform().toLowerCase() === "darwin") {
    iconName = "active911.icns";
}
appIcon = path.join(appIcon, iconName);

global.active911Settings = require('./lib/active911Settings.js')();
global.active911 = require('./lib/active911.js')(global.active911Settings);

function checkOAuthToken() {
    let auth = active911Settings.get('active911auth'),
        expiresAt = new Date(auth.token.expires_at),
        currentTime = new Date();

    // Attempt to refresh token within 15 minute window
    if (expiresAt - currentTime <= (15 * 60 * 1000)) {
        try {
            active911.refreshToken();
        } catch (err) {
            // Start things over again
            clearInterval(tokenRefreshInterval);
            hudWindow.close();
            createSplashScreen();
        }
    }
}

function createHUDWindow() {
    let fullScreen = false;
    if (process.argv.indexOf('--fullscreen') !== false) {
        fullScreen = true;
    }
    hudWindow = new BrowserWindow({ width: 1920, height: 1080, frame: false, show: false, icon: appIcon, fullscreen: fullScreen });
    hudWindow.hide();
    hudWindow.loadURL('file://' + __dirname + '/views/monitor.html');
    hudWindow.webContents.on('did-finish-load', () => {
        splashScreen.send('main-window-ready');
    });
    hudWindow.on('closed', () => hudWindow = null);

    checkOAuthToken();
    tokenRefreshInterval = setInterval(checkOAuthToken, 60 * 1000);
}

function createOauthWindow(authUri) {
    if (splashScreen) splashScreen.send('add-status-message', 10, 'Obtaining Active911 Authorization');

    oauthWindow = new BrowserWindow({ width: 800, height: 560, parent: hudWindow, modal: true, frame: true, icon: appIcon, show: false });
    oauthWindow.once('ready-to-show', () => {
        oauthWindow.show();
    });
    oauthWindow.loadURL(authUri);
    oauthWindow.webContents.on('did-finish-load', (evt)  => {
        oauthWindow.show();
        let loadedUrl = oauthWindow.webContents.getURL();

        if (/bap14\.github\.io\/active911-hud\/oauth\.html/.test(loadedUrl) ||
            /(www\.)?winfieldvfd\.org/.test(loadedUrl)
        ) {
            oauthWindow.hide();
            let uri = active911.parseURI(loadedUrl);

            if (splashScreen) splashScreen.send('add-status-message', 20, 'Authenticating with Active911');
            active911.exchangeAuthToken(uri.queryKey.code);
            if (!splashScreen) hudWindow.send('oauth-updated');
        }
    });
    oauthWindow.on("closed", () => {
        oauthWindow = null;
        if (!active911Settings.hasOauthToken()) {
            if (splashScreen) {
                splashScreen.send('add-status-message', undefined, 'Oauth Incomplete, exiting application');
                ipcMain.emit('exit-application');
            }
        }
        if (splashScreen) splashScreen.show();
    });
}

function createSplashScreen() {
    splashScreen = new BrowserWindow({ width: 600, height: 280, frame: false, show: false, icon: appIcon });
    splashScreen.loadURL("file://" + __dirname + "/views/splash.html");
    splashScreen.on('closed', () => splashScreen = null);
    splashScreen.webContents.on('did-finish-load', () => {
        splashScreen.show();
    });
}

function createSettingsWindow(errorMessage) {
    settingsWindow = new BrowserWindow({
        width: 400,
        height: 540,
        parent: splashScreen,
        frame: true,
        icon: appIcon,
        show: false,
        autoHideMenuBar: true,
        minimizable: false,
        maximizable: false,
        fullscreenable: false
    });
    settingsWindow.hide();
    settingsWindow.errorMessage = errorMessage || false
    settingsWindow.loadURL('file://' + __dirname + '/views/settings.html');
    settingsWindow.on('closed', () => settingsWindow = null);
    settingsWindow.webContents.on('did-finish-load', () => {
        settingsWindow.show();

        if (settingsWindow.errorMessage) {
            settingsWindow.send('show-login-error', settingsWindow.errorMessage);
        }
    });
}

const isExtraInstance = app.makeSingleInstance((commandLine, workingDirectory) => {
    if (hudWindow !== null) {
        if (hudWindow.isMinimized()) hudWindow.restore();
        hudWindow.focus();
    }
});
if (isExtraInstance) app.quit();

app.on('window-all-closed', () => {
    active911.stopActiveAlertTimer();
    active911.stopUpdatingDevices();

    if (process.platform !== 'darwin') {
        app.quit();
    }
    app.exit();
});

app.on('ready', () => {
    createSplashScreen();
});

app.on('activate', () => {
    if (hudWindow === null) {
        createHUDWindow();
    }
});

app.setAsDefaultProtocolClient('active911hud');

ipcMain.on('show-settings-window', () => {
    createSettingsWindow();
});
ipcMain.on('restart-app', () => {
    hudWindow.hide();
    createSplashScreen();
    hudWindow.close();
});

ipcMain.on('check-oauth', () => {
    active911.validateToken();
});
ipcMain.on('oauth-authorize', (authUri) => {
    createOauthWindow(authUri);
});
ipcMain.on('oauth-error', (error) => {
    console.error(error);
});
ipcMain.on('oauth-complete', () => {
    if (oauthWindow) {
        oauthWindow.close();
        oauthWindow = null;
    }

    if (splashScreen) {
        splashScreen.send('add-status-message', 80, 'Authentication Complete');

        if (!active911Settings.getGoogleMapsApiKey()) {
            createSettingsWindow();
        } else {
            ipcMain.emit('settings-saved');
        }

        // splashScreen.send('add-status-message', 100);
        //createHUDWindow();
    } else {
        hudWindow.send('oauth-update-complete');
    }
});
ipcMain.on('settings-saved', () => {
    if (!hudWindow || hudWindow.isHidden()) {
        if (settingsWindow) {
            settingsWindow.close();
        }
        splashScreen.show();
        splashScreen.send('add-status-message', 90, 'Loading monitor');
        createHUDWindow();
    } else {
        hudWindow.close();
        createSplashScreen();
    }
});
ipcMain.on('splash-complete', () => {
    if (splashScreen) {
        splashScreen.close();
    }
    hudWindow.show();
});
ipcMain.on('login-failure', (evt, message) => {
    createSettingsWindow(message);
});
ipcMain.on('console.log', (evt, message) => {
    console.log(message);
});
ipcMain.on('active911-agency-updated', () => {
    hudWindow.send('agency-updated');
});
ipcMain.on('active911-alerts-updated', () => {
    hudWindow.send('alerts-updated');
});
ipcMain.on('active911-new-alert', () => {
    hudWindow.send('new-alert');
});
ipcMain.on('exit-application', () => {
    active911.stopActiveAlertTimer();
    active911.stopUpdatingDevices();

    if (splashScreen) splashScreen.close();
    if (oauthWindow) oauthWindow.close();
    if (settingsWindow) settingsWindow.close();
    if (hudWindow) hudWindow.close();
});
ipcMain.on('launch-google', () => {
    electron.shell.openExternal('https://console.developers.google.com/apis/credentials');
});