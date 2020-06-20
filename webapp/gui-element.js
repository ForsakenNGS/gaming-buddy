(function($, gui) {

  let _defaultSettings = {
    context: {},
    template: null,
    plugin: "core"
  };

  let _self = function(self) {
    let jqSelf = $(self);
    return [ jqSelf[0], jqSelf ];
  };

  let _funcInteral = {
    /**
     * Initialize the element or update multiple settings
     * @param settings
     */
    initialize: function(settings) {
      let [jsSelf, jqSelf] = _self(this);
      // Write settings to the instance
      if (typeof settings !== "object") {
        settings = {};
      }
      if (jsSelf.hasOwnProperty("_gui_settings")) {
        // Updating existing instance
        settings = Object.assign(jsSelf._gui_settings, settings);
      }
      // Apply settings from data attributes
      if (jqSelf.is("[data-template]") && !settings.hasOwnProperty("template")) {
        settings.template = jqSelf.attr("data-template");
      }
      // Write final settings object
      jsSelf._gui_settings = Object.assign({}, _defaultSettings, settings);
    },
    /**
     * Render the element
     */
    render: function(context = {}) {
      let [jsSelf, jqSelf] = _self(this);
      // Check template
      if (jsSelf._gui_settings.template === null) {
        throw new Error("No teplate set to render gui element!");
      }
      // Apply context
      switch (typeof jsSelf._gui_settings.context) {
        case "function":
          context = jsSelf._gui_settings.context.call(this, context);
          break;
        case "object":
          context = jsSelf._gui_settings.context;
          break;
      }
      // -> "guiElement" always contains the current dom elements attributes
      context.guiElement = { __dom: jsSelf, __jquery: jqSelf };
      for (let i = 0; i < jsSelf.attributes.length; i++) {
        context.guiElement[ jsSelf.attributes[i].name ] = jsSelf.attributes[i].value;
      }
      // Emit event (allows modifying the context)
      let renderEvent = $.Event("guiElement.render", { renderContext: context });
      jqSelf.trigger(renderEvent);
      // Render the element and replace the html
      if (!renderEvent.isDefaultPrevented()) {
        gui.renderElement(jsSelf._gui_settings.template, context, (result) => {
          jqSelf.html(result);
        })
      }
    }
  };

  $.fn.guiElement = function(...parameters) {

    if (typeof parameters[0] === "string") {
      let action = parameters.shift();
      let results = [];
      if (_funcInteral.hasOwnProperty(action) && typeof _funcInteral[action] === "function") {
        // Method, getter or setter called
        this.each(function () {
          if (typeof this._gui_settings === "undefined") {
            // Auto initialize elements that have not been initialized yet
            _funcInteral.initialize.call(this);
          }
          let actionResult = _funcInteral[action].call(this, ...parameters);
          if (typeof actionResult !== "undefined") {
            results.push(actionResult);
          }
        });
      } else {
        // Read property if existing
        this.each(function() {
          if (this._gui_settings.hasOwnProperty(action)) {
            results.push( this._gui_settings[action] );
          } else {
            results.push( null );
          }
        });
      }
      if (results.length > 0) {
        // Return value(s) present
        return results;
      } else {
        // Return self for chaining
        return this;
      }
    } else {
      // Initialize / Update elements
      this.each(function() {
        _funcInteral.initialize.call(this, ...parameters);
      });
      // Return self for chaining
      return this;
    }

  };

  $.fn.guiElement.autoload = true;

  // Autoloader
  $(function() {
    if ($.fn.guiElement.autoload) {
      $("[data-template]").guiElement();
    }
  });

})(jQuery, gui);
