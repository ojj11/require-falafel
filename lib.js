const vm = require("vm");
const moduleInternals = require("module");
const fs = require("fs");
const falafel = require("falafel");
const dirname = require("path").dirname;
const relative = require("path").relative;

function isNodeModule(path) {
  const relativePath = relative(module.parent.path, path);
  return relativePath.indexOf("node_modules") != -1;
}

function RequireFalafel(typeOfReplacement, transformer) {
  const originalCompile = moduleInternals.prototype._compile;
  this.originalCompile = originalCompile;
  this.originalCache = Object.keys(require.cache);
  this.typeOfReplacement = typeOfReplacement;
  this.newCompile = function FalafelCompile(content, path) {

    let shouldSwap = false;
    if (!typeOfReplacement || typeOfReplacement == RequireFalafel.INCLUDE_NO_NODE_MODULES) {
      shouldSwap = !isNodeModule(path);
    }

    if (typeOfReplacement == RequireFalafel.INCLUDE_FIRST_LEVEL_NODE_MODULES) {
      shouldSwap = !isNodeModule(this.parent.path);
    }

    if (typeOfReplacement == RequireFalafel.INCLUDE_NODE_MODULES) {
      shouldSwap = true;
    }

    if (shouldSwap) {
      originalCompile.call(
        this,
        falafel(content, transformer).toString(),
        path);
    } else {
      originalCompile.call(this, content, path);
    }
  };
}

RequireFalafel.INCLUDE_NO_NODE_MODULES = 1;
RequireFalafel.INCLUDE_FIRST_LEVEL_NODE_MODULES = 2;
RequireFalafel.INCLUDE_NODE_MODULES = 3;

RequireFalafel.prototype.applyForBlock = function(block) {
  this.replaceRequire();
  try {
    block();
  } finally {
    this.restoreRequire();
  }
};

RequireFalafel.prototype.replaceRequire = function() {
  moduleInternals.prototype._compile = this.newCompile;
};

RequireFalafel.prototype.restoreRequire = function() {
  moduleInternals.prototype._compile = this.originalCompile;
  Object.keys(require.cache)
    .filter((key) => this.originalCache.indexOf(key) == -1)
    .forEach((key) => {
      delete require.cache[key];
    });
};

module.exports = RequireFalafel;
