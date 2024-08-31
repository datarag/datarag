/* eslint-disable no-console */
module.exports = {
  error: (text) => {
    console.log('\x1b[31m%s\x1b[0m', text);
  },
  print: (text) => {
    console.log('\x1b[32m%s\x1b[0m', text);
  },
};
