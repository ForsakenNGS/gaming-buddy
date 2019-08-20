const path = require('path');
const { app, ipcMain, BrowserWindow } = require('electron');
const fork = require('child_process').fork;

if (require('electron-squirrel-startup')) {
    return app.quit();
}

const Installer = require("./src/installer.js");
if (Installer.handleSquirrelEvent()) {
    // squirrel event handled and app will exit in 1000ms, so don't do anything else
    return;
}

function createWindow () {
    // Create browser window
    let win = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 600,
        frame: false,
        icon: path.join(__dirname, 'data/icon64.png'),
        webPreferences: {
            nodeIntegration: true
        }
    });
    win.setMenuBarVisibility(false);
    win.loadFile('gui/index.html');
    win.webContents.openDevTools();

    // Start backend
    let backend = fork( path.resolve("src", "backend.js") );
    let backendCallback = function(message) {
        win.webContents.send("gui", ...message);
    };

    // Bind ipc events from frontend
    ipcMain.on("gui", (event, plugin, type, ...parameters) => {
        if ((plugin === "core") && (type === "quit")) {
            // Quit application
            backend.off("message", backendCallback);
            backend.kill();
            app.quit();
            return;
        }
        // Forward event to backend
        backend.send([plugin, type, parameters]);
    });
    // Bind ipc events from backend
    backend.on("message", backendCallback);
}

app.on('ready', createWindow);