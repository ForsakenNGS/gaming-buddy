// Nodejs dependencies
const fs = require('fs');
const path = require('path');
const he = require('he');
const xmlParser = require('fast-xml-parser');

// Local classes
const Color = require('./layout/color.js');
const Filter = require('./layout/filter.js');

class Layout {

  /**
   * @param xmlFile
   * @param xmlOptions
   * @param parent
   * @param basePath
   * @returns {Layout|Layout[]}
   */
  static fromXmlFile(xmlFile, xmlOptions = {}, parent = null, basePath = null) {
    if (basePath === null) {
      basePath = path.dirname(xmlFile);
    }
    let options = Object.assign({
      attributeNamePrefix: "@_",
      attrNodeName: "attr", //default is 'false'
      arrayMode: true,
      textNodeName: "#text",
      ignoreAttributes: false,
      ignoreNameSpace: false,
      allowBooleanAttributes: false,
      parseNodeValue: true,
      parseAttributeValue: false,
      trimValues: true,
      cdataTagName: "__cdata", //default is 'false'
      cdataPositionChar: "\\c",
      localeRange: "", //To support non english character in tag/attribute values.
      parseTrueNumberOnly: false,
      attrValueProcessor: a => he.decode(a, {isAttributeValue: true}),//default is a=>a
      tagValueProcessor: a => he.decode(a) //default is a=>a
    }, xmlOptions);
    let xmlData = fs.readFileSync(xmlFile).toString();
    if (!xmlParser.validate(xmlData)) {
      throw new Error("Configuration invalid! ("+xmlFile+")");
    }
    let xmlObject = xmlParser.parse(xmlData, options);
    if (Array.isArray(xmlObject.layout)) {
      let result = [];
      for (let i = 0; i < xmlObject.layout.length; i++) {
        result.push( this.fromObject(xmlObject.layout[i], basePath, parent) );
      }
      return result;
    } else {
      return this.fromObject(xmlObject.layout, basePath, parent);
    }
  }

  /**
   * @param layout
   * @param basePath
   * @param parent
   * @returns {Layout}
   */
  static fromObject(layout, basePath, parent = null) {
    return new Layout(layout, basePath, parent);
  }

  static createBounds(values = {}) {
    return Object.assign({
      left: null, top: null,
      right: null, bottom: null,
      width: null, height: null,
      center: {
        left: null, top: null
      }
    }, values);
  }

  static stackBounds(boundsTarget, boundsOuter) {
    boundsTarget.left += boundsOuter.left;
    boundsTarget.top += boundsOuter.top;
    boundsTarget.right += boundsOuter.right;
    boundsTarget.bottom += boundsOuter.bottom;
    boundsTarget.center.left = boundsTarget.left + boundsTarget.width / 2;
    boundsTarget.center.top = boundsTarget.top + boundsTarget.height / 2;
  }

  static positionPreParse(value) {
    let matchRatio = value.match(/^([0-9.]+)\s*\/\s*([0-9.]+)$/);
    if (matchRatio) {
      return parseFloat(matchRatio[1]) * 100 / parseFloat(matchRatio[2]) + "%";
    }
    return value;
  }

  static positionResolve(value, size) {
    let matchPercent = value.match(/^([0-9.]+)%$/);
    if (matchPercent) {
      return Math.round(size * parseFloat(matchPercent[1]) / 100);
    }
    return Math.round(value);
  }

  constructor(layout, basePath, parent = null) {
    // Initialize
    this.id = null;
    this.namespace = (parent !== null ? parent.namespace : null);
    this.basePath = basePath;
    this.parent = parent;
    this.bounds = {
      original: this.constructor.createBounds(),
      computed: this.constructor.createBounds(),
      scale: { width: null, height: null }
    };
    this.manual = false;
    this.extra = {};
    this.children = [];
    this.colors = [];
    this.filters = [];
    // Read object properties
    if (layout.hasOwnProperty("attr")) {
      // id
      if (layout.attr.hasOwnProperty("@_id")) {
        this.id = (this.namespace !== null ? this.namespace+"." : "") + layout.attr["@_id"];
        this.namespace = this.id;
      }
      // bounds
      if (layout.attr.hasOwnProperty("@_left")) {
        this.bounds.original.left = this.constructor.positionPreParse(layout.attr["@_left"]);
      }
      if (layout.attr.hasOwnProperty("@_top")) {
        this.bounds.original.top = this.constructor.positionPreParse(layout.attr["@_top"]);
      }
      if (layout.attr.hasOwnProperty("@_right")) {
        this.bounds.original.right = this.constructor.positionPreParse(layout.attr["@_right"]);
      }
      if (layout.attr.hasOwnProperty("@_bottom")) {
        this.bounds.original.bottom = this.constructor.positionPreParse(layout.attr["@_bottom"]);
      }
      if (layout.attr.hasOwnProperty("@_width")) {
        this.bounds.original.width = this.constructor.positionPreParse(layout.attr["@_width"]);
      }
      if (layout.attr.hasOwnProperty("@_height")) {
        this.bounds.original.height = this.constructor.positionPreParse(layout.attr["@_height"]);
      }
      if (layout.attr.hasOwnProperty("@_center-left")) {
        this.bounds.original.center.left = this.constructor.positionPreParse(layout.attr["@_center-left"]);
      }
      if (layout.attr.hasOwnProperty("@_center-top")) {
        this.bounds.original.center.top = this.constructor.positionPreParse(layout.attr["@_center-top"]);
      }
      // manual flag
      if (layout.attr.hasOwnProperty("@_manual")) {
        this.manual = (layout.attr["@_manual"] == "true");
      }
    }
    // Read child elements
    this.addChildren(layout);
  }

  addChildren(layout) {
    if (layout.hasOwnProperty("color")) {
      if (!Array.isArray(layout.color)) {
        layout.color = [ layout.color ];
      }
      for (let i = 0; i < layout.color.length; i++) {
        this.colors.push( Color.fromObject(layout.color[i]) )
      }
    }
    if (layout.hasOwnProperty("include")) {
      if (!Array.isArray(layout.include)) {
        layout.include = [ layout.include ];
      }
      for (let i = 0; i < layout.include.length; i++) {
        this.children.push(
          this.constructor.fromXmlFile( path.resolve(this.basePath, layout.include[i].attr["@_file"]), {}, this, this.basePath )
        );
      }
    }
    if (layout.hasOwnProperty("layout")) {
      if (!Array.isArray(layout.layout)) {
        layout.layout = [ layout.layout ];
      }
      for (let i = 0; i < layout.layout.length; i++) {
        this.children.push( this.constructor.fromObject(layout.layout[i], this.basePath, this) )
      }
    }
    if (layout.hasOwnProperty("filter")) {
      if (!Array.isArray(layout.filter)) {
        layout.filter = [ layout.filter ];
      }
      for (let i = 0; i < layout.filter.length; i++) {
        this.filters.push( Filter.fromObject(this, layout.filter[i]) )
      }
    }
  }

  apply(image) {
    let result = Promise.resolve(image);
    // Apply filters
    for (let i = 0; i < this.filters.length; i++) {
      result = result.then((image) => {
        return this.filters[i].apply(image);
      });
    }
    // Apply child layouts
    result = result.then((image) => {
      let results = [ [this, image] ];
      let childPromises = [ Promise.resolve([this, image]) ];
      for (let i = 0; i < this.children.length; i++) {
        this.children[i].setScale( image.bitmap.width, image.bitmap.height );
        if (this.children[i].manual) {
          continue;
        }
        childPromises.push(
          this.children[i].apply( this.children[i].cropParentImage(image) ).then((childResults) => {
            results.push(...childResults);
          })
        );
      }
      return Promise.all(childPromises).then(() => {
        return Promise.resolve(results);
      });
    });
    // Return results
    return result;
  }

  applyFromScreen(app) {
    return app.screenshotCapture({ crop: this.getCropArea() }).then((screenshot) => {
      // Apply layout
      return this.apply(screenshot);
    });
  }

  cropParentImage(image, clone = true) {
    if (clone) {
      image = image.clone();
    }
    return image.crop( this.bounds.computed.left, this.bounds.computed.top, this.bounds.computed.width, this.bounds.computed.height );
  }

  getAbsoluteBounds() {
    let result = Object.assign({}, this.bounds.computed);
    let parent = this.parent;
    while (parent !== null) {
      this.constructor.stackBounds(result, parent.bounds.computed);
      parent = parent.parent;
    }
    return result;
  }

  getCropArea() {
    let absoluteBounds = this.getAbsoluteBounds();
    return {
      size: { width: absoluteBounds.width, height: absoluteBounds.height },
      offset: { x: absoluteBounds.left, y: absoluteBounds.top }
    };
  }

  getColorsById(id) {
    let result = [];
    // Check local colors
    for (let i = 0; i < this.colors.length; i++) {
      if (this.colors[i].id === id) {
        result.push(this.colors[i]);
      }
    }
    if (result.length > 0) {
      return result;
    }
    if (this.parent !== null) {
      // Check parent element
      return this.parent.getColorsById(id);
    } else {
      // No colors found by id, convert from css to color object
      return [ Color.fromCss(id) ];
    }
  }

  /**
   * @param id
   * @returns {Layout|null}
   */
  getById(id) {
    if (this.id === id) {
      return this;
    } else {
      for (let i = 0; i < this.children.length; i++) {
        if ((this.children[i].namespace === null) || (id.indexOf(this.children[i].namespace) === 0)) {
          let layout = this.children[i].getById(id);
          if (layout !== null) {
            return layout;
          }
        }
      }
      return null;
    }
  }

  setScale(width, height) {
    if ((this.bounds.scale.width === width) && (this.bounds.scale.height === height)) {
      // Already at correct scale
      return;
    }
    this.bounds.scale.width = width;
    this.bounds.scale.height = height;
    // Reset computed bounds
    this.bounds.computed = this.constructor.createBounds();
    // Convert left, right, center-left and width
    if (this.bounds.original.left !== null) {
      this.bounds.computed.left = this.constructor.positionResolve(this.bounds.original.left, width);
    }
    if (this.bounds.original.right !== null) {
      this.bounds.computed.right = this.constructor.positionResolve(this.bounds.original.right, width);
    }
    if (this.bounds.original.center.left !== null) {
      this.bounds.computed.center.left = this.constructor.positionResolve(this.bounds.original.center.left, width);
    }
    if (this.bounds.original.width !== null) {
      this.bounds.computed.width = this.constructor.positionResolve(this.bounds.original.width, width);
    }
    // Convert top, bottom, center-top and height
    if (this.bounds.original.top !== null) {
      this.bounds.computed.top = this.constructor.positionResolve(this.bounds.original.top, height);
    }
    if (this.bounds.original.bottom !== null) {
      this.bounds.computed.bottom = this.constructor.positionResolve(this.bounds.original.bottom, height);
    }
    if (this.bounds.original.center.top !== null) {
      this.bounds.computed.center.top = this.constructor.positionResolve(this.bounds.original.center.top, height);
    }
    if (this.bounds.original.height !== null) {
      this.bounds.computed.height = this.constructor.positionResolve(this.bounds.original.height, height);
    }
    // Calculate width (if unknown)
    if (this.bounds.computed.width === null) {
      if ((this.bounds.computed.left !== null) && (this.bounds.computed.right !== null)) {
        this.bounds.computed.width = (width - this.bounds.computed.right) - this.bounds.computed.left;
      } else if ((this.bounds.computed.right !== null) && (this.bounds.computed.center.left !== null)) {
        this.bounds.computed.width = ((width - this.bounds.computed.right) - this.bounds.computed.center.left) * 2;
      } else if ((this.bounds.computed.left !== null) && (this.bounds.computed.center.left !== null)) {
        this.bounds.computed.width = (this.bounds.computed.center.left - this.bounds.computed.left) * 2;
      } else {
        this.bounds.computed.width = width;
      }
    }
    // Calculate left (if unknown)
    if (this.bounds.computed.left === null) {
      if (this.bounds.computed.right !== null) {
        this.bounds.computed.left = (width - this.bounds.computed.right) - this.bounds.computed.width;
      } else if (this.bounds.computed.center.left !== null) {
        this.bounds.computed.left = this.bounds.computed.center.left - this.bounds.computed.width / 2;
      } else {
        this.bounds.computed.left = 0;
      }
    }
    // Calculate right (if unknown)
    if (this.bounds.computed.right === null) {
      this.bounds.computed.right = width - (this.bounds.computed.left + this.bounds.computed.width);
    }
    // Calculate center-left (if unknown)
    if (this.bounds.computed.center.left === null) {
      this.bounds.computed.center.left = this.bounds.computed.left + this.bounds.computed.width / 2;
    }
    // Calculate height (if unknown)
    if (this.bounds.computed.height === null) {
      if ((this.bounds.computed.top !== null) && (this.bounds.computed.bottom !== null)) {
        this.bounds.computed.height = (height - this.bounds.computed.bottom) - this.bounds.computed.top;
      } else if ((this.bounds.computed.bottom !== null) && (this.bounds.computed.center.top !== null)) {
        this.bounds.computed.height = ((height - this.bounds.computed.bottom) - this.bounds.computed.center.top) * 2;
      } else if ((this.bounds.computed.top !== null) && (this.bounds.computed.center.top !== null)) {
        this.bounds.computed.height = (this.bounds.computed.center.top - this.bounds.computed.top) * 2;
      } else {
        this.bounds.computed.height = height;
      }
    }
    // Calculate top (if unknown)
    if (this.bounds.computed.top === null) {
      if (this.bounds.computed.bottom !== null) {
        this.bounds.computed.top = (height - this.bounds.computed.bottom) - this.bounds.computed.height;
      } else if (this.bounds.computed.center.top !== null) {
        this.bounds.computed.top = this.bounds.computed.center.top - this.bounds.computed.height / 2;
      } else {
        this.bounds.computed.top = 0;
      }
    }
    // Calculate bottom (if unknown)
    if (this.bounds.computed.bottom === null) {
      this.bounds.computed.bottom = height - (this.bounds.computed.top + this.bounds.computed.height);
    }
    // Calculate center-left (if unknown)
    if (this.bounds.computed.center.top === null) {
      this.bounds.computed.center.top = this.bounds.computed.top + this.bounds.computed.height / 2;
    }
    // Scale childs
    for (let i = 0; i < this.children.length; i++) {
      this.children[i].setScale( this.bounds.computed.width, this.bounds.computed.height );
    }
    return this;
  }

}

module.exports = Layout;