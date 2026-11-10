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
const box = model.createMixedBox();
for (let i = 0; i < 50; i++) model.advance(box, 0.08);
const beforeCounting = model.readings(box);
assert.equal(model.countedSquares(box, 0).meanSquare, null);
for (let count = 1; count <= 24; count++) {
  const result = model.countedSquares(box, count);
  const slow = Math.min(count, 12), fast = count - slow;
  assert.deepEqual(result.groups.map(g => g.included), [slow, fast]);
  close(result.meanSquare, (slow * 200 ** 2 + fast * 600 ** 2) / count);
}
const all = model.countedSquares(box, 24);
close(all.sum, 4800000);
close(all.meanSquare, beforeCounting.meanSquare);
close(all.groups[1].sum / all.sum, 0.9);
close(beforeCounting.pressure * model.volume, model.mass * all.sum / 3);
assert.deepEqual(model.readings(box), beforeCounting);
console.log("通過：三維撞壁、B 箱逐粒計數、快慢兩組的平方總和、全箱平均值與壓強。");

const thermal = require("./thermal.js");
const pair = thermal.create();
const [a, b] = pair.particles;
pair.particles = [a, b];
const d = 2 * pair.thermal.radius;
Object.assign(a, { x: 0.5, y: 0.5, z: 0.5, vx: 1, vy: 0, vz: 0 });
Object.assign(b, { x: 0.55 + d / Math.sqrt(2), y: 0.5 + d / Math.sqrt(2), z: 0.5, vx: 0, vy: 0, vz: 0 });
thermal.advance(pair, 0.1);
assert.equal(pair.thermal.collisions, 1);
close(a.vx, 0.5); close(a.vy, -0.5); close(b.vx, 0.5); close(b.vy, 0.5);

const evolving = thermal.create();
assert.equal(evolving.particles.length, 80);
assert.deepEqual(evolving.thermal.counts.filter(Boolean), [40, 40]);
for (const [i, p] of evolving.particles.entries()) {
  for (const q of evolving.particles.slice(i + 1)) {
    assert.ok(Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) > 2 * evolving.thermal.radius);
  }
}
assert.equal(thermal.wallPressure(evolving), null);
const initialSquare = model.readings(evolving).meanSquare;
const distance = counts => counts.reduce((sum, n, i) => sum + Math.abs(n - evolving.thermal.expected[i]), 0) / (2 * evolving.particles.length);
assert.ok(distance(evolving.thermal.counts) > 0.6);
const accumulated = evolving.thermal.counts.map(() => 0);
for (let i = 0; i < 2400; i++) {
  thermal.advance(evolving, 0.1);
  if (i >= 800 && i % 10 === 0) thermal.histogram(evolving.particles).forEach((n, j) => accumulated[j] += n / 160);
}
close(model.readings(evolving).meanSquare, initialSquare);
close(evolving.thermal.counts.reduce((sum, n) => sum + n, 0), 80);
assert.ok(evolving.particles.every(p => [p.x,p.y,p.z].every(x => x >= evolving.thermal.radius - 1e-9 && x <= evolving.width - evolving.thermal.radius + 1e-9)));
assert.ok(thermal.wallPressure(evolving) > 0);
assert.ok(evolving.thermal.collisions > 100 && distance(accumulated) < 0.1);
console.log("通過：斜碰的三維硬球交換動量、總動能守恆，實際速率由兩峰演化至與平衡分佈相符。");
