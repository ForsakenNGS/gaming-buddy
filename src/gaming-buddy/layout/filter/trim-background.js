// Local classes
const Filter = require('../filter.js');

class FilterTrimBackground extends Filter {

  init() {
    /**
     * @param {Image} image
     */
    this.on("apply", (image, resolve, reject) => {
      if (this.attributes.hasOwnProperty("margin")) {
        this.attributes.margin = parseInt(this.attributes.margin);
      } else {
        this.attributes.margin = 2;
      }
      let backgroundColors = [];
      let backgroundColorIds = this.attributes.background.split(",");
      for (let c = 0; c < backgroundColorIds.length; c++) {
        backgroundColors.push( ...this.layout.getColorsById(backgroundColorIds[c]) );
      }
      let bounds = {
        left: image.bitmap.width, top: image.bitmap.height, right: 0, bottom: 0
      };
      for (let x = 0; x < image.bitmap.width; x++) {
        for (let y = 0; y < image.bitmap.height; y++) {
          if (!this.constructor.matchPixel(image, x, y, backgroundColors)) {
            if (x < bounds.left) {
              bounds.left = x;
            }
            if (y < bounds.top) {
              bounds.top = y;
            }
            if (x > bounds.right) {
              bounds.right = x;
            }
            if (y > bounds.bottom) {
              bounds.bottom = y;
            }
          }
        }
      }
      bounds.left = Math.max(0, bounds.left - this.attributes.margin);
      bounds.top = Math.max(0, bounds.top - this.attributes.margin);
      bounds.right = Math.min(image.bitmap.width - 1, bounds.right + this.attributes.margin);
      bounds.bottom = Math.min(image.bitmap.height - 1, bounds.bottom + this.attributes.margin);
      if ((bounds.left < bounds.right) && (bounds.top < bounds.bottom)) {
        resolve( image.crop(bounds.left, bounds.top, (bounds.right - bounds.left), (bounds.bottom - bounds.top)) );
      } else {
        // Only background detected!
        // TODO: Throw exeception?
        resolve(image);
      }
    });
  }

}

module.exports = FilterTrimBackground;