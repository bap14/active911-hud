"use strict";
const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const ipcMain = electron.ipcMain;
const remote = electron.remote;
const fs = require('graceful-fs');
let settingsWindow, splashScreen, hudWindow, oauthWindow, appIcon = __dirname + "/images/active911.ico";

if (require('os').platform() === "darwin") {
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

function createOauthWindow(authUri) {
    oauthWindow = new BrowserWindow({ width: 640, height: 480, parent: hudWindow, frame: false, icon: appIcon });
    oauthWindow.loadURL(authUri);
    oauthWindow.on("closed", () => oauthWindow = null);
    oauthWindow.webContents.on("did-finish-load", () => {
        console.log(oauthWindow);
        console.log(oauthWindow.webContents);
        console.log(oauthWindow.webContents.getURL());
    });
}

function createSplashScreen() {
    splashScreen = new BrowserWindow({ width: 800, height: 600, parent: hudWindow, frame: false, icon: appIcon });
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
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
app.on('ready', () => {
    createSplashScreen();
});
app.on('activate', () => {
    if (hudWindow === null) {
        createHUDWindow();
    }
});
ipcMain.on('show-settings-window', () => {
    createSettingsWindow();
});
ipcMain.on('oauth-authorize', (authUrl) => {
    createOauthWindow(authUrl);
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