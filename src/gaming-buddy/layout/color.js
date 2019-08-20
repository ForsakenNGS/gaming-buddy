const Jimp = require('jimp');
const ImageColor = require("../image-color.js");

class Color extends ImageColor {

  static fromObject(color) {
    let id = null;
    let red = 0;
    let green = 0;
    let blue = 0;
    let alpha = 255;
    let toleranceLum = 1;
    let toleranceHue = 1;
    // Read object properties
    if (color.hasOwnProperty("attr")) {
      if (color.attr.hasOwnProperty("@_id")) {
        id = color.attr["@_id"];
      }
      if (color.attr.hasOwnProperty("@_r")) {
        red = parseInt(color.attr["@_r"]);
      }
      if (color.attr.hasOwnProperty("@_g")) {
        green = parseInt(color.attr["@_g"]);
      }
      if (color.attr.hasOwnProperty("@_b")) {
        blue = parseInt(color.attr["@_b"]);
      }
      if (color.attr.hasOwnProperty("@_a")) {
        alpha = parseInt(color.attr["@_a"]);
      }
      if (color.attr.hasOwnProperty("@_toleranceLum")) {
        toleranceLum = parseInt(color.attr["@_toleranceLum"]);
      }
      if (color.attr.hasOwnProperty("@_toleranceHue")) {
        toleranceHue = parseInt(color.attr["@_toleranceHue"]);
      }
    }
    return new this(red, green, blue, alpha, id, toleranceLum, toleranceHue);
  }

  static fromCss(cssColor) {
    let color = Jimp.intToRGBA( Jimp.cssColorToHex(cssColor) );
    return new this(color.r, color.g, color.b, color.a);
  }

  constructor(red, green, blue, alpha = 255, id = null, toleranceLum = 1, toleranceHue = 1) {
    super(red, green, blue, alpha);
    this.id = id;
    this.toleranceLum = toleranceLum;
    this.toleranceHue = toleranceHue;
  }

  /**
   * @param {ImageColor} color
   * @returns {number}
   */
  match(color) {
    let colorDiffLum = ImageColor.lumDiff(color, this);
    let colorDiffHue = ImageColor.hueDiff(color, this);
    if ((colorDiffLum <= this.toleranceLum) && (colorDiffHue <= this.toleranceHue)) {
      return Math.round(
        1 + ((this.toleranceLum - colorDiffLum) * 127 / this.toleranceLum) +
        ((this.toleranceHue - colorDiffHue) * 127 / this.toleranceHue)
      );
    } else {
      return 0;
    }
  }

}

module.exports = Color;