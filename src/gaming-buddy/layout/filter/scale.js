// Local classes
const Filter = require('../filter.js');
const Jimp = require('jimp');

class FilterRotate extends Filter {

  init(sourceObject = {}) {
    this.on("apply", (image, resolve, reject) => {
      if (this.attributes.hasOwnProperty("mode")) {
        switch (this.attributes.mode) {
          case 'RESIZE_NEAREST_NEIGHBOR':
          case 'NEAREST_NEIGHBOR':
          case 'nearestNeighbor':
            this.attributes.mode =  Jimp.RESIZE_NEAREST_NEIGHBOR;
            break;
          case 'RESIZE_BILINEAR':
          case 'BILINEAR':
          case 'bilinearInterpolation':
            this.attributes.mode = Jimp.RESIZE_BILINEAR;
            break;
          case 'RESIZE_BICUBIC':
          case 'BICUBIC':
          case 'bicubicInterpolation':
            this.attributes.mode = Jimp.RESIZE_BICUBIC;
            break;
          case 'RESIZE_HERMITE':
          case 'HERMITE':
          case 'hermiteInterpolation':
            this.attributes.mode = Jimp.RESIZE_HERMITE;
            break;
          case 'RESIZE_BEZIER':
          case 'BEZIER':
          case 'bezierInterpolation':
            this.attributes.mode = Jimp.RESIZE_BEZIER;
            break;
        }
      } else {
        // Default mode
        this.attributes.mode = Jimp.RESIZE_BILINEAR;
      }
      resolve( image.scale(parseFloat(this.attributes.factor, this.attributes.mode)) );
    });
  }

}

module.exports = FilterRotate;