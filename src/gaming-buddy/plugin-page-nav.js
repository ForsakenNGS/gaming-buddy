// Nodejs dependencies
const EventEmitter = require('events');

class PluginPageNav extends EventEmitter {

  /**
   * @param {PluginBase} plugin
   * @param {object} object
   * @returns {PluginPageNav}
   */
  static fromJson(plugin, object) {
    return new this(plugin, object.ident, object.title, object.icon, object.visible);
  }

  /**
   * @param {PluginBase} plugin
   * @param {string} ident
   * @param {string} title
   * @param {string|null} icon
   * @param {boolean} visible
   */
  constructor(plugin, ident, title, icon = null, visible = true) {
    super();
    this.plugin = plugin;
    this._ident = ident;
    this._title = title;
    this._icon = icon;
    this._visible = visible;
  }

  /**
   * Returns the draft data in a json serializable form
   * @returns {object}
   */
  toJSON() {
    return {
      ident: this._ident,
      title: this._title,
      icon: this._icon,
      visible: this._visible
    };
  }

  get ident() {
    return this._ident;
  }

  get title() {
    return this._title;
  }

  get icon() {
    return this._icon;
  }

  get visible() {
    return this._visible;
  }

  set ident(ident) {
    this._ident = ident;
    this.emit("change");
  }

  set title(title) {
    this._title = title;
    this.emit("change");
  }

  set icon(icon) {
    this._icon = icon;
    this.emit("change");
  }

  set visible(visible) {
    this._visible = visible;
    this.emit("change");
  }

  show() {
    this.visible = true;
  }

  hide() {
    this.visible = false;
  }



}

module.exports = PluginPageNav;