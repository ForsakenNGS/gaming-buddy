// Local classes
const Filter = require('../filter.js');

class FilterTrimAtColor extends Filter {

  constructor(layout, attributes = {}, sourceObject = {}) {
    super(layout, attributes, sourceObject);
    this.replacements = [];
    if (!sourceObject.hasOwnProperty("replacement")) {
      sourceObject.replacement = [];
    }
    if (!Array.isArray(sourceObject.replacement)) {
      sourceObject.replacement = [ sourceObject.replacement ];
    }
    for (let i = 0; i < sourceObject.replacement.length; i++) {
      let replacement = {
        from: null,
        to: this.layout.getColorsById(sourceObject.replacement[i].attr["@_to"])
      };
      if (sourceObject.replacement[i].attr.hasOwnProperty("@_from")) {
        replacement.from = this.layout.getColorsById(sourceObject.replacement[i].attr["@_from"]);
      }
      this.replacements.push(replacement);
    }
  }

  init() {
    /**
     * @param {Image} image
     */
    this.on("apply", (image, resolve, reject) => {
      for (let x = 0; x < image.bitmap.width; x++) {
        for (let y = 0; y < image.bitmap.height; y++) {
          for (let r = 0; r < this.replacements.length; r++) {
            if ((this.replacements[r].from === null) || this.constructor.matchPixel(image, x, y, this.replacements[r].from)) {
              image.setPixelColor(this.replacements[r].to[0].toInt(), x, y);
              break;
            }
          }
        }
      }
      resolve(image);
    });
  }

}

module.exports = FilterTrimAtColor;