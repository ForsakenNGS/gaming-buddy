// Nodejs dependencies
const path = require('path');
const EventEmitter = require('events');

class PluginBase extends EventEmitter {

  /**
   * Plugin base default constructor
   * @param {string} pluginName
   * @param {string} pluginDirectory
   * @param {Object} pluginConfig
   */
  constructor(pluginName, pluginDirectory, pluginConfig) {
    super();
    this.path = pluginDirectory;
    this.config = pluginConfig;
    this.name = pluginName;
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
   * Update the full configuration object
   * @param config
   */
  setConfigFull(config) {
    this.config = config;
  }

  /**
   * Get path to files relative to the plugin
   * @param file
   * @returns {string}
   */
  getFilePath(...file) {
    return path.join(this.path, ...file);
  }

  /**
   * Get the title for the plugin (usually the game name, by default the plugins package name from the package.json)
   * @returns {string}
   */
  getTitle() {
    return this.name;
  }

}

module.exports = PluginBase;