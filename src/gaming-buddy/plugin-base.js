// External dependencies
const path = require('path');
const EventEmitter = require('events');

// Local dependencies
const PluginPageNav = require('./plugin-page-nav.js');

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
    this.pages = [];
  }

  /**
   * Handle messages sent between the plugins front- and backend
   * @param {string} type
   * @param {*} parameters
   */
  handleMessage(type, parameters) {
    switch (type) {
      case "pages":
        let pagesNew = parameters[0];
        this.pages = [];
        for (let i = 0; i < pagesNew.length; i++) {
          let page = PluginPageNav.fromJson(this, pagesNew[i]);
          this.pages.push(page);
          page.on("change", () => {
            this.sendMessage("pages", this.pages);
          });
        }
        this.emit("pages.change");
        break;
      default:
        throw new Error("Plugin "+this.name+": Unhandled message received! "+type+" / "+JSON.stringify(parameters));
    }
  }

  /**
   * Send messages between the plugins front- and backend
   * @param {string} type
   * @param {*} parameters
   */
  sendMessage(type, ...parameters) {
    // This method is implemented differently for front- and backend and will be overridden
    throw new Error(
      "Trying to call sendMessage of the 'PluginBase' class! " +
      "Only the methods of the subclasses 'PluginFrontend' and 'PluginBackend' should be used!"
    );
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
   * @param {string} ident
   * @param {string} title
   * @param {string|null} icon
   * @param {boolean} visible
   * @returns {PluginPageNav}
   */
  addPageNav(ident, title, icon = null, visible = true) {
    let page = new PluginPageNav(this, ident, title, icon, visible);
    this.pages.push(page);
    page.on("change", () => {
      this.sendMessage("pages", this.pages);
    });
    this.sendMessage("pages", this.pages);
    return page;
  }

  /**
   * @param ident
   * @returns {PluginPageNav|null}
   */
  getPageNav(ident) {
    for (let i = 0; i < this.pages.length; i++) {
      if (this.pages[i].ident === ident) {
        return this.pages[i];
      }
    }
    return null;
  }

  /**
   * @param ident
   * @returns {PluginPageNav|null}
   */
  removePageNav(ident) {
    for (let i = 0; i < this.pages.length; i++) {
      if (this.pages[i].ident === ident) {
        let page = this.pages[i];
        this.pages.splice(i, 1);
        return page;
      }
    }
    return null;
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