// 執行：node gas-laws/test-model.js
'use strict';
const assert = require('node:assert/strict');
const M = require('./model.js');
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);
for (const mode of Object.keys(M.modes)) {
  const { min, max } = M.modes[mode];
  for (const input of [min, M.modes[mode].initial, max]) {
    const s = M.solve(mode, input);
    near(s.p * s.V / s.T, 20 / 3);
    near(s.gaugePressure + M.ATMOSPHERE, s.p);
    near(s.celsius, s.T - 273.15);
    near(s.speed * s.speed, s.T / 300);
    if (mode === 'boyle') near(s.T, 300);
    if (mode === 'charles') near(s.p, 100);
    if (mode === 'pressure') near(s.V, 20);
    for (const reciprocal of [false, true]) for (const celsius of [false, true]) {
      const spec = M.graphSpec(mode, reciprocal, celsius);
      const bounds = M.graphBounds(spec);
      const gridWidth = (bounds.right - bounds.left) * (spec.xTicks[1] - spec.xTicks[0]) / (spec.xMax - spec.xMin);
      const gridHeight = (bounds.bottom - bounds.top) * (spec.yTicks[1] - spec.yTicks[0]) / spec.yMax;
      near(gridWidth, gridHeight);
      assert.ok(bounds.left >= 66 && bounds.right <= 630 && bounds.top >= 42 && bounds.bottom <= 344);
      const point = M.point(s, spec);
      assert.ok(point.x >= spec.xMin && point.x <= spec.xMax && point.y <= spec.yMax);
      const curve = M.curve(mode, spec);
      assert.equal(curve.length, 101);
      for (const p of curve) {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
        if (mode === 'boyle') near(spec.reciprocal ? p.y / p.x : p.y * p.x, 2000);
        else near(p.y / (p.x + (spec.celsius ? 273.15 : 0)), mode === 'charles' ? 1 / 15 : 1 / 3);
      }
    }
  }
  assert.throws(() => M.solve(mode, min - 1), RangeError);
  assert.throws(() => M.solve(mode, max + 1), RangeError);
  assert.throws(() => M.solve(mode, NaN), RangeError);
  for (const [from, to] of [[min, max], [max, min]]) {
    assert.deepEqual(M.transitionState(mode, from, to, 0), M.solve(mode, from));
    assert.deepEqual(M.transitionState(mode, from, to, 1), M.solve(mode, to));
    assert.deepEqual(M.transitionState(mode, from, to, 2), M.solve(mode, to));
    let previous = from;
    for (let i = 1; i < 20; i++) {
      const state = M.transitionState(mode, from, to, i / 20);
      const input = mode === 'boyle' ? state.V : state.T;
      assert.ok(input >= min && input <= max);
      assert.ok((input - previous) * (to - from) >= 0, '動畫不能反向或超越目標');
      near(state.p * state.V / state.T, M.NR);
      if (mode === 'boyle') { near(state.T, 300); assert.ok(state.gaugePressure >= 0); }
      if (mode === 'charles') near(state.p, 100);
      if (mode === 'pressure') near(state.V, 20);
      previous = input;
    }
  }
}
near(M.solve('boyle', 10).p / M.solve('boyle', 20).p, 2);
near(M.solve('boyle', 20).gaugePressure, 0);
near(M.solve('boyle', 5).gaugePressure, 300);
near(M.solve('charles', 600).V / M.solve('charles', 300).V, 2);
near(M.solve('pressure', 600).p / M.solve('pressure', 300).p, 2);
near(M.point(M.solve('charles', 273.15), M.graphSpec('charles', false, true)).x, 0);
near(M.solve('charles', 273.15).V, 18.21);
assert.throws(() => M.solve('unknown', 300), RangeError);
assert.throws(() => M.graphSpec('unknown'), RangeError);
for (const mode of Object.keys(M.modes)) {
  const from = M.curve(mode, M.graphSpec(mode));
  const to = M.curve(mode, M.graphSpec(mode, true, true));
  assert.deepEqual(M.morphPoints(from, to, 0), from);
  const end = M.morphPoints(from, to, 1);
  end.forEach((p, i) => { near(p.x, to[i].x); near(p.y, to[i].y); });
  const mid = M.morphPoints(from, to, 0.5);
  mid.forEach((p, i) => { near(p.x, (from[i].x + to[i].x) / 2); near(p.y, (from[i].y + to[i].y) / 2); });
  assert.notDeepEqual(mid, from);
  assert.notDeepEqual(mid, to);
  assert.deepEqual(M.morphPoints(mid, from, 0), mid, '中途切換必須延續當前座標');
}
const ticks = M.morphPoints([{ x: 0, y: 0 }], [{ x: 1, y: 0 }, { x: 2, y: 0 }], 1);
assert.deepEqual(ticks, [{ x: 1, y: 0 }, { x: 2, y: 0 }]);
for (const mode of ['charles', 'pressure']) {
  const kelvin = M.graphSpec(mode), celsius = M.graphSpec(mode, false, true);
  assert.equal(kelvin.xMin, celsius.xMin);
  assert.equal(kelvin.xMax, celsius.xMax);
  assert.deepEqual(kelvin.xTicks, celsius.xTicks);
  assert.equal(kelvin.yMax, celsius.yMax);
  assert.deepEqual(M.graphBounds(kelvin), M.graphBounds(celsius), '切換溫度單位時座標軸必須固定');
  const from = M.curve(mode, kelvin), to = M.curve(mode, celsius);
  from.forEach((p, i) => { near(p.x - to[i].x, 273.15); near(p.y, to[i].y); });
}
const volumeBounds = M.graphBounds(M.graphSpec('boyle'));
const reciprocalBounds = M.graphBounds(M.graphSpec('boyle', true));
for (const side of Object.keys(volumeBounds)) near(volumeBounds[side], reciprocalBounds[side]);
console.log('通過：三條定律、動畫控制量、圖線變形與中斷、K／°C 固定座標軸及純平移、1:1 網格、單位與邊界。');
