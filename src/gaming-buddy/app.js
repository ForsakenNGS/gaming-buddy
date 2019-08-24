// Nodejs dependencies
const os = require('os');
const fs = require('fs');
const path = require('path');
const npm = require('npm');
const libnpmsearch = require('libnpmsearch');
const pacote = require('pacote');
const rimraf = require('rimraf');
const Jimp = require('jimp');
const EventEmitter = require('events');
const ScreenshotCapture = require('@forsaken87/screenshot-capture');

// Local classes
const Config = require('./config.js');

class App extends EventEmitter {

    constructor() {
        super();
        this.debugEnabled = true;
        this.config = new Config("core", path.resolve(__dirname, "..", ".."));
        this.pluginActive = null;
        this.plugins = [];
        this.screens = null;
        this.updateTimer = null;
        this.windowActive = null;
        this.windows = {
            list: [],
            updated: 0
        };
        // Ensure local plugin dir exists
        let pluginDir = path.join(this.getHomeDir(), "plugins");
        if (!fs.existsSync(pluginDir)) {
            fs.mkdirSync(pluginDir, {recursive: true});
        }
    }

    /**
     * Handle message from the frontend
     * @param pluginName
     * @param type
     * @param parameters
     * @returns {undefined|void}
     */
    handleMessage(pluginName, type, parameters) {
        if (pluginName !== "core") {
            // Handle plugin message
            let plugin = this.getPlugin(pluginName);
            if (plugin !== null) {
                switch (type) {
                    case "config":
                        return plugin.backend.setConfigValues(...parameters);
                    default:
                        return plugin.backend.handleMessage(type, parameters);
                }
            }
            return;
        }
        // Handle core message
        switch (type) {
            case "config":
                this.setConfigValues(...parameters);
                break;
            case "ready":
                this.sendMessage("core", "config", this.config);
                this.loadPluginDirectory(path.resolve(this.getHomeDir(), "plugins")).then(() => {
                    return this.listPlugins();
                }).then((pluginList) => {
                    this.sendMessage("core", "plugin.list", pluginList);
                    this.sendMessage("core", "ready");
                    this.updateStart();
                });
                break;
            case "plugin.ready":
                let plugin = this.getPlugin(parameters[0]);
                if (plugin !== null) {
                    plugin.backend.emit("ready");
                }
                break;
            case "plugin.install":
                this.installPlugin(...parameters).then((pluginObject) => {
                    // Update plugin list after installing
                    return this.listPlugins();
                }).then((pluginList) => {
                    this.sendMessage("core", "plugin.list", pluginList);
                });
                break;
            case "plugin.uninstall":
                this.uninstallPlugin(...parameters).then(() => {
                    // Update plugin list after uninstalling
                    return this.listPlugins();
                }).then((pluginList) => {
                    this.sendMessage("core", "plugin.list", pluginList);
                });
                break;
        }
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

    /**
     * Check if the given directory contains a vaild plugin
     * @param directory
     * @returns {boolean}
     */
    containsPlugin(directory) {
        let pluginLstat = fs.lstatSync(directory);
        if (!pluginLstat.isDirectory() && !pluginLstat.isSymbolicLink()) {
            return false;
        }
        let pluginPackage = path.join(directory, "package.json");
        if (!fs.existsSync(pluginPackage)) {
            return false;
        }
        let pluginModule = require(directory);
        if (!pluginModule.hasOwnProperty("frontend") || !pluginModule.hasOwnProperty("backend")) {
            return false;
        }
        return true;
    }

    /**
     * @param {string} pluginName
     * @returns {object|null}
     */
    getPlugin(pluginName) {
        for (let i = 0; i < this.plugins.length; i++) {
            if (this.plugins[i].name === pluginName) {
                return this.plugins[i];
            }
        }
        return null
    }

    /**
     * Load all plugins from the given directory
     * @param directory
     * @returns {Promise<boolean>}
     */
    loadPluginDirectory(directory) {
        return new Promise((resolve, reject) => {
            try {
                console.log("Loading plugins from " + directory + "...");
                let files = fs.readdirSync(directory);
                let pluginPromises = [];
                files.forEach((plugin) => {
                    let pluginAbsolute = path.join(directory, plugin);
                    if (this.containsPlugin(pluginAbsolute)) {
                        pluginPromises.push( this.loadPlugin(pluginAbsolute) );
                    }
                });
                if (pluginPromises.length > 0) {
                    resolve(Promise.all(pluginPromises));
                } else {
                    resolve([]);
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Load a plugin from the given module directory
     * @param pluginDirectory
     */
    loadPlugin(pluginDirectory) {
        return new Promise((resolve, reject) => {
            try {
                let pluginPackage = require(path.resolve(pluginDirectory, "package.json"));
                let pluginModule = require(pluginDirectory);
                let pluginConfig = new Config(pluginPackage.name, pluginDirectory);
                let pluginObject = {
                    name: pluginPackage.name,
                    path: pluginDirectory,
                    backend: new pluginModule.backend(this, pluginPackage.name, pluginDirectory, pluginConfig)
                };
                this.plugins.push(pluginObject);
                this.sendMessage("core", "plugin.load", pluginDirectory, pluginConfig);
                resolve(pluginObject);
            } catch (error) {
                reject(error);
            }
        });
    }

    unloadPlugin(pluginObject) {
        return new Promise((resolve, reject) => {
            let pluginIndex = this.plugins.indexOf(pluginObject);
            if (pluginIndex === -1) {
                reject(new Error("Failed to unload plugin! Plugin "+pluginObject.name+" was not found."));
                return;
            }
            this.plugins.splice(pluginIndex, 1);
            this.sendMessage("core", "plugin.unload", pluginObject.name);
            resolve(pluginObject);
        });
    }

    /**
     * Get a list of all available plugins
     * @returns {Promise<unknown>}
     */
    listPlugins() {
        return libnpmsearch("gaming-buddy-plugin", {json: true}).then((results) => {
            let pluginList = [];
            for (let i = 0; i < results.length; i++) {
                if (results[i].hasOwnProperty("keywords") && (results[i].keywords.indexOf("gaming-buddy-plugin") >= 0)) {
                    results[i].installed = (this.getPlugin(results[i].name) !== null);
                    pluginList.push(results[i]);
                }
            }
            return Promise.resolve(pluginList);
        });
    }

    /**
     * Set the active plugin
     * @param plugin
     */
    setPluginActive(plugin) {
        this.pluginActive = plugin;
        this.sendMessage("core", "plugin.active", (plugin !== null ? plugin.name : null));
    }

    /**
     * Install a plugin from the given source (usually npm package name)
     * @param source
     * @returns {Promise<unknown>}
     */
    installPlugin(source) {
        let pluginDir = path.resolve(this.getHomeDir(), "plugins");
        let targetDir = null;
        // Get manifest
        return pacote.manifest(source).then((pluginManifest) => {
            // Extract package
            targetDir = path.join(pluginDir, pluginManifest.name.replace("/", "-"));
            return pacote.extract(source, targetDir);
        }).then(() => {
            // Resolve dependencies
            return new Promise((resolve, reject) => {
                var npmConfig = { loaded: false, progress: false, "no-audit": true };
                npm.load(npmConfig, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        npm.commands.install(targetDir, [], (err, data) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve();
                            }
                        });
                    }
                });
            });
        }).then(() => {
            // Load plugin
            return this.loadPlugin(targetDir);
        });
    }

    /**
     * Uninstalls a plugin
     * @param pluginName
     */
    uninstallPlugin(pluginName) {
        console.log("Uninstalling plugin '"+pluginName+"' ...");
        return new Promise((resolve, reject) => {
            // Get and unload plugin
            let plugin = this.getPlugin(pluginName);
            if (plugin === null) {
                reject(new Error("Failed to uninstall plugin! Plugin '"+pluginName+"' was not found."));
                return;
            }
            resolve(this.unloadPlugin(plugin));
        }).then((plugin) => {
            // Delete plugin directory
            return new Promise((resolve, reject) => {
                try {
                    rimraf(plugin.path, () => {
                        resolve(plugin);
                    });
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    /**
     * Capture screenshot
     * @param options
     */
    screenshotCapture(options = {}) {
        if (!options.hasOwnProperty("target")) {
            options.target = this.getWindowActive();
        }
        return ScreenshotCapture.capture(options).then((screenshot) => {
            return Jimp.read(screenshot);
        });
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
     * Set configuration values
     * @param {Object} configValues
     */
    setConfigValues(configValues) {
        this.config.values = configValues;
        fs.writeFileSync(path.resolve(__dirname, "..", "..", "config.json"), JSON.stringify(configValues));
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
     * Get the currently active window
     * @returns {null}
     */
    getWindowActive() {
        return this.windowActive;
    }

    /**
     * Get all open windows
     * @returns {[]}
     */
    getWindows() {
        return this.windows.list;
    }

    setWindowActive(window) {
        this.windowActive = window;
        // Check active plugin
        if (this.windowActive !== null) {
            for (let i = 0; i < this.plugins.length; i++) {
                if (this.plugins[i].backend.checkActive(window)) {
                    this.setPluginActive(this.plugins[i]);
                    return;
                }
            }
        }
        // No plugin active (anymore)
        //this.setPluginActive(null);
    }

    /**
     * Start updating
     */
    updateStart() {
        if (this.updateTimer === null) {
            this.updateTimer = setInterval(() => {
                this.update();
            }, 1000);
        }
    }

    /**
     * Stop updating
     */
    updateStop() {
        if (this.updateTimer !== null) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
    }

    /**
     * Update application and plugins
     */
    update() {
        this.updateWindows().then(() => {
            // Update plugin
            if (this.pluginActive !== null) {
                let pluginTarget = this.pluginActive;
                // Stop update timer
                this.updateStop();
                // Update plugin
                let timeStart = (new Date()).getTime();
                pluginTarget.backend.update().then(() => {
                    console.log("Updated '" + pluginTarget.name + "' after " + ((new Date()).getTime() - timeStart) + "ms.");
                    // Start next update as soon as the previous is done
                    this.update();
                }).catch((error) => {
                    // Delay next update on error...
                    this.updateStart();
                    // ... and output the error
                    console.error("Error while updating Plugin '" + pluginTarget.name + "'");
                    console.error(error);
                });
            } else {
                // No plugin active
                this.updateStart();
            }
        });
    }

    /**
     * Update all open windows
     */
    updateWindows() {
        let dataAge = ((new Date()).getTime() - this.windows.updated) / 1000;
        if (dataAge > 10) {
            // Update all windows every 10 seconds
            this.windows.updated = (new Date()).getTime();
            return ScreenshotCapture.getWindows().then((windowList) => {
                this.windows.list = windowList;
                this.windowActive = null;
                for (let i = 0; i < windowList.length; i++) {
                    if (windowList[i].foreground) {
                        this.setWindowActive(windowList[i]);
                        break;
                    }
                }
                return Promise.resolve();
            });
        } else {
            // Update only the active window
            return ScreenshotCapture.getWindowActive().then((windowId) => {
                if ((this.windowActive === null) || (this.windowActive.ident !== windowId)) {
                    // Active window changed
                    if (this.windowActive !== null) {
                        this.windowActive.foreground = false;
                        this.windowActive = null;
                    }
                    let windowNewActive = null;
                    for (let i = 0; i < this.windows.list.length; i++) {
                        if (this.windows.list[i].ident === windowId) {
                            this.windows.list[i].foreground = true;
                            windowNewActive = this.windows.list[i];
                            break;
                        }
                    }
                    this.setWindowActive(windowNewActive);
                }
                return Promise.resolve();
            });
        }
    }

}

module.exports = App;