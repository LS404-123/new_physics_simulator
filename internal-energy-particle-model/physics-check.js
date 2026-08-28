"use strict";

const assert = require("node:assert/strict");
const { energyFor, normalizeObject, predictionsAreCorrect } = require("./model.js");

function assertAlmostEqual(actual, expected) {
  assert(Math.abs(actual - expected) < 1e-9, `${actual} 應等於 ${expected}`);
}

const small = energyFor({ mass: 100, temperature: 25, phase: "water" });
const large = energyFor({ mass: 300, temperature: 25, phase: "water" });
assert.equal(large.meanKinetic, small.meanKinetic);
assertAlmostEqual(large.kinetic, small.kinetic * 3);
assert.equal(large.potential, small.potential * 3);
assertAlmostEqual(large.internal, small.internal * 3);

const cold = energyFor({ mass: 200, temperature: 10, phase: "water" });
const hot = energyFor({ mass: 200, temperature: 80, phase: "water" });
assert(hot.kinetic > cold.kinetic);
assert.equal(hot.potential, cold.potential);

const ice = energyFor({ mass: 200, temperature: 0, phase: "ice" });
const water = energyFor({ mass: 200, temperature: 0, phase: "water" });
assert.equal(ice.kinetic, water.kinetic);
assert(water.potential > ice.potential);
assert.equal(water.internal, water.kinetic + water.potential);

assert.deepEqual(
  normalizeObject({ mass: 700, temperature: 60, phase: "ice" }),
  { mass: 500, temperature: 0, phase: "ice" }
);
assert.deepEqual(
  normalizeObject({ mass: 50, temperature: -10, phase: "water" }),
  { mass: 100, temperature: 0, phase: "water" }
);

assert.equal(predictionsAreCorrect("B", "B"), true);
assert.equal(predictionsAreCorrect("A", "B"), false);
assert.equal(predictionsAreCorrect("B", "same"), false);

console.log("物理檢查通過：質量、溫度、物態及 U = KE + PE 的關係正確。");
