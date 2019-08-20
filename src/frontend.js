// Nodejs dependencies
const path = require('path');
const { ipcRenderer } = require('electron');
// Local classes
const GamingBuddyGui = require( path.resolve(__dirname, "..", "src", "gaming-buddy", "gui.js") );

let gui = new GamingBuddyGui();

ipcRenderer.on("gui", (event, plugin, type, ...parameters) => {
    console.log(event, plugin, type, ...parameters);
    gui.handleMessage(plugin, type, parameters);
});