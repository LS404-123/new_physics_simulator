'use strict';
const assert = require('node:assert/strict');
const M = require('./model.js');
const L = require('../gas-laws/model.js');
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} 應接近 ${expected}`);

// 三方向動能和宏觀定律必須一致，包括多次來回調整後。
for (const V of [5, 10, 20, 40]) {
  const state = M.create();
  for (let cycle = 0; cycle < 8; cycle++) {
    for (const T of [150, 300, 600]) {
      M.setCondition(state, 'V', V); M.setCondition(state, 'T', T);
      const r = M.readings(state);
      near(r.p, 100 * (T / 300) * (20 / V)); near(r.T, T); near(r.V, V);
      near(r.p * r.V / r.T, L.NR);
      near(r.frequency * r.impulse, r.p / 100);
      near(r.energy, r.T / 300); near(r.speed ** 2, r.energy);
      near(r.kinetic, 1.5 * 8.31446261815324 * r.T / 6.02214076e23, 1e-32);
      assert.equal(state.particles.length, M.COUNT);
      assert.ok(state.particles.every(p => p.x >= 0 && p.x <= state.width));
    }
  }
}
const compressed = M.create(); M.setCondition(compressed, 'V', 10);
const c = M.readings(compressed);
near(c.frequency, 2); near(c.impulse, 1); near(c.energy, 1); near(c.p, 200);
const independent = M.create();
M.setCondition(independent, 'T', 450); M.setCondition(independent, 'V', 30);
near(M.readings(independent).T, 450); near(M.readings(independent).p, 100);
M.setCondition(independent, 'T', 600);
near(M.readings(independent).V, 30); near(M.readings(independent).p, 400 / 3);
const heated = M.create(); M.setCondition(heated, 'T', 600);
const h = M.readings(heated);
near(h.frequency, Math.sqrt(2)); near(h.impulse, Math.sqrt(2)); near(h.p, 200);
const expanded = M.create(); M.setCondition(expanded, 'T', 600, 100);
const e = M.readings(expanded);
near(e.frequency, 1 / Math.sqrt(2)); near(e.impulse, Math.sqrt(2)); near(e.p, 100); near(e.V, 40);

// 可由兩條滑桿保持當刻壓強，包含非起始壓強和範圍兩端。
for (const [V, T] of [[20, 300], [10, 300], [13.7, 441], [40, 150], [5, 600]]) {
  const state = M.create(); M.setCondition(state, 'V', V); M.setCondition(state, 'T', T);
  const pressure = M.readings(state).p;
  for (const quantity of ['V', 'T']) {
    const range = M.inputRange(quantity, pressure);
    for (const input of [range.min, range.max, (range.min + range.max) / 2]) {
      M.setCondition(state, quantity, input, pressure);
      const r = M.readings(state);
      near(r.p, pressure); near(r.V / r.T, L.NR / pressure);
      assert.ok(r.V >= 5 - 1e-9 && r.V <= 40 + 1e-9 && r.T >= 150 - 1e-9 && r.T <= 600 + 1e-9);
    }
  }
}
near(M.inputRange('V', 100).min, 10); near(M.inputRange('V', 100).max, 40);
near(M.inputRange('T', 200).min, 150); near(M.inputRange('T', 200).max, 600);

// 直接驗證反射與傳給壁面的動量，不只檢查氣體公式。
const single = { particles: [{ x: 0.1, y: 0.5, z: 0.5, vx: -2, vy: 0, vz: 0 }], width: 2, time: 0, hits: [] };
const hit = M.advance(single, 0.1);
assert.equal(hit.length, 1); assert.equal(hit[0].axis, 'x'); assert.equal(hit[0].side, -1);
near(hit[0].impulse, 4); near(single.particles[0].x, 0.1); near(single.particles[0].vx, 2);
const corner = { particles: [{ x: 0.01, y: 0.01, z: 0.01, vx: -1, vy: -1, vz: -1 }], width: 2, time: 0, hits: [] };
assert.equal(M.advance(corner, 0.05).length, 3);
for (const coordinate of ['x', 'y', 'z']) near(corner.particles[0][coordinate], 0.04);
assert.throws(() => M.advance(compressed, -1), RangeError);
assert.throws(() => M.advance(compressed, NaN), RangeError);
for (const [quantity, input, pressure] of [['V', 0], ['T', 0], ['V', NaN], ['P', 100], ['V', 5, 100], ['T', 300, -1]]) {
  const before = JSON.stringify(compressed);
  assert.throws(() => M.setCondition(compressed, quantity, input, pressure), RangeError);
  assert.equal(JSON.stringify(compressed), before, '無效輸入不可改動粒子或讀數');
}

// 實際累積撞擊事件，驗證頻率、加權每次動量及壓強；有限觀察時間容許 1% 差異。
for (const [V, T] of [[20, 300], [10, 300], [20, 600], [40, 600], [5, 600], [40, 150]]) {
  const state = M.create(); M.setCondition(state, 'V', V); M.setCondition(state, 'T', T);
  const initial = M.readings(state), expected = M.moments(state);
  let count = 0, momentum = 0;
  for (let step = 0; step < 2000; step++) {
    for (const event of M.advance(state, 0.1)) {
      if (event.axis === 'x' && event.side === -1) { count++; momentum += event.impulse; }
    }
  }
  near(count / 200 / expected.rate, 1, 0.01);
  near(momentum / count / expected.impulse, 1, 0.01);
  near(momentum / 200 / (expected.x2 / state.width), 1, 0.01);
  const final = M.readings(state); near(final.T, initial.T); near(final.p, initial.p);
  assert.ok(state.particles.every(p => p.x >= 0 && p.x <= state.width && p.y >= 0 && p.y <= M.HEIGHT && p.z >= 0 && p.z <= M.DEPTH));
}
console.log('通過：體積及溫度獨立調整、雙向定壓連動與邊界、三種 PVT 關係、彈性反射及實際撞擊統計。');
