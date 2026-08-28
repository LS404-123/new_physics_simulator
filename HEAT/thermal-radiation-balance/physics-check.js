"use strict";

const assert = require("node:assert/strict");
const model = require("./model.js");

const closeTo = (actual, expected, tolerance = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);
};

closeTo(model.toKelvin(0), 273.15);
closeTo(model.emittedPower(0), 8.9250146603, 1e-9);

const hotterObject = model.powers(80, 25);
assert.ok(hotterObject.emitted > hotterObject.absorbed);
assert.ok(hotterObject.net > 0);
assert.equal(model.role(80, 25), "emitter");
assert.ok(model.stepTemperature(80, 25, 1 / 60) < 80);

const hotterEnvironment = model.powers(80, 200);
assert.ok(hotterEnvironment.absorbed > hotterEnvironment.emitted);
assert.ok(hotterEnvironment.net < 0);
assert.equal(model.role(80, 200), "absorber");
assert.ok(model.stepTemperature(80, 200, 1 / 60) > 80);

const equal = model.powers(80, 80);
assert.ok(equal.emitted > 0);
closeTo(equal.emitted, equal.absorbed);
closeTo(equal.net, 0);
assert.equal(model.role(80, 80), "equilibrium");

assert.equal(model.stepTemperature(249, 250, 60), 250);
assert.equal(model.stepTemperature(-19, -20, 60), -20);

console.log("熱輻射物理檢查通過");
