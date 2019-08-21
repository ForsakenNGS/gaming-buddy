// External dependencies
const path = require('path');
const Twig = require('twig');

// Local dependencies
const PluginBase = require('./plugin-base.js');

class PluginFrontend extends PluginBase {

  /**
   * Plugin frontend default constructor
   * @param {Gui} gui
   * @param {string} pluginName
   * @param {string} pluginDirectory
   * @param {Object} pluginConfig
   */
  constructor(gui, pluginName, pluginDirectory, pluginConfig) {
    super(pluginName, pluginDirectory, pluginConfig);
    this.gui = gui;
    this.page = null;
  }

  /**
   * Clear all hooks that plug into rendering elements
   * (Usually done when loading a new page)
   */
  clearRenderHooks() {
    this.removeAllListeners("element.render");
    this.removeAllListeners("element.rendered");
  }

  /**
   * Handle messages received from the backend
   * @param {string} type
   * @param {*} parameters
   */
  handleMessage(type, parameters) {
    switch (type) {
      case "page":
        this.setPage(...parameters);
        break;
      default:
        super.handleMessage(type, parameters);
        break;
    }
  }

  /**
   * Render a page element
   * @param templateFile
   * @param parameters
   */
  renderElement(templateFile, ...parameters) {
    let variables = {};
    if (typeof parameters[0] === "object") {
      variables = parameters.shift();
    }
    let callback = parameters.shift();
    this.emit("element.render", variables, callback);
    Twig.renderFile(templateFile, this.gui.getTwigContext({ plugin: this }, variables), (error, html) => {
      if (error) {
        console.error(error);
      } else {
        callback(html);
        this.emit("element.rendered", variables.guiElement.__dom, templateFile, variables, html);
      }
    });
  }

  /**
   * Render a page template
   * @param templateFile
   * @param variables
   */
  renderPage(templateFile, variables = {}) {
    this.clearRenderHooks();
    this.gui.renderPage(
      path.join(this.path, "gui", "pages", templateFile),
      Object.assign({ plugin: this }, variables)
    );
  }

  /**
   * Set the active page
   * @param page
   * @param forceReload
   */
  setPage(page, forceReload = false) {
    if (forceReload || (this.page !== page)) {
      this.page = page;
      if (this.gui.page === "core::plugin") {
        this.renderPage(page+".twig");
      }
    }
  }

  /**
   * Send message to the backend
   * @param type
   * @param parameters
   */
  sendMessage(type, ...parameters) {
    this.gui.sendMessage(this.name, type, ...parameters);
  }

  /**
   * Set configuration values
   * @param {Object} configValues
   */
  setConfigValues(configValues) {
    this.config.values = configValues;
    this.sendMessage("config", configValues);
  }

}

module.exports = PluginFrontend;