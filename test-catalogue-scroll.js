"use strict";

const assert = require("node:assert/strict");
const { getCatalogueScrollState } = require("./simulations.js");

const dockTop = 200;

assert.deepEqual(getCatalogueScrollState(1000, 0, dockTop), {
  progress: 0,
});
assert.deepEqual(getCatalogueScrollState(600, 400, dockTop), {
  progress: 0.5,
});
assert.deepEqual(getCatalogueScrollState(200, 800, dockTop), {
  progress: 1,
});
assert.deepEqual(getCatalogueScrollState(-700, 1700, dockTop), {
  progress: 1,
});

console.log("catalogue scroll state: ok");
