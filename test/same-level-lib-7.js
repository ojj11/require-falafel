const dependency = require("./same-level-lib-7-dependency.js");

module.exports = {
  userAgent: "lib-7",
  dependentUserAgent: dependency.userAgent
};
