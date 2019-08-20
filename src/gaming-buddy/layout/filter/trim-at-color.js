// Local classes
const Filter = require('../filter.js');

class FilterTrimAtColor extends Filter {

  init() {
    /**
     * @param {Image} image
     */
    this.on("apply", (image, resolve, reject) => {
      if (!this.attributes.hasOwnProperty("side")) {
        this.attributes.side = "right";
      }
      let colors = [];
      let colorIds = this.attributes.colors.split(",");
      for (let c = 0; c < colorIds.length; c++) {
        colors.push( ...this.layout.getColorsById(colorIds[c]) );
      }
      switch (this.attributes.side) {
        case "left":
          for (let x = image.bitmap.width - 2; x >= 0; x--) {
            for (let y = 0; y < image.bitmap.height; y++) {
              if (this.constructor.matchPixel(image, x, y, colors)) {
                resolve( image.crop(x + 1, 0, image.bitmap.width - (x + 1), image.bitmap.height) );
                return;
              }
            }
          }
          break;
        case "right":
          for (let x = 2; x < image.bitmap.width; x++) {
            for (let y = 0; y < image.bitmap.height; y++) {
              if (this.constructor.matchPixel(image, x, y, colors)) {
                resolve( image.crop(0, 0, x - 1, image.bitmap.height) );
                return;
              }
            }
          }
          break;
      }
      resolve(image);
    });
  }

}

module.exports = FilterTrimAtColor;