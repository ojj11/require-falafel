Require-Falafel
===============

![Node.js CI](https://github.com/ojj11/require-falafel/workflows/Node.js%20CI/badge.svg) [![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fojj11%2Frequire-falafel.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fojj11%2Frequire-falafel?ref=badge_shield)

**Use [falafel](https://www.npmjs.com/package/falafel) to rewrite require'd
modules in node.**

Hook into node's require command to rewrite the module's AST (in memory) before
loading.

    Author: Olli Jones
    License: MIT

```zsh
npm install require-falafel --save
```

## Introduction

[Falafel](https://www.npmjs.com/package/falafel) uses
[Acorn](https://npmjs.org/package/acorn) to transform a
[JavaScript AST](https://github.com/estree/estree/blob/master/es5.md).
Require-falafel hooks into node's require method in order to transform the AST
of modules as they're loaded.

For example, if we have a library "lib-7" which makes web requests with an
unhelpful user-agent string:

```JavaScript
const fetch = require("node-fetch");
module.exports = {
  get: function() {
    fetch("https://www.example.com", {
      headers: { "User-Agent": "lib-7" },
    })
  }
}
```

This code snippet contains lots of
[AST nodes](https://github.com/estree/estree/blob/master/es5.md) including 4
[Literal](https://github.com/estree/estree/blob/master/es5.md#literal)s. We can
see these Literal nodes will be:

```JSON
{
  "type": "Literal",
  "value": "node-fetch"
}
{
  "type": "Literal",
  "value": "https://www.example.com"
}
{
  "type": "Literal",
  "value": "User-Agent"
}
{
  "type": "Literal",
  "value": "lib-7"
}
```

Falafel provides `node.source()` and `node.update(s)` methods, so if we wanted
to replace the `"lib-7"` literal, to provide a better user-agent string for
tracking calls to the API from our new client, we can write a transform method
like:

```JavaScript
const transform = function (node) {
  // only change the right literal:
  if (node.type == "Literal" && node.value == "lib-7") {
    // node.source() will be "lib-7"
    let source = node.source();
    // we can update the source code (this is quoted JavaScript):
    source = `${source} + "-github.com/ojj11/require-falafel"`;
    // then we can update the AST node:
    node.update(source);
  }
}
```

We can use this method along with `RequireFalafel.INCLUDE_NODE_MODULES`, to
make an instance of `RequireFalafel` that we can apply to a block of code that
includes the `require` statements for `lib-7` that we want to transform:

```JavaScript
// wrap our code with a transformation before requiring the library:
const RequireFalafel = require("require-falafel");

const requireFalafel = new RequireFalafel(
  RequireFalafel.INCLUDE_NODE_MODULES,
  transform);

requireFalafel.applyForBlock(function() {

  // require-ing inside .applyForBlock will swap the internals of require to
  // apply falafel as the library is loaded:
  const lib7 = require("lib-7");

  // calling the library will use "lib-7-github.com/ojj11/require-falafel" as the
  // user-agent now.
  lib7.get();

});
```

Whilst this example is contrived, it is hopefully relatively straight-forward
to see how this library could be used to instrument code as it's loaded in a
test pass, or to enable certain developer flags in a development or staging
environment.

## API documentation

Load require-falafel:

```
const RequireFalafel = require("require-falafel");
```

### `new RequireFalafel(typeOfReplacement, transformer)`

Creates a new transformation for `require` methods, given a `typeOfReplacement`
and `transform` method, for example:

```javascript
const requireFalafel = new RequireFalafel(
  RequireFalafel.INCLUDE_NODE_MODULES,
  function (node) {
    if (node.type == "Literal" && node.value == "lib-7") {
      let source = node.source();
      source = `${source} + "-github.com/ojj11/require-falafel"`;
      node.update(source);
    }
  });
```

typeOfReplacement should be one of:

- `['/absolute/paths/to/files.js', require.resolve('module-names')]` will
  transform only the absolute paths specified in an array. Use
  `require.resolve` to get the absolute paths of libraries.
- `RequireFalafel.INCLUDE_NO_NODE_MODULES`, will transform `./` and `../`
  imports, but will not transform any npm modules in node_modules folders.
  Only available in node v11+.
- `RequireFalafel.INCLUDE_FIRST_LEVEL_NODE_MODULES` same as above, but will
  transform only the top level of node_modules that are imported from `./` or
  `../` code. Only available in node v11+.
- `RequireFalafel.INCLUDE_NODE_MODULES` the most liberal, will
  transform all require calls, even those inside node_modules

### `requireFalafel.applyForBlock(block)`

Runs the given `block`, replacing `require` calls to load code transformed
through the falafel transformer given on construction.

At the end of the block, resets the `require` method and clears any loaded
modules from `node`'s cache, so that a fresh `require` will get the correct
module.

For example:

```JavaScript
requireFalafel.applyForBlock(function() {
  const module2 = require("module2");
  // module2 will be transformed and loaded
});

const module2 = require("module2");
// module2 will be re-loaded, but not transformed because it's outside of the
// block
```

This method _will_ work async functions, but the require hook will continue to
apply until `await` is called:

```JavaScript
// always immediately await:
await requireFalafel.applyForBlock(async function() {
  const module2 = require("module2");
  // module2 will be transformed and loaded
});

const module2 = require("module2");
// module2 will be re-loaded, but not transformed because `await` has already
// been called on `applyForBlock`
```

### `requireFalafel.replaceRequire()`

For cases where supplying a block won't work, use `replaceRequire`, like so:

```JavaScript
requireFalafel.replaceRequire();
const transformedModule2 = require("module2");
// module2 will be transformed and loaded

requireFalafel.restoreRequire();
const untransformedModule2 = require("module2");
// module2 will be re-loaded, but not transformed because we restored the
// require method
```

### `requireFalafel.restoreRequire()`

Opposite of `requireFalafel.replaceRequire()` - restores the normal operation of
`require`.
