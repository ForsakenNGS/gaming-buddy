// Nodejs dependencies
const os = require('os');
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const EventEmitter = require('events');
const ScreenshotCapture = require('@forsaken87/screenshot-capture');

// Local classes
const Config = require('./config.js');

class App extends EventEmitter {

  constructor() {
    super();
    this.debugEnabled = true;
    this.config = new Config( "core", path.resolve(__dirname, "..", "..") );
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
      fs.mkdirSync(pluginDir, { recursive: true });
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
        this.sendGuiMessage("core", "config", this.config);
        this.loadPluginDirectory( path.resolve(__dirname, "..", "..", "plugins-builtin") );
        this.loadPluginDirectory( path.resolve(this.getHomeDir(), "plugins") );
        this.sendGuiMessage("core", "ready");
        this.updateStart();
        break;
    }
  }

  /**
   * Send message to the frontend
   * @param plugin
   * @param type
   * @param parameters
   */
  sendGuiMessage(plugin, type, ...parameters) {
    process.send([plugin, type, ...parameters]);
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
   * @returns {boolean}
   */
  loadPluginDirectory(directory) {
    try {
      console.log("Loading plugins from "+directory+"...");
      let files = fs.readdirSync(directory);
      files.forEach((plugin) => {
        let pluginAbsolute = path.join(directory, plugin);
        let pluginLstat = fs.lstatSync(pluginAbsolute);
        if ((pluginLstat.isDirectory() || pluginLstat.isSymbolicLink()) && fs.existsSync( path.join(pluginAbsolute, "package.json") )) {
          this.loadPlugin(pluginAbsolute);
        }
      });
      return true;
    } catch (error) {
      // Error loading plugins
      console.error("Failed to load plugins!");
      console.error(error);
      return false;
    }
  }

  /**
   * Load a plugin from the given module directory
   * @param pluginDirectory
   */
  loadPlugin(pluginDirectory) {
    let pluginPackage = require(path.resolve(pluginDirectory, "package.json"));
    let pluginModule = require(pluginDirectory);
    let pluginConfig = new Config(pluginPackage.name, pluginDirectory);
    let pluginObject = {
      name: pluginPackage.name,
      path: pluginDirectory,
      backend: new pluginModule.backend(this, pluginPackage.name, pluginDirectory, pluginConfig)
    };
    this.plugins.push(pluginObject);
    this.sendGuiMessage("core", "plugin.load", pluginDirectory, pluginConfig);
  }

  /**
   * Set the active plugin
   * @param plugin
   */
  setPluginActive(plugin) {
    this.pluginActive = plugin;
    this.sendGuiMessage("core", "plugin.active", (plugin !== null ? plugin.name : null));
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
    fs.writeFileSync( path.resolve(__dirname, "..", "..", "config.json"), JSON.stringify(configValues) );
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
    // No plugin active
    this.setPluginActive(null);
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
          console.log("Updated '"+pluginTarget.name+"' after "+((new Date()).getTime() - timeStart)+"ms.");
          // Start next update as soon as the previous is done
          this.update();
        }).catch((error) => {
          // Delay next update on error...
          this.updateStart();
          // ... and output the error
          console.error("Error while updating Plugin '"+pluginTarget.name+"'");
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