'use strict';

const innerRegex = /[#@] sourceMappingURL=([^\s'"]*)/;
const regex = new RegExp(
  '(?:' +
    '/\\*' +
    '(?:\\s*\r?\n(?://)?)?' +
    '(?:' + innerRegex.source + ')' +
    '\\s*' +
    '\\*/' +
    '|' +
    '//(?:' + innerRegex.source + ')' +
  ')' +
  '\\s*$'
);

module.exports = {
  regex,
  _innerRegex: innerRegex,
  getFrom(code) {
    const match = code.match(regex);
    return match ? (match[1] || match[2] || '') : null;
  },
  existsIn(code) {
    return regex.test(code);
  },
  removeFrom(code) {
    return code.replace(regex, '');
  },
  insertBefore(code, string) {
    const match = code.match(regex);
    if (match) {
      return code.slice(0, match.index) + string + code.slice(match.index);
    }
    return code + string;
  },
};
