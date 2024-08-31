/**
 * Obfuscate value
 *
 * @param {*} value
 * @return {*}
 */
function obfuscateValue(value) {
  if (typeof value === 'string') {
    if (value.length > 2) {
      return `${value[0]}[${value.length - 2}]${value[value.length - 1]}`;
    }
    return `[${value.length}]`;
  }

  if (typeof value === 'number') {
    return '*'.repeat(`${value}`.length);
  }

  if (typeof value === 'object' && value !== null) {
    for (const key in value) {
      if (value.hasOwnProperty(key)) {
        value[key] = obfuscateValue(value[key]);
      }
    }
  }

  return value;
}

/**
 * Obfuscate an object
 *
 * @param {*} input
 * @return {*}
 */
function obfuscate(input) {
  // If the input is a JSON object, recursively obfuscate its keys
  if (typeof input === 'object' && input !== null) {
    return obfuscateValue(input);
  }
  // If the input is a string or number, obfuscate accordingly
  return obfuscateValue(input);
}

module.exports = {
  obfuscate,
  obfuscateValue,
};
