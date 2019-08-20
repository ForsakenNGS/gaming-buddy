// Nodejs dependencies
const Jimp = require('jimp');
const {TesseractWorker, TesseractUtils, ...TesseractTypes} = require('tesseract.js');

// Local classes
const Filter = require('../filter.js');
const TesseractCluster = require('../../tesseract-cluster.js');

const ocrCluster = new TesseractCluster(4);

class FilterOcr extends Filter {

  init(sourceObject = {}) {
    this.on("apply", (image, resolve, reject) => {
      if (!this.attributes.hasOwnProperty("language")) {
        this.attributes.language = "eng+lat+rus+kor";
      }
      if (this.attributes.hasOwnProperty("pagesegMode")) {
        switch (this.attributes.pagesegMode) {
          case "OSD_ONLY":
            this.attributes.pagesegMode = TesseractTypes.PSM.OSD_ONLY;
            break;
          case "AUTO_OSD":
            this.attributes.pagesegMode = TesseractTypes.PSM.AUTO_OSD;
            break;
          case "AUTO_ONLY":
            this.attributes.pagesegMode = TesseractTypes.PSM.AUTO_ONLY;
            break;
          case "AUTO":
            this.attributes.pagesegMode = TesseractTypes.PSM.AUTO;
            break;
          case "SINGLE_COLUMN":
            this.attributes.pagesegMode = TesseractTypes.PSM.SINGLE_COLUMN;
            break;
          case "SINGLE_BLOCK_VERT_TEXT":
            this.attributes.pagesegMode = TesseractTypes.PSM.SINGLE_BLOCK_VERT_TEXT;
            break;
          case "SINGLE_BLOCK":
            this.attributes.pagesegMode = TesseractTypes.PSM.SINGLE_BLOCK;
            break;
          default:
          case "SINGLE_LINE":
            this.attributes.pagesegMode = TesseractTypes.PSM.SINGLE_LINE;
            break;
          case "SINGLE_WORD":
            this.attributes.pagesegMode = TesseractTypes.PSM.SINGLE_WORD;
            break;
          case "SINGLE_CHAR":
            this.attributes.pagesegMode = TesseractTypes.PSM.SINGLE_CHAR;
            break;
          case "SPARSE_TEXT":
            this.attributes.pagesegMode = TesseractTypes.PSM.SPARSE_TEXT;
            break;
          case "SPARSE_TEXT_OSD":
            this.attributes.pagesegMode = TesseractTypes.PSM.SPARSE_TEXT_OSD;
            break;
          case "RAW_LINE":
            this.attributes.pagesegMode = TesseractTypes.PSM.RAW_LINE;
            break;
          case "COUNT":
            this.attributes.pagesegMode = TesseractTypes.PSM.COUNT;
            break;
        }
      } else {
        this.attributes.pagesegMode = TesseractTypes.PSM.SINGLE_LINE;
      }
      let tessParams = {
        tessedit_pageseg_mode: this.attributes.pagesegMode
      };
      image.greyscale().getBufferAsync(Jimp.MIME_PNG).then((buffer) => {
        return ocrCluster.recognize(buffer, this.attributes.language, tessParams);
      }).then((result) => {
        this.layout.extra.ocrResult = result;
        resolve(image);
      }).catch((error) => {
        reject(error);
      });
    });
  }

}

module.exports = FilterOcr;