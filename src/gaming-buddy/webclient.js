// Nodejs dependencies
const {ipcRenderer, remote} = require('electron');
const os = require('os');
const path = require('path');
const uuid = require('uuid');
const Twig = require('twig');
const EventEmitter = require('events');

const timeoutClient = 300; // 5min
const timeoutMessagePoll = 30; // 30sec
const timeoutRender = 30; // 30sec

class WebClient extends EventEmitter {

    constructor() {
        super();
        this.lastConnection = (new Date()).getTime();
        this.messageQueue = [];
        this.messageCallback = (message) => {
            this.handleMessage(...message);
        };
        // send incoming messages from the main process to the app
        process.on("message", this.messageCallback);
    }

    unbind() {
        process.off("message", this.messageCallback);
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
        this.emit("message", message);
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
                        let messageCallback = () => {
                            client.off("message", messageCallback);
                            resolve();
                        };
                        client.on("message", messageCallback)
                        // Set timeout
                        setTimeout(function() {
                            client.off("message", messageCallback);
                            resolve();
                        }, timeoutMessagePoll * 1000)
                    });
                    responsePromise.then(() => {
                        this.sendMessagesResponse(response);
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
                let renderJobId = this.renderElement(requestData["template"], JSON.parse(requestData["context"]));
                /** @var {WebClient} client **/
                let client = this;
                let responsePromise = new Promise(function(resolve, reject) {
                    // Wait for message
                    let renderCallback = (id, html) => {
                        if (id == renderJobId) {
                            client.off("render", messageCallback);
                            resolve(html);
                        }
                    };
                    client.on("render", renderCallback)
                    // Set timeout
                    setTimeout(function() {
                        client.off("render", renderCallback);
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
    sendMessagesResponse(response) {
        response.setHeader("Content-Type", "application/json");
        response.writeHead(200, "OK");
        response.write(JSON.stringify({
            "messages": this.messageQueue
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
        process.send([plugin, type, ...parameters]);
    }

    renderElement(templateFile, context) {
        let renderId = uuid.v4();
        process.send("core", "render.element", {
            id: renderId, template: templateFile, context: context
        });
        return renderId;
    }

}

module.exports = WebClient;
