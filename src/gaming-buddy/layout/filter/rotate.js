// Local classes
const Filter = require('../filter.js');

class FilterRotate extends Filter {

  init(sourceObject = {}) {
    this.on("apply", (image, resolve, reject) => {
      resolve( image.rotate(parseFloat(this.attributes.angle)) );
    });
  }

}

module.exports = FilterRotate;