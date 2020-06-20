// Nodejs dependencies
const static = require('node-static');
const os = require('os');
const path = require('path');
const uuid = require('uuid');
const Twig = require('twig');
const EventEmitter = require('events');

const timeoutClient = 300; // 5min
const timeoutMessagePoll = 30; // 30sec
const timeoutRender = 30; // 30sec

class WebClient extends EventEmitter {

    /**
     * @param {Webapp} webapp
     */
    constructor(webapp) {
        super();
        this.webapp = webapp;
        this.lastConnection = (new Date()).getTime();
        this.messageQueue = [];
        this.messageCallback = (message) => {
            this.handleMessage(...message);
        };
        // send incoming messages from the main process to the app
        this.webapp.on("message", this.messageCallback);
    }

    unbind() {
        this.webapp.off("message", this.messageCallback);
    }

    isInactive() {
        let lastConnectionGone = (new Date()).getTime() - this.lastConnection;
        return (lastConnectionGone > timeoutClient);
    }

    /**
     * Handle message from the backend
     */
    handleMessage(...message) {
        this.messageQueue.push(message);
        this.emit("message.queued", message, this.messageQueue);
    }

    /**
     * @param {IncomingMessage} request
     * @param {ServerResponse} response
     */
    handleRequest(request, requestData, response) {
        switch (request.url) {
            case "/messageGet.json":
                if (this.messageQueue.length > 0) {
                    this.sendMessagesResponse(response);
                } else {
                    /** @var {WebClient} client **/
                    let client = this;
                    let responsePromise = new Promise(function(resolve, reject) {
                        // Wait for message
                        let messageCallback = (message, messageQueue) => {
                            client.off("message.queued", messageCallback);
                            resolve(messageQueue);
                        };
                        client.on("message.queued", messageCallback)
                        // Set timeout
                        setTimeout(function() {
                            client.off("message.queued", messageCallback);
                            resolve([]);
                        }, timeoutMessagePoll * 1000)
                    });
                    responsePromise.then((messages) => {
                        this.sendMessagesResponse(response, messages);
                    });
                }
                break;
            case "/messageSend.json":
                this.sendMessage(...requestData["parameters[]"]);
                response.setHeader("Content-Type", "application/json");
                response.writeHead(200, "OK");
                response.write(JSON.stringify({
                    "success": true
                }));
                response.end();
                break;
            case "/renderElement.json":
                let responsePromise = new Promise((resolve, reject) => {
                    // Render
                    this.webapp.renderElement(requestData["template"], JSON.parse(requestData["context"]), (html) => {
                        resolve(html);
                    });
                    // Set timeout
                    setTimeout(function() {
                        reject();
                    }, timeoutRender * 1000)
                });
                responsePromise.then((html) => {
                    response.setHeader("Content-Type", "text/html");
                    response.writeHead(200, "OK");
                    response.write(html);
                    response.end();
                }).catch(() => {
                    response.writeHead(500, "Render error");
                    response.end();
                });
                break;
            case "/status.json":
                response.setHeader("Content-Type", "application/json");
                response.writeHead(200, "OK");
                response.write(JSON.stringify({
                    "foo": "bar"
                }));
                response.end();
                break;
            default:
                response.writeHead(404, "Not found");
                response.end();
                break;
        }
    }

    /**
     * @param {ServerResponse} response
     */
    sendMessagesResponse(response, messages) {
        response.setHeader("Content-Type", "application/json");
        response.writeHead(200, "OK");
        response.write(JSON.stringify({
            "messages": messages
        }));
        response.end();
        this.messageQueue = [];
    }

    /**
     * Send message to the frontend
     * @param plugin
     * @param type
     * @param parameters
     */
    sendMessage(plugin, type, ...parameters) {
        this.webapp.handleClientMessage(plugin, type, ...parameters);
    }

    renderElement(templateFile, context) {
        let renderId = uuid.v4();
        this.webapp.renderElement(templateFile, context);
        process.send("core", "render.element", {
            id: renderId, template: templateFile, context: context
        });
        return renderId;
    }

}

module.exports = WebClient;
