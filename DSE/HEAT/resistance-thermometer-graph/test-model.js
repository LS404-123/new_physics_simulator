'use strict';
const assert = require('node:assert/strict');
const { calibration, actual, reading } = require('./model.js');
for (const t of [0, 100]) assert.equal(reading(t).indicatedTemperature, t, '兩固定點示值必須準確');
assert.equal(reading(60).resistance, 128.8, '金屬按實線產生電阻');
assert.ok(Math.abs(reading(60).indicatedTemperature - 72) < 1e-10, '儀器按虛線把同一電阻換算成示值');
for (let t = -20; t <= 120; t++) {
  const s = reading(t);
  assert.ok(Math.abs(calibration(s.indicatedTemperature) - s.resistance) < 1e-10, '水平轉移必須保持同一電阻');
  if (t > 0 && t < 100) assert.ok(s.indicatedTemperature > t);
  if (t < 0 || t > 100) assert.ok(s.indicatedTemperature < t);
  assert.ok(s.indicatedTemperature >= -40 && s.indicatedTemperature <= 140, '示值須落在圖軸範圍內');
  if (t < 120) assert.ok(actual(t + 1) > actual(t), '可用範圍內電阻須隨溫度上升');
}
for (const t of [NaN, Infinity, -21, 121]) assert.throws(() => reading(t), RangeError);
console.log('通過：固定點、實際電阻轉換示值、同電阻水平路徑、誤差方向及輸入邊界。');
