// Nodejs dependencies
const path = require('path');
// Local classes
const GamingBuddyWebapp = require( path.resolve(__dirname, "gaming-buddy", "webapp.js") );

let webapp = new GamingBuddyWebapp();

// send incoming messages from the main process to the app
process.on("message", (message) => {
  webapp.handleMessage(...message);
});
