const util = require("util");
const vm = require("vm");
const fs = require("fs");
const falafel = require("falafel");
const {dirname, relative} = require("path");
const Module = require("module");

function isNodeModule(path) {
  if (module.parent.path == undefined) {
    throw new Error("INCLUDE_FIRST_LEVEL_NODE_MODULES and INCLUDE_NO_NODE_MODULES are not supported on this version of node");
  }
  const relativePath = relative(module.parent.path, path);
  return relativePath.indexOf("node_modules") != -1;
}

function RequireFalafel(typeOfReplacement, transformer) {
  const originalCompile = Module.prototype._compile;
  this.originalCompile = originalCompile;
  this.originalCache = Object.keys(require.cache);
  this.typeOfReplacement = typeOfReplacement;
  this.newCompile = function FalafelCompile(content, path) {

    let shouldSwap = false;
    if (typeOfReplacement == RequireFalafel.INCLUDE_NO_NODE_MODULES) {
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
  let output;
  try {
    output = block();
    return output;
  } finally {
    if (util.types.isPromise(output)) {
      const restoreRequire = this.restoreRequire.bind(this);
      return (async function(requireFalafel) {
        try {
          return await output;
        } finally {
          requireFalafel.restoreRequire();
        }
      })(this);
    } else {
      this.restoreRequire();
    }
  }
};

RequireFalafel.prototype.replaceRequire = function() {
  Module.prototype._compile = this.newCompile;
};

RequireFalafel.prototype.restoreRequire = function() {
  Module.prototype._compile = this.originalCompile;
  Object.keys(require.cache)
    .filter((key) => this.originalCache.indexOf(key) == -1)
    .forEach((key) => {
      delete require.cache[key];
    });
};

module.exports = RequireFalafel;
