const path = require('path');
const static = require('node-static');
const querystring = require('querystring');
const WebClient = require( path.resolve(__dirname, "webclient.js") );

let serveTemplates = new static.Server( path.resolve(__dirname, "..", "..", "webapp") );
let serveData = new static.Server( path.resolve(__dirname, "..", "..", "data") );
let serveModules = new static.Server( path.resolve(__dirname, "..", "..", "node_modules") );

// Clients
let clients = {};

require('http').createServer(function (request, response) {
    let requestData = "";
    request.on('data', function(chunk) {
        requestData += chunk;
    });
    request.on('end', function () {
        requestData = querystring.parse(requestData);
        if (request.url.startsWith("/app/")) {
            let remoteAddr = request.socket.remoteAddress;
            if (!clients.hasOwnProperty(remoteAddr)) {
                clients[remoteAddr] = new WebClient();
            }
            let client = clients[remoteAddr];
            request.url = request.url.replace("/app/", "/");
            client.handleRequest(request, requestData, response);
        } else if (request.url.startsWith("/node_modules/")) {
            request.url = request.url.replace("/node_modules/", "/");
            serveModules.serve(request, response);
        } else if (request.url.startsWith("/webapp/")) {
            request.url = request.url.replace("/webapp/", "/");
            serveTemplates.serve(request, response);
        } else if (request.url.startsWith("/data/")) {
            request.url = request.url.replace("/data/", "/");
            serveData.serve(request, response);
        } else {
            response.setHeader("Content-Type", "text/html");
            response.setHeader("Location", "/webapp/index.html");
            response.writeHead(301, "Moved Permanently")
            response.end();
        }
    }).resume()
}).listen(9990)
