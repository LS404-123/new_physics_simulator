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
const samples = [false, true].map(mixed => {
  const box = model.createComparisonBox(mixed);
  for (let i = 0; i < 50; i++) model.advance(box, 0.08);
  return model.readings(box);
});
const [uniform, mixed] = samples;
assert.equal(uniform.count, mixed.count);
close(uniform.meanSpeed, 400);
close(mixed.meanSpeed, uniform.meanSpeed);
close(uniform.meanSquare, 400 ** 2);
close(mixed.meanSquare, (12 * 200 ** 2 + 12 * 600 ** 2) / 24);
close(mixed.pressure / uniform.pressure, 1.25);

const meter = model.createComparisonBox(false);
assert.equal(model.wallReading(meter).pressure, null);
meter.particles = [
  { x: meter.width - 0.06, y: 0.5, z: 0.5, vx: 1, vy: 0, vz: 0 },
  { x: meter.width - 0.04, y: 0.5, z: 0.7, vx: 2, vy: 0, vz: 0 },
  { x: 0.02, y: 0.5, z: 0.5, vx: -1, vy: 0, vz: 0 }
];
model.advance(meter, 0.1);
const [first, second] = meter.wallTransfers;
assert.equal(meter.wallTransfers.length, 2);
assert.ok(first.ps < second.ps);
const speedUnit = require("../kinetic-gas/model.js").SPEED_UNIT;
close(first.impulse, 4 * model.mass * speedUnit);
close(second.total, 6 * model.mass * speedUnit);
const elapsedSeconds = 0.1 * Math.cbrt(model.volume) / (meter.width * speedUnit);
close(model.wallReading(meter).pressure, second.total / (Math.cbrt(model.volume) ** 2 * elapsedSeconds));
for (const useMixed of [false, true]) {
  const box = model.createComparisonBox(useMixed);
  for (let i = 0; i < 140; i++) model.advance(box, 0.1);
  const result = model.wallReading(box);
  close(result.ps, 100);
  assert.ok(result.total > 0 && result.total < 1.5e-22, "階梯線須落在共用刻度之內");
  model.advance(box, 0.1);
  assert.deepEqual(model.wallReading(box), result);
}
console.log("通過：六面撞壁、均方速率、右壁衝量的次序及單位、100 ps 量度壓強。");
