// Nodejs dependencies
const path = require('path');
// Local classes
const GamingBuddyApp = require( path.resolve(__dirname, "gaming-buddy", "app.js") );

// initialize core app class
let app = new GamingBuddyApp();

// send incoming messages from the main process to the app
process.on("message", (message) => {
  app.handleMessage(...message);
});