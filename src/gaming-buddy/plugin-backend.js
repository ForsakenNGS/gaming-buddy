// Nodejs dependencies
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

// Local dependencies
const PluginBase = require('./plugin-base.js');
const GamingBuddyLayout = require('./layout.js');

class PluginBackend extends PluginBase {

  /**
   * Plugin backend default constructor
   * @param {App} app
   * @param {string} pluginName
   * @param {string} pluginDirectory
   * @param {Config} pluginConfig
   */
  constructor(app, pluginName, pluginDirectory, pluginConfig) {
    super(pluginName, pluginDirectory, pluginConfig);
    this.app = app;
  }

  /**
   * Add debug information for the given layout to the frontend
   * @param {Layout} layout
   * @param {Jimp} image
   */
  debugLayoutsAdd(layout, image) {
    if (!this.app.getConfigValue("debug")) {
      return;
    }
    if (Array.isArray(layout)) {
      for (let i = 0; i < layout.length; i++) {
        this.debugLayoutsAdd(layout[i][0], layout[i][1]);
      }
      return;
    }
    image.getBufferAsync(Jimp.MIME_PNG).then((buffer) => {
      this.app.sendGuiMessage("core", "debug.layouts.add", {
        id: layout.id,
        image: buffer.toString("base64"),
        extra: layout.extra
      });
    });
  }

  /**
   * Display the given status text for debugging
   */
  debugStatus(statusText) {
    if (!this.app.getConfigValue("debug")) {
      return;
    }
    this.app.sendGuiMessage("core", "debug.status", statusText);
  }

  /**
   * Clear the layouts displayed for debugging
   */
  debugLayoutsClear() {
    if (!this.app.getConfigValue("debug")) {
      return;
    }
    this.app.sendGuiMessage("core", "debug.layouts.clear");
  }

  /**
   * Update the layouts debug view
   */
  debugLayoutsDone() {
    if (!this.app.getConfigValue("debug")) {
      return;
    }
    this.app.sendGuiMessage("core", "debug.layouts.done");
  }

  handleMessage(type, parameters) {
    throw new Error("Plugin "+this.name+" backend: handleMessage not implemented!");
  }

  sendGuiMessage(type, ...parameters) {
    this.app.sendGuiMessage(this.name, type, ...parameters);
  }

  /**
   * Check if the plugin is currently active
   * @param window
   * @returns {boolean}
   */
  checkActive(window) {
    return false;
  }

  /**
   * Load layout definition from xml file
   * @param xmlFile
   * @param xmlOptions
   * @param namespace
   * @param basePath
   * @returns {Layout|Layout[]}
   */
  loadLayoutFromXmlFile(xmlFile, xmlOptions = {}, namespace = null, basePath = null) {
    return GamingBuddyLayout.fromXmlFile(xmlFile, xmlOptions, namespace, basePath);
  }

  /**
   * Set single configuration value
   * @param {string} name
   * @param {*} value
   */
  setConfigValue(name, value) {
    this.config.values[name] = value;
    this.saveConfig();
  }

  /**
   * Set configuration values
   * @param {Object} configValues
   */
  setConfigValues(configValues) {
    this.config.values = configValues;
    this.saveConfig();
  }

  /**
   * Save the config into a file
   */
  saveConfig() {
    fs.writeFileSync( path.resolve(this.path, "config.json"), JSON.stringify(this.config.values) );
  }

  /**
   * Send the current configuration of the plugin to the GUI
   */
  sendConfigToGui() {
    this.app.sendGuiMessage("core", "plugin.config", this.name, this.config);
  }

  /**
   * Get the home dir of the application
   * @returns {string}
   */
  getHomeDir() {
    return this.app.getHomeDir();
  }

  /**
   * Update plugin (called once every second if the plugin is active)
   * @returns {Promise}
   */
  update() {
    return Promise.reject(new Error("Not implemented!"));
  }

}

module.exports = PluginBackend;