// Nodejs dependencies
const {ipcRenderer} = require('electron');
const path = require('path');
const Twig = require('twig');
const EventEmitter = require('events');

class Gui extends EventEmitter {

  constructor() {
    super();
    this.debugEnabled = true;
    this.debugStatus = "Loading...";
    this.debugLayouts = [];
    this.config = {
      structure: null,
      values: {}
    };
    this.page = null;
    this.pluginActive = null;
    this.plugins = [];
    this.twigNamespaces = {
      "core": path.resolve(__dirname, "..", "..", "gui")
    };
    // Start with index page
    this.sendMessage("core", "ready");
  }

  debugStatusSet(debugStatus) {
    this.debugStatus = debugStatus;
    jQuery(".debug-step").guiElement("render");
  }

  /**
   * Handle message from the backend
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
            return plugin.frontend.setConfigValues(...parameters);
          default:
            return plugin.frontend.handleMessage(type, parameters);
        }
      }
      return;
    }
    // Handle core message
    switch (type) {
      case "config":
        this.config = parameters[0];
        break;
      case "debug.status":
        this.debugStatusSet(parameters[0]);
        break;
      case "debug.layouts.add":
        this.debugLayouts.push( parameters[0] );
        break;
      case "debug.layouts.clear":
        this.debugLayouts = [];
        break;
      case "debug.layouts.done":
        if (this.page === "core::debug") {
          this.setPage("core::debug"); // Refresh debug view
        }
        break;
      case "plugin.config":
        this.setConfigFull(parameters[0], parameters[1]);
        break;
      case "plugin.load":
        this.loadPlugin(...parameters);
        break;
      case "plugin.active":
        this.setPluginActive( this.getPlugin(parameters[0]) );
        break;
      case "ready":
        this.setPage("core::index");
        break;
    }
  }

  /**
   * Send message to the backend
   * @param plugin
   * @param type
   * @param parameters
   */
  sendMessage(plugin, type, ...parameters) {
    ipcRenderer.send("gui", plugin, type, ...parameters);
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
      Twig.renderFile(pluginTemplate, this.getTwigContext({ plugin: pluginFrontend }, variables), (error, html) => {
        if (error) {
          console.error(error);
        } else {
          callback(html);
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
        jQuery(".page").html(html);
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
          if ((this.pluginActive !== null) && (this.pluginActive.frontend.page !== null)) {
            this.pluginActive.frontend.renderPage(this.pluginActive.frontend.page+".twig");
            break;
          }
        default:
          // Core page
          this.renderPage( path.resolve(__dirname, "..", "..", "gui", "pages", pageName+".twig") );
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
   * @returns {PluginFrontend|null}
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
   * Load a plugin from the given directory
   * @param pluginDirectory
   * @param pluginConfig
   */
  loadPlugin(pluginDirectory, pluginConfig) {
    let pluginPackage = require(path.resolve(pluginDirectory, "package.json"));
    let pluginModule = require(pluginDirectory);
    let plugin = {
      name: pluginPackage.name,
      path: pluginDirectory,
      frontend: new pluginModule.frontend(this, pluginPackage.name, pluginDirectory, pluginConfig)
    };
    this.plugins.push(plugin);
    this.twigNamespaces[pluginPackage.name] = path.resolve(pluginDirectory, "gui");
    // Forward render events from plugins into the gui
    plugin.frontend.on("element.render", (...parameters) => {
      this.emit("element.render", ...parameters);
    });
    plugin.frontend.on("element.rendered", (...parameters) => {
      this.emit("element.rendered", ...parameters);
    });
    plugin.frontend.on("pages.change", () => {
      if (this.pluginActive === plugin) {
        jQuery(".plugin-pages-nav").guiElement("render");
      }
    });
    // Send ready event to backend
    this.sendMessage("core", "plugin.ready", plugin.name);
  }

  /**
   * Set the currently active plugin
   * @param plugin
   */
  setPluginActive(plugin) {
    if (this.pluginActive !== plugin) {
      // Active plugin changed
      if (this.page === "core::plugin") {
        if ((plugin !== null) && (plugin.frontend.page !== null)) {
          // Plugin page is selected and the plugin that became active has some active content
          plugin.frontend.renderPage(plugin.frontend.page+".twig");
        }
      }
      this.pluginActive = plugin;
      // Update plugin navigation
      jQuery(".plugin-pages-nav").guiElement("render");
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
    return Object.assign({ gui: this, guiElement: {}, settings: this.getTwigSettings() }, ...variables);
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
          return [plugin.frontend.getFilePath("gui", namespaceMatch[2]), plugin.frontend];
        }
      }
    }
    return [name, null];
  }

  /**
   * Set configuration structure & values
   * @param {string} configPlugin
   * @param {Object} config
   */
  setConfigFull(configPlugin, config) {
    if (configPlugin === "core") {
      // Core configuration
      this.config = config;
    } else {
      // Plugin configuration
      let plugin = this.getPlugin(configPlugin);
      if (plugin !== null) {
        plugin.frontend.setConfigFull(config);
      }
    }
  }

  /**
   * Set configuration values
   * @param {string} configPlugin
   * @param {Object} configValues
   */
  setConfigValues(configPlugin, configValues) {
    if (configPlugin === "core") {
      // Core configuration
      this.config.values = configValues;
      this.sendMessage("core", "config", configValues);
    } else {
      // Plugin configuration
      let plugin = this.getPlugin(configPlugin);
      if (plugin !== null) {
        plugin.frontend.setConfigValues(configValues);
      }
    }
  }

  /**
   * Quit the application
   */
  quit() {
    this.sendMessage("core", "quit");
  }
}

module.exports = Gui;