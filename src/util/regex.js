export let number = '(?:[-+]?(?:(?:\\d+|\\d*\\.\\d+)(?:[Ee][+-]?\\d+)?))';

export let rgba = 'rgb[a]?\\((' + number + '[%]?)\\s*,\\s*(' + number + '[%]?)\\s*,\\s*(' + number + '[%]?)(?:\\s*,\\s*(' + number + '))?\\)';
export let rgbaNoBackRefs = 'rgb[a]?\\((?:' + number + '[%]?)\\s*,\\s*(?:' + number + '[%]?)\\s*,\\s*(?:' + number + '[%]?)(?:\\s*,\\s*(?:' + number + '))?\\)';

export let hsla = 'hsl[a]?\\((' + number + ')\\s*,\\s*(' + number + '[%])\\s*,\\s*(' + number + '[%])(?:\\s*,\\s*(' + number + '))?\\)';
export let hslaNoBackRefs = 'hsl[a]?\\((?:' + number + ')\\s*,\\s*(?:' + number + '[%])\\s*,\\s*(?:' + number + '[%])(?:\\s*,\\s*(?:' + number + '))?\\)';

export let hex3 = '\\#[0-9a-fA-F]{3}';
export let hex6 = '\\#[0-9a-fA-F]{6}';
