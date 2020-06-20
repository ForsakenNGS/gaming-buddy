// Nodejs dependencies
const nodeStatic = require('node-static');
const querystring = require('querystring');
const http = require('http');
const os = require('os');
const path = require('path');
const Twig = require('twig');
const EventEmitter = require('events');

// Local classes
const WebClient = require( path.resolve(__dirname, "webclient.js") );

class Webapp extends EventEmitter {

    constructor() {
        super();
        this.clients = {};
        this.config = {
            structure: null,
            values: {}
        };
        this.page = null;
        this.pluginActive = null;
        this.plugins = [];
        this.pluginList = [];
        this.twigNamespaces = {
            "core": path.resolve(__dirname, "..", "..", "gui")
        };
        this.server = http.createServer((request, response) => {
            this.handleRequest(request, response);
        }).listen(9990);
        this.staticData = new nodeStatic.Server( path.resolve(__dirname, "..", "..", "data") );
        this.staticNode = new nodeStatic.Server( path.resolve(__dirname, "..", "..", "node_modules") );
        this.staticWebapp = new nodeStatic.Server( path.resolve(__dirname, "..", "..", "webapp") );
        // Start with index page
        this.sendMessage("core", "ready");
    }

    /**
     * @param {IncomingMessage} request
     * @param {ServerResponse} response
     */
    handleRequest(request, response) {
        let remoteAddr = request.socket.remoteAddress;
        if (!this.clients.hasOwnProperty(remoteAddr)) {
            this.clients[remoteAddr] = new WebClient(this);
        }
        let client = this.clients[remoteAddr];
        let requestData = "";
        request.on('data', (chunk) => {
            requestData += chunk;
        });
        request.on('end', () => {
            requestData = querystring.parse(requestData);
            if (request.url.startsWith("/app/")) {
                request.url = request.url.replace("/app/", "/");
                client.handleRequest(request, requestData, response);
            } else if (request.url.startsWith("/data/")) {
                request.url = request.url.replace("/data/", "/");
                this.staticData.serve(request, response);
            } else if (request.url.startsWith("/node_modules/")) {
                request.url = request.url.replace("/node_modules/", "/");
                this.staticNode.serve(request, response);
            } else if (request.url.startsWith("/webapp/")) {
                request.url = request.url.replace("/webapp/", "/");
                this.staticWebapp.serve(request, response);
            } else {
                response.setHeader("Content-Type", "text/html");
                response.setHeader("Location", "/webapp/index.html");
                response.writeHead(301, "Moved Permanently")
                response.end();
            }
        });
    }

    /**
     * Handle message from the backend
     * @param pluginName
     * @param type
     * @param parameters
     * @returns {undefined|void}
     */
    handleMessage(pluginName, type, ...parameters) {
        if (pluginName !== "core") {
            // Handle plugin message
            let plugin = this.getPlugin(pluginName);
            if (plugin !== null) {
                return plugin.webapp.handleMessage(type, parameters);
            }
            return;
        }
        // Handle core message
        switch (type) {
            case "plugin.load":
                this.loadPlugin(...parameters);
                break;
            case "plugin.unload":
                this.unloadPlugin(...parameters);
                break;
            case "plugin.active":
                this.setPluginActive(this.getPlugin(parameters[0]));
                break;
            case "plugin.list":
                this.pluginList = parameters[0];
                if (this.page == "core::plugins") {
                    this.setPage("core::plugins", true);
                }
                break;
        }
    }

    /**
     * Handle message from the webapp
     * @param pluginName
     * @param type
     * @param parameters
     * @returns {undefined|void}
     */
    handleClientMessage(pluginName, type, ...parameters) {
        if (pluginName !== "core") {
            // Handle plugin message
            let plugin = this.getPlugin(pluginName);
            if (plugin !== null) {
                return plugin.webapp.handleMessage(type, parameters);
            }
            return;
        }
        switch (type) {
            case "page":
                this.setPage(...parameters);
                return;
        }
    }

    /**
     * Send message to the backend
     * @param plugin
     * @param type
     * @param parameters
     */
    sendMessage(plugin, type, ...parameters) {
        process.send([plugin, type, ...parameters]);
    }

    /**
     * Send message to the webapp
     * @param plugin
     * @param type
     * @param parameters
     */
    sendClientMessage(plugin, type, ...parameters) {
        for (let clientAddress in this.clients) {
            this.clients[clientAddress].handleMessage(plugin, type, ...parameters);
        }
    }

    /**
     * Renders a spcific element
     * @param {string} templateFile
     * @param {object} variables (optional)
     * @param {function} callback
     */
    renderElement(templateFile, ...parameters) {
        let variables = {};
        if (typeof parameters[0] === "object") {
            variables = parameters.shift();
        }
        let callback = parameters.shift();
        let [pluginTemplate, pluginFrontend] = this.getTwigTemplate(templateFile);
        if (pluginFrontend !== null) {
            pluginFrontend.renderElement(pluginTemplate, variables, callback, ...parameters);
        } else {
            this.emit("element.render", variables, callback);
            Twig.renderFile(pluginTemplate, this.getTwigContext({plugin: pluginFrontend}, variables), (error, html) => {
                if (error) {
                    console.error(error);
                } else {
                    callback(html);
                    this.emit("element.rendered", variables.guiElement.__dom, templateFile, variables, html);
                }
            });
        }
    }

    /**
     * Render a page template
     * @param templateFile
     * @param variables
     */
    renderPage(templateFile, variables = {}) {
        Twig.renderFile(templateFile, this.getTwigContext(variables), (error, html) => {
            if (error) {
                console.error(error);
            } else {
                this.sendClientMessage("core", "page.rendered", {
                    template: templateFile, variables: variables, html: html
                });
            }
        });
    }

    /**
     * Set the active page
     * @param page
     * @param forceSwitch
     */
    setPage(page, forceSwitch = false) {
        let pageParts = page.split("::");
        let pagePlugin = pageParts.shift();
        let pageName = pageParts.join(".");
        if (pagePlugin === "core") {
            this.page = page;
            switch (pageName) {
                case "plugin":
                    if ((this.pluginActive !== null) && (this.pluginActive.webapp.page !== null)) {
                        this.pluginActive.webapp.renderPage(this.pluginActive.webapp.page + ".twig");
                        break;
                    }
                default:
                    // Core page
                    this.renderPage(path.resolve(__dirname, "..", "..", "gui", "webapp", pageName + ".twig"));
                    break;
            }
        } else {
            // Plugin page
            let plugin = this.getPlugin(pagePlugin);
            if (plugin !== null) {
                plugin.frontend.setPage(pageName);
                if (forceSwitch) {
                    this.setPage("core::plugin");
                }
            }
        }
    }

    /**
     * @param {string} pluginName
     * @returns {PluginWebapp|null}
     */
    getPlugin(pluginName) {
        for (let i = 0; i < this.plugins.length; i++) {
            if ((this.plugins[i].name === pluginName) || (this.plugins[i].name.replace("/", "-") === pluginName)) {
                return this.plugins[i];
            }
        }
        return null
    }

    /**
     * Load a plugin from the given directory
     * @param pluginDirectory
     * @param pluginConfig
     */
    loadPlugin(pluginDirectory, pluginConfig) {
        let pluginPackage = require(path.resolve(pluginDirectory, "package.json"));
        let pluginModule = require(pluginDirectory);
        if (pluginModule.hasOwnProperty("webapp")) {
            let plugin = {
                name: pluginPackage.name,
                path: pluginDirectory,
                webapp: new pluginModule.webapp(this, pluginPackage.name, pluginDirectory, pluginConfig)
            };
            this.plugins.push(plugin);
            this.twigNamespaces[pluginPackage.name.replace("/", "-")] = path.resolve(pluginDirectory, "gui");
            // Forward render events from plugins into the gui
            plugin.webapp.on("element.render", (...parameters) => {
                this.emit("element.render", ...parameters);
            });
            plugin.webapp.on("element.rendered", (...parameters) => {
                this.emit("element.rendered", ...parameters);
            });
            // Send ready event to backend
            this.sendMessage("core", "plugin.ready", plugin.name);
        }
    }

    /**
     * Unload the given plugin
     * @param pluginName
     */
    unloadPlugin(pluginName) {
        let pluginObject = this.getPlugin(pluginName);
        if (pluginObject === null) {
            console.error("Failed to unload plugin! Plugin '"+pluginName+"' was not found.");
            return;
        }
        let pluginIndex = this.plugins.indexOf(pluginObject);
        if (pluginIndex === -1) {
            reject(new Error("Failed to unload plugin! Plugin "+pluginObject.name+" was not found."));
            return;
        }
        this.plugins.splice(pluginIndex, 1);
        pluginObject.webapp.clearAllHooks();
        delete this.twigNamespaces[pluginObject.name.replace("/", "-")];
    }

    /**
     * Set the currently active plugin
     * @param plugin
     */
    setPluginActive(plugin) {
        if (this.pluginActive !== plugin) {
            // Active plugin changed
            if (this.page === "core::plugin") {
                if ((plugin !== null) && (plugin.webapp.page !== null)) {
                    // Plugin page is selected and the plugin that became active has some active content
                    plugin.webapp.renderPage(plugin.frontend.page + ".twig");
                }
            }
            this.pluginActive = plugin;
            // Update plugin navigation
            this.sendClientMessage("core", "pages.update");
        }
    }

    /**
     * Get home directory
     * @returns {string}
     */
    getHomeDir() {
        if (os.platform() === "linux") {
            return path.join(os.homedir(), "/.config/gaming-buddy");
        } else {
            return path.join(os.homedir(), "/AppData/Roaming/gaming-buddy");
        }
    }

    /**
     * Get configuration value
     * @param {string} name
     * @returns {null|*}
     */
    getConfigValue(name) {
        if (this.config.values.hasOwnProperty(name)) {
            return this.config.values[name];
        } else {
            return null;
        }
    }

    /**
     * Get the context for rendering a template -> default variables merged with the supplied object(s)
     * @param variables
     * @returns {Object}
     */
    getTwigContext(...variables) {
        return Object.assign({gui: this, guiElement: {}, settings: this.getTwigSettings()}, ...variables);
    }

    /**
     * Get the twig settings for rendering templates
     * @returns {{"twig options": {namespaces: ({core: *}|*)}}}
     */
    getTwigSettings() {
        return {
            'twig options': {
                namespaces: this.twigNamespaces
            }
        };
    }

    /**
     * Get the absolute path to a template
     * @param {string} name
     * @returns {[string, object]}
     */
    getTwigTemplate(name) {
        let namespaceMatch = name.match(/^(.+)::(.+)$/);
        if (namespaceMatch) {
            if (namespaceMatch[1] === "core") {
                return [path.resolve(__dirname, "..", "..", "gui", namespaceMatch[2]), null];
            } else {
                let plugin = this.getPlugin(namespaceMatch[1]);
                if (plugin !== null) {
                    return [plugin.webapp.getFilePath("gui", namespaceMatch[2]), plugin.webapp];
                }
            }
        }
        return [name, null];
    }
}

module.exports = Webapp;
