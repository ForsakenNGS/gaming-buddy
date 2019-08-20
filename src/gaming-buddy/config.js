// Nodejs dependencies
const fs = require('fs');
const path = require('path');
const he = require('he');
const xmlParser = require('fast-xml-parser');

class Config {

  constructor(pluginName, configPath) {
    // Initialize
    this.pluginName = pluginName;
    this.structure = null;
    this.values = {};
    // Load structure
    let xmlFile = path.resolve(configPath, "config.xml");
    if (fs.existsSync(xmlFile)) {
      let options = {
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
      };
      let xmlData = fs.readFileSync(xmlFile).toString();
      if (!xmlParser.validate(xmlData)) {
        throw new Error("Configuration invalid! ("+xmlFile+")");
      }
      this.structure = xmlParser.parse(xmlData, options);
      this.cleanupStructure();
    }
    let jsonFile = path.resolve(configPath, "config.json");
    if (fs.existsSync(jsonFile)) {
      Object.assign(this.values, require(jsonFile));
    }
  }

  cleanupStructure() {
    // Sections
    if (!Array.isArray(this.structure.config.section)) {
      this.structure.config.section = [ this.structure.config.section ];
    }
    for (let i = 0; i < this.structure.config.section.length; i++) {
      if (this.structure.config.section[i].attr.hasOwnProperty('@_name') && this.structure.config.section[i].attr.hasOwnProperty('@_default')) {
        // Section default value
        let sectionName = this.structure.config.section[i].attr['@_name'];
        let defaultValue = this.structure.config.section[i].attr['@_default'];
        switch (defaultValue) {
          case "true":
            this.values[sectionName] = true;
            break;
          case "false":
            this.values[sectionName] = false;
            break;
          default:
            this.values[sectionName] = defaultValue;
            break;
        }
      }
      if (!Array.isArray(this.structure.config.section[i].value)) {
        this.structure.config.section[i].value = [ this.structure.config.section[i].value ];
      }
      for (let v = 0; v < this.structure.config.section[i].value.length; v++) {
        // Options
        let valueName = this.structure.config.section[i].value[v].attr['@_name'];
        if (!this.values.hasOwnProperty(valueName)) {
          let defaultValue = this.structure.config.section[i].value[v].attr['@_default'];
          switch (defaultValue) {
            case "true":
              this.values[valueName] = true;
              break;
            case "false":
              this.values[valueName] = false;
              break;
            default:
              this.values[valueName] = defaultValue;
              break;
          }
        }
        switch (this.structure.config.section[i].value[v].attr['@_type']) {
          case "select":
            if (!Array.isArray(this.structure.config.section[i].value[v].option)) {
              this.structure.config.section[i].value[v].option = [ this.structure.config.section[i].value[v].option ];
            }
            break;
        }
      }
    }
  }

  /**
   * Get the structure object for the given config section
   * @param name
   * @returns {null|*}
   */
  getStructureSection(name) {
    for (let i = 0; i < this.structure.config.section.length; i++) {
      if (this.structure.config.section[i].attr.hasOwnProperty('@_name') &&
        (this.structure.config.section[i].attr['@_name'] === name)) {
        return this.structure.config.section[i];
      }
    }
    return null;
  }

  /**
   * Get the structure object for the given config value
   * @param name
   * @returns {null|*}
   */
  getStructureValue(name) {
    for (let i = 0; i < this.structure.config.section.length; i++) {
      for (let v = 0; v < this.structure.config.section[i].value.length; v++) {
        if (this.structure.config.section[i].value[v].attr.hasOwnProperty('@_name') &&
          (this.structure.config.section[i].value[v].attr['@_name'] === name)) {
          return this.structure.config.section[i].value[v];
        }
      }
    }
    return null;
  }

  /**
   * Set the available options for a configuration option of the type "select"
   * @param name
   * @param options
   * @returns {boolean}
   */
  setSelectOptions(name, options) {
    let structureValue = this.getStructureValue(name);
    if (structureValue === null) {
      return false;
    }
    structureValue.option = [];
    for (let optionValue in options) {
      structureValue.option.push({
        '#text': options[optionValue],
        'attr': {
          '@_value': optionValue
        }
      });
    }
  }

  toJSON() {
    return {
      pluginName: this.pluginName,
      structure: this.structure,
      values: this.values
    };
  }

}

module.exports = Config;