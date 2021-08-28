const assert = require("assert");
const RequireFalafel = require("../lib.js");

describe("Require-Falafel", function() {

  function makeUserAgentReplacer(typeOfReplacement) {
    return new RequireFalafel(
      typeOfReplacement,
      function (node) {
        if (node.type == "Literal" && node.value == "lib-7") {
          node.update(`"github.com/ojj11/require-falafel"`);
        }
      });
  }

  afterEach(function() {
    // clear the require cache, so we're executing on a clean environment each
    // time
    Object.keys(require.cache).forEach((key) => {
      delete require.cache[key];
    });
  });

  it("should work for given README example", function() {
    const transformation = makeUserAgentReplacer(RequireFalafel.INCLUDE_NODE_MODULES);
    transformation.applyForBlock(function() {
      const lib7 = require("./fake_node_modules/lib-7.js");
      assert.equal("github.com/ojj11/require-falafel", lib7.userAgent);
    });
  });

  it("should return require cache back to normal after operation", function() {
    const transformation = makeUserAgentReplacer(RequireFalafel.INCLUDE_NODE_MODULES);
    transformation.applyForBlock(function() {
      const lib7 = require("./fake_node_modules/lib-7.js");
      assert.equal("github.com/ojj11/require-falafel", lib7.userAgent);

      const internalLib7 = require("./same-level-lib-7.js");
      assert.equal("github.com/ojj11/require-falafel", internalLib7.userAgent);
    });

    const lib7 = require("./fake_node_modules/lib-7.js");
    assert.equal("lib-7", lib7.userAgent);
    assert.equal("lib-7", lib7.dependentUserAgent);

    const internalLib7 = require("./same-level-lib-7.js");
    assert.equal("lib-7", internalLib7.userAgent);
    assert.equal("lib-7", internalLib7.dependentUserAgent);
  });

  it("should replace all node_modules when INCLUDE_NODE_MODULES is set", function() {
    const transformation = makeUserAgentReplacer(RequireFalafel.INCLUDE_NODE_MODULES);
    transformation.applyForBlock(function() {
      const lib7 = require("./fake_node_modules/lib-7.js");
      assert.equal("github.com/ojj11/require-falafel", lib7.userAgent);
      assert.equal("github.com/ojj11/require-falafel", lib7.dependentUserAgent);

      const internalLib7 = require("./same-level-lib-7.js");
      assert.equal("github.com/ojj11/require-falafel", internalLib7.userAgent);
      assert.equal("github.com/ojj11/require-falafel", internalLib7.dependentUserAgent);
    });
  });

  it("should only replace top-level modules when INCLUDE_FIRST_LEVEL_NODE_MODULES is set", function() {
    if (!module.parent.path) {
      // this is only supported in node v11+
      this.skip();
    }
    const transformation = makeUserAgentReplacer(RequireFalafel.INCLUDE_FIRST_LEVEL_NODE_MODULES);
    transformation.applyForBlock(function() {
      const lib7 = require("./fake_node_modules/lib-7.js");
      assert.equal("github.com/ojj11/require-falafel", lib7.userAgent);
      assert.equal("lib-7", lib7.dependentUserAgent);

      const internalLib7 = require("./same-level-lib-7.js");
      assert.equal("github.com/ojj11/require-falafel", internalLib7.userAgent);
      assert.equal("github.com/ojj11/require-falafel", internalLib7.dependentUserAgent);
    });
  });

  it("should not replace node_modules when INCLUDE_NO_NODE_MODULES is set", function() {
    if (!module.parent.path) {
      // this is only supported in node v12+
      this.skip();
    }
    const transformation = makeUserAgentReplacer(RequireFalafel.INCLUDE_NO_NODE_MODULES);
    transformation.applyForBlock(function() {
      const lib7 = require("./fake_node_modules/lib-7.js");
      assert.equal("lib-7", lib7.userAgent);
      assert.equal("lib-7", lib7.userAgent);

      const internalLib7 = require("./same-level-lib-7.js");
      assert.equal("github.com/ojj11/require-falafel", internalLib7.userAgent);
      assert.equal("github.com/ojj11/require-falafel", internalLib7.dependentUserAgent);
    });
  });

  it("should replace matching paths", function() {
    const transformation = makeUserAgentReplacer([require.resolve("./fake_node_modules/lib-7.js")]);
    transformation.applyForBlock(function() {
      const lib7 = require("./fake_node_modules/lib-7.js");
      assert.equal("github.com/ojj11/require-falafel", lib7.userAgent);
    });
  });

  it("should not replace non-matching paths", function() {
    const transformation = makeUserAgentReplacer(['']);
    transformation.applyForBlock(function() {
      const lib7 = require("./fake_node_modules/lib-7.js");
      assert.equal("lib-7", lib7.userAgent);
    });
  });

  it("should work for inline code", function() {
    const transformation = makeUserAgentReplacer(RequireFalafel.INCLUDE_NODE_MODULES);

    transformation.replaceRequire();

    const firstLib7 = require("./fake_node_modules/lib-7.js");
    assert.equal("github.com/ojj11/require-falafel", firstLib7.userAgent);
    assert.equal("github.com/ojj11/require-falafel", firstLib7.userAgent);

    const firstInternalLib7 = require("./same-level-lib-7.js");
    assert.equal("github.com/ojj11/require-falafel", firstInternalLib7.userAgent);
    assert.equal("github.com/ojj11/require-falafel", firstInternalLib7.dependentUserAgent);

    transformation.restoreRequire();

    const secondLib7 = require("./fake_node_modules/lib-7.js");
    assert.equal("lib-7", secondLib7.userAgent);
    assert.equal("lib-7", secondLib7.dependentUserAgent);

    const secondInternalLib7 = require("./same-level-lib-7.js");
    assert.equal("lib-7", secondInternalLib7.userAgent);
    assert.equal("lib-7", secondInternalLib7.dependentUserAgent);

  });

  it("should propogate compile errors", function() {
    try {
      const transformation = new RequireFalafel(
        RequireFalafel.INCLUDE_NODE_MODULES,
        function (node) {
          if (node.type == "Literal" && node.value == "lib-7") {
            node.update("invalid ~ javascript");
          }
        });
      transformation.applyForBlock(function() {
        require("./fake_node_modules/lib-7.js");
      });
      assert.fail("unreachable");
    } catch (e) {
      assert.equal("Unexpected token", e.message.slice(0, 16));
    }
  });

  it("should throw when invalid typeOfReplacement given", function() {
    try {
      const transformation = new RequireFalafel(
        17,
        function (node) {
          if (node.type == "Literal" && node.value == "lib-7") {
            node.update("invalid ~ javascript");
          }
        });
      transformation.applyForBlock(function() {
        require("./fake_node_modules/lib-7.js");
      });
      assert.fail("unreachable");
    } catch (e) {
      assert.equal(
        "new RequireFalafel(type, transform) called with unexpected type parameter",
        e.message
      );
    }
  });

  it("should work with async functions", async function() {
    const transformation = makeUserAgentReplacer(RequireFalafel.INCLUDE_NODE_MODULES);

    // the require hook will keep working until the transformation is `await`ed
    await transformation.applyForBlock(async function() {
      const promise = new Promise((resolve) => {
        setImmediate(function() {
          const lib7 = require("./fake_node_modules/lib-7.js");
          assert.equal("github.com/ojj11/require-falafel", lib7.userAgent);
          resolve();
        });
      });
      await promise;
    });

    const lib7 = require("./fake_node_modules/lib-7.js");
    assert.equal("lib-7", lib7.userAgent);
    assert.equal("lib-7", lib7.dependentUserAgent);
  });

  it("should work with failing async functions", async function() {
    const transformation = makeUserAgentReplacer(RequireFalafel.INCLUDE_NODE_MODULES);

    // the require hook will keep working until the transformation is `await`ed
    const failingBlock = transformation.applyForBlock(async function() {
      const promise = new Promise((resolve, reject) => {
        setImmediate(function() {
          reject(new Error("failing block"));
        });
      });
      await promise;
    });

    try {
      await failingBlock;
      assert.fail("unreachable");
    } catch(e) {
      // drop - expected.
    }

    // require hook should still be removed after `await`
    const lib7 = require("./fake_node_modules/lib-7.js");
    assert.equal("lib-7", lib7.userAgent);
    assert.equal("lib-7", lib7.dependentUserAgent);
  });
});
