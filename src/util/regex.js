let number = '(?:[-+]?(?:(?:\\d+|\\d*\\.\\d+)(?:[Ee][+-]?\\d+)?))';

let rgba = 'rgb[a]?\\((' + number + '[%]?)\\s*,\\s*(' + number + '[%]?)\\s*,\\s*(' + number + '[%]?)(?:\\s*,\\s*(' + number + '))?\\)';
let rgbaNoBackRefs = 'rgb[a]?\\((?:' + number + '[%]?)\\s*,\\s*(?:' + number + '[%]?)\\s*,\\s*(?:' + number + '[%]?)(?:\\s*,\\s*(?:' + number + '))?\\)';

let hsla = 'hsl[a]?\\((' + number + ')\\s*,\\s*(' + number + '[%])\\s*,\\s*(' + number + '[%])(?:\\s*,\\s*(' + number + '))?\\)';
let hslaNoBackRefs = 'hsl[a]?\\((?:' + number + ')\\s*,\\s*(?:' + number + '[%])\\s*,\\s*(?:' + number + '[%])(?:\\s*,\\s*(?:' + number + '))?\\)';

let hex3 = '\\#[0-9a-fA-F]{3}';
let hex6 = '\\#[0-9a-fA-F]{6}';

let colorName = '[a-zA-Z]+';
let colorNameRgbaHslaOrHex = '(' + colorName + '|' + rgba + '|' + hsla + '|' + hex3 + '|' + hex6 + ')';
let gradientArguemnts = ',\\s*' + colorNameRgbaHslaOrHex + '\\s*';
let gradient = 'linear-gradient\\(\\s*auto\\s*(' + gradientArguemnts + '){2,}\\)';

module.exports = {
  regex: {
    number: number,
    rgba: rgba,
    rgbaNoBackRefs: rgbaNoBackRefs,
    hsla: hsla,
    hslaNoBackRefs: hslaNoBackRefs,
    hex3: hex3,
    hex6: hex6,
    gradient: gradient,
    gradientArguemnts: gradientArguemnts
  }
};
