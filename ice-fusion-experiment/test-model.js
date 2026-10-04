// 執行：node ice-fusion-experiment/test-model.js
'use strict';
const assert = require('node:assert/strict');
const M = require('./model.js');
function experiment(options = {}, wait = true) {
  const state = M.start(M.create(options));
  M.advance(state, state.config.duration);
  if (wait) M.advance(state, 500);
  const r = M.reading(state);
  return { state, r, measured: state.input / (r.massB - (r.massA || 0)) };
}
const ideal = experiment();
assert.ok(Math.abs(ideal.measured / M.L - 1) < 0.0001, '完整集水及對照應得出正確比潛熱');
for (const options of [{}, { crushed: false }, { melting: false }, { mesh: false, fallenInto: 'A' }, { mesh: false, fallenInto: 'B' }]) {
  const { state } = experiment(options);
  assert.ok(Math.abs(state.input - state.heater - state.transferred - state.lost) < 1e-7, '供能必須守恆');
  assert.ok(Math.abs(state.input - state.fusionEnergy - state.warmingEnergy - state.heater - state.lost) < 1e-7, '能量去向的四個分支必須等於焦耳計供能');
  for (const funnel of [state.a, state.b]) {
    assert.ok(Math.abs(funnel.melted - funnel.collected - funnel.retained) < 1e-9, '集水及漏斗內的熔水必須守恆');
    assert.ok(funnel.melted + funnel.solid <= M.MASS, '不可產生多於起初冰量的物質');
  }
}
assert.ok(experiment({ crushed: false }).measured > ideal.measured, '接觸不良令實驗值偏大');
assert.ok(experiment({ melting: false }).measured > ideal.measured, '冰低於 0°C 令短時量度偏大');
assert.ok(experiment({ mesh: false, fallenInto: 'A' }).measured > ideal.measured, 'A 杯混入冰令差值較小');
assert.ok(experiment({ mesh: false, fallenInto: 'B' }).measured < ideal.measured, 'B 杯混入冰令差值較大');
const noControl = experiment({ control: false });
assert.equal(noControl.r.massA, null);
assert.equal(experiment({ control: false, fallenInto: 'A' }).state.config.fallenInto, 'B', '沒有 A 裝置時不能把冰掉進 A');
assert.ok(noControl.measured < ideal.measured, '省略對照而使用 B 的總質量令實驗值偏小');
for (const { r } of [ideal, noControl]) {
  assert.equal(r.measuredLatentHeat, r.input / (r.calculationGrams / 1000), '直接計算須使用畫面顯示的焦耳計及天平讀數');
  assert.equal(r.deviationPercent, (r.measuredLatentHeat / M.L - 1) * 100, '偏差百分比須以同一實驗值及參考值比較');
}
assert.equal(ideal.state.warmingEnergy, 0, '0°C 的冰不需升溫');
assert.ok(experiment({ melting: false }).state.warmingEnergy > 0, '低於 0°C 的冰須分出升溫能量');
const early = experiment({}, false);
assert.ok(early.measured > ideal.measured, '尚未收集餘熱熔化的水時，實驗值偏大');
assert.equal(early.state.phase, 'draining');
assert.equal(ideal.state.phase, 'complete', '完成集水後須自動結束，不需移杯量度');
assert.equal(ideal.r.temperatureA, 0); assert.equal(ideal.r.temperatureB, 0);
assert.ok(ideal.r.settled, '正確裝置的最終滴水率須接近');
const a = M.start(M.create({ duration: 60 })), b = M.start(M.create({ duration: 60 }));
M.advance(a, 70); for (let i = 0; i < 700; i++) M.advance(b, 0.1);
assert.ok(Math.abs(a.input - b.input) < 1e-7);
assert.ok(Math.abs(a.b.collected - b.b.collected) < 0.000001, '播放步長不應影響讀數');
assert.ok(Math.abs(a.input - a.fusionEnergy - a.warmingEnergy - a.heater - a.lost) < 1e-7, '餘熱尚未散去時能量分支亦須守恆');
assert.throws(() => M.advance(a, -1), RangeError);
const empty = M.create(); M.start(empty); M.stop(empty);
assert.equal(M.reading(empty).measuredLatentHeat, null, '供能或集水差值為零時不得顯示無限值');
assert.equal(M.reading(empty).deviationPercent, null);
const live = M.start(M.create()); M.advance(live, 30);
const liveReading = M.reading(live);
assert.equal(live.phase, 'heating');
assert.ok(liveReading.gramsB > liveReading.gramsA, '加熱期間兩杯質量須即時更新');
assert.equal(liveReading.measuredLatentHeat, liveReading.input / (liveReading.calculationGrams / 1000), '加熱期間亦須即時提供實驗值');
M.stop(live); M.advance(live, 10);
assert.ok(M.reading(live).gramsB > liveReading.gramsB, '關掣後須繼續集水及更新讀數');
const negative = M.start(M.create({ melting: false, mesh: false, fallenInto: 'A', duration: 60 }));
M.advance(negative, 45); M.stop(negative);
assert.ok(M.reading(negative).calculationGrams < 0);
assert.equal(M.reading(negative).measuredLatentHeat, null, '集水差值為負時不得顯示錯誤比潛熱');
assert.equal(M.reading(M.create()).measuredLatentHeat, null, '重設後須清除計算結果');
const before = ideal.state.time; M.advance(ideal.state, 10); assert.equal(ideal.state.time, before, '自動完成後讀數須固定');
console.log('通過：即時質量與實驗值、參考值偏差、關掣後集水、自動完成、能量與質量守恆及無效差值。');
