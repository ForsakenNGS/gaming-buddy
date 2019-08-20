const Jimp = require('jimp');

class ImageColor {

  static fromObject(color) {
    return new this(color.r, color.g, color.b, color.a);
  }

  static fromCss(cssColor) {
    let color = Jimp.intToRGBA( Jimp.cssColorToHex(cssColor) );
    return new this(color.r, color.g, color.b, color.a);
  }

  static fromImagePixel(image, x, y) {
    return this.fromObject(
      Jimp.intToRGBA( image.getPixelColor(x, y) )
    );
  }

  /**
   * @param {ImageColor} colorA
   * @param {ImageColor} colorB
   * @returns {number}
   */
  static hueDiff(colorA, colorB) {
    let hueDiff = Math.abs(colorA.getHue() - colorB.getHue());
    if (hueDiff > 180) {
      hueDiff -= 180;
    }
    return Math.abs(hueDiff);
  }

  /**
   * @param {ImageColor} colorA
   * @param {ImageColor} colorB
   * @returns {number}
   */
  static lumDiff(colorA, colorB) {
    return (
      Math.abs(colorA.red - colorB.red) +
      Math.abs(colorA.green - colorB.green) +
      Math.abs(colorA.blue - colorB.blue)
    ) / 3;
  }

  constructor(red, green, blue, alpha = 255) {
    this.red = red;
    this.green = green;
    this.blue = blue;
    this.alpha = alpha;
  }

  getHue() {
    let valueMin = Math.min(this.red, this.green, this.blue);
    let valueMax = Math.max(this.red, this.green, this.blue);
    if (valueMin == valueMax) {
      return 0;
    }
    let hue = 0;
    if (valueMax === this.red) {
      hue = (this.green - this.blue) / (valueMax - valueMin);
    }
    if (valueMax === this.green) {
      hue = 2 + (this.blue - this.red) / (valueMax - valueMin);
    }
    if (valueMax === this.blue) {
      hue = 4 + (this.red - this.green) / (valueMax - valueMin);
    }
    hue *= 60;
    if (hue < 0) {
      hue += 360;
    }
    return hue;
  }

  /**
   * @param {Color[]} matchesPositive
   * @param {Color[]} matchesNegative
   * @returns {number}
   */
  matchColors(matchesPositive, matchesNegative = []) {
    let matchBest = (matchesPositive.length === 0 ? 255 : 0);
    for (let m = 0; m < matchesPositive.length; m++) {
      matchBest = Math.max( matchBest, matchesPositive[m].match(this) );
    }
    for (let m = 0; m < matchesNegative.length; m++) {
      if (matchesNegative[m].match(this)) {
        matchBest = -1;
        break;
      }
    }
    return matchBest;
  }

  toInt() {
    return this.alpha + (this.blue << 8) + (this.green << 16) + (this.red << 24) >>> 0;
  }

}

module.exports = ImageColor;