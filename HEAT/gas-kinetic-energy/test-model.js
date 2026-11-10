"use strict";
const assert = require("node:assert/strict");
const model = require("./model.js");
const state = model.create();
const reference = model.readings(state);
function close(actual, expected) {
  assert.ok(Math.abs(actual / expected - 1) < 1e-9, actual + " ≠ " + expected);
}
close(reference.temperature, 300);
const walls = new Set();
for (const speed of [2, 0.5, 1]) {
  for (const count of [96, 12, 48, 24]) {
    model.setControls(state, count, speed);
    for (let step = 0; step < 20; step++) {
      const hits = model.advance(state, 0.08);
      for (const hit of hits) {
        walls.add(hit.axis + hit.side);
        assert.ok(Math.abs(hit[hit.axis] - (hit.side === 1 ? state.width : 0)) < 1e-9);
      }
    }
    const result = model.readings(state);
    close(result.mean, reference.mean * speed ** 2);
    close(result.temperature, reference.temperature * speed ** 2);
    close(result.total, reference.total * speed ** 2 * count / reference.count);
    close(result.pressure * model.volume, 2 * result.total / 3);
    close(result.pressure * model.volume, count * model.mass * result.meanSquare / 3);
    assert.equal(state.particles.length, count);
    assert.ok(state.particles.every(p => [p.x,p.y,p.z].every(x => x >= 0 && x <= state.width)));
  }
}
assert.deepEqual(walls, new Set(["x-1", "x1", "y-1", "y1", "z-1", "z1"]));
assert.throws(() => model.setControls(state, 1, 1), RangeError);
console.log("通過：三維反射、速率平方、分子數目、平均與總動能、壓強及溫度。");
