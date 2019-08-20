// Nodejs dependencies
const EventEmitter = require('events');

// Local classes
const ImageColor = require("../image-color.js");

class Filter extends EventEmitter {

  static fromObject(layout, filter) {
    // Read object properties
    let attributes = {};
    if (filter.hasOwnProperty("attr")) {
      for (let name in filter.attr) {
        let value = filter.attr[name];
        name = name.substr(2);
        attributes[name] = value;
      }
    }
    if (attributes.hasOwnProperty("type")) {
      let FilterClass = require("./filter/"+attributes["type"]+".js");
      return new FilterClass(layout, attributes, filter);
    }
    return new this(layout, attributes, filter);
  }

  static matchPixel(image, x, y, matchesPositive, matchesNegative = []) {
    return ImageColor.fromImagePixel(image, x, y).matchColors(matchesPositive, matchesNegative);
  }

  constructor(layout, attributes = {}, sourceObject = {}) {
    super();
    this.layout = layout;
    this.attributes = attributes;
    this.init(sourceObject);
  }

  init() {
    // Bind events here by overriding this method
  }

  apply(image) {
    return new Promise((resolve, reject) => {
      this.emit("apply", image, resolve, reject);
    });
  }

}

module.exports = Filter;