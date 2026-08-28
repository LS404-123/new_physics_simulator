"use strict";

const assert = require("node:assert/strict");
const { slope, heightAt } = require("./model.js");

assert.equal(slope(2, 62), 0.6);
assert.equal(heightAt(0, 2, 62), 2);
assert.equal(heightAt(50, 2, 62), 32);
assert.equal(heightAt(100, 2, 62), 62);
assert.equal(slope(9, 10), 0.01);
assert.equal(heightAt(100, 9, 10), 10);
assert.equal(slope(0, 100), 1.0);
assert.equal(heightAt(50, 0, 100), 50);
assert.equal(heightAt(100, 0, 100), 100);

console.log("物理檢查通過：固定點、斜率及線性插值結果正確。");

