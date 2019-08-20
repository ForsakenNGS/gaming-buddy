const ImageColor = require('./image-color.js');

class ImageUtils {

  static imageContainsColor(image, colors) {
    for (let x = 0; x < image.bitmap.width; x++) {
      for (let y = 0; y < image.bitmap.height; y++) {
        let pixelColor = ImageColor.fromImagePixel(image, x, y);
        for (let c = 0; c < colors.length; c++) {
          if (colors[c].match( pixelColor )) {
            return true;
          }
        }
      }
    }
    return false;
  }

  static imageBorderColor(image, colors, stepsX = 3, stepsY = 3) {
    let tests = 0;
    let matches = 0;
    for (let x = 0; x < stepsX; x++) {
      for (let y = 0; y < stepsY; y++) {
        // Only test edges
        if ((x === 0) || (x === stepsX) || (y === 0) || (y === stepsY)) {
          tests++;
          let pixelColor = ImageColor.fromImagePixel(
            image,
            Math.floor(x * image.bitmap.width / stepsX),
            Math.floor(y * image.bitmap.height / stepsY)
          );
          for (let c = 0; c < colors.length; c++) {
            if (colors[c].match(pixelColor)) {
              matches++;
              break;
            }
          }
        }
      }
    }
    return matches * 255 / tests;
  }

}

module.exports = ImageUtils;