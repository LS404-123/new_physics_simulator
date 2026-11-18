"use strict";
const assert = require("node:assert/strict");
const L = require("./model.js");
const close = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} ≠ ${expected}`);
const initial = L.solve(27), critical = L.solve(L.CRITICAL);
close(initial.temperature, 300);
close(initial.airMass, 0.29);
close(initial.totalMass, 0.37);
close(initial.totalDensity, 1.48);
assert.equal(initial.status, "rest");
assert.equal(initial.outMolecules, 0);
close(critical.temperature, 414.2857142857143);
close(critical.airMass, 0.21);
close(critical.totalMass, 0.29);
close(critical.outMass, 0.08);
close(critical.totalDensity, L.RHO);
close(critical.netForce, 0);
assert.equal(critical.status, "neutral");
assert.equal(L.solve(L.CRITICAL - 0.01).status, "rest");
assert.equal(L.solve(L.CRITICAL + 0.01).status, "rise");
assert.equal((critical.outMolecules / 1e24).toFixed(2), "1.67");
let prior = initial;
for (let celsius = L.MIN; celsius <= L.MAX; celsius += 0.5) {
  const state = L.solve(celsius);
  close(state.molecules * L.R / L.NA * state.temperature, L.P * L.V);
  close(state.airDensity * state.temperature, L.RHO * L.T0);
  close(state.molecules + state.outMolecules, L.INITIAL_N);
  close(state.airMass + state.outMass, L.INITIAL_MASS);
  close(state.totalMass, L.M + state.airMass);
  close(state.buoyancy, initial.buoyancy);
  close(state.weight - state.buoyancy, (state.totalDensity - L.RHO) * L.V * L.G);
  assert.ok(state.molecules <= prior.molecules && state.weight <= prior.weight);
  const portions = L.portions(state);
  assert.equal(portions.length, 100);
  assert.ok(portions.every(p => p >= 0 && p <= 1));
  close(portions.reduce((sum, p) => sum + p, 0), state.fraction * 100);
  const dark = L.solve(celsius, "dark");
  close(dark.radiation, state.radiation * 6);
  for (const key of ["temperature", "molecules", "totalMass", "netForce"]) close(dark[key], state[key]);
  prior = state;
}
close(initial.radiation, 0);
close(L.heat(27, 1), 39);
close(L.heat(219, 10), L.MAX);
for (const value of [NaN, Infinity, -Infinity, 26.9, 220.1]) assert.throws(() => L.solve(value), RangeError);
assert.throws(() => L.solve(100, "unknown"), RangeError);
assert.throws(() => L.heat(100, -1), RangeError);
const stages = new Set();
let previousFlight = L.flight(0);
for (let time = 0; time <= L.FLIGHT_DURATION; time += 0.125) {
  const current = L.flight(time);
  stages.add(current.stage);
  close(current.buoyancy, initial.buoyancy);
  close(current.totalMass, current.airMass + L.M);
  close(current.molecules * L.R / L.NA * current.temperature, L.P * L.V);
  assert.ok(current.celsius >= previousFlight.celsius && current.lift >= previousFlight.lift);
  assert.ok(current.airMass <= previousFlight.airMass);
  if (current.status !== "rise") assert.equal(current.lift, 0, "合力未向上，不可先升起");
  if (current.lift > 0) assert.ok(current.buoyancy > current.weight);
  previousFlight = current;
}
assert.deepEqual([...stages], [0, 1, 2, 3, 4]);
for (const time of [16, 17, 18]) {
  assert.equal(L.flight(time).status, "neutral");
  close(L.flight(time).celsius, L.CRITICAL);
}
assert.equal(L.flight(L.FLIGHT_DURATION).complete, true);
assert.deepEqual(L.flight(100), L.flight(L.FLIGHT_DURATION));
for (const boundary of [3, 8, 16, 18, 21, 24, 28]) {
  const before = L.flight(boundary - 1e-6), after = L.flight(boundary + 1e-6);
  assert.ok(Math.abs(after.celsius - before.celsius) < 0.0001);
  assert.ok(Math.abs(after.lift - before.lift) < 0.0001);
}
for (const time of [-1, NaN, Infinity]) assert.throws(() => L.flight(time), RangeError);
console.log("通過：臨界條件、質量與分子數守恆、等溫比較，以及連續起飛過程的五階段、臨界停留和上升時機。");
