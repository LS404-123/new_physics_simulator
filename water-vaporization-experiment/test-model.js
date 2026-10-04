// 執行：node water-vaporization-experiment/test-model.js
'use strict';
const assert = require('node:assert/strict');
const M = require('./model.js');
const flags = ['immersed', 'noSpill', 'noLid', 'lateInitial', 'waitCalm'];
function near(a, b, tolerance = 1e-6) { assert.ok(Math.abs(a - b) < tolerance, `${a} 與 ${b} 不符`); }
function checkConservation(s) {
  near(s.input, s.heater + s.warming + s.vaporization + s.loss);
  near(M.MASS, s.mass + s.escaped + s.spilled, 1e-10);
  near(s.heater, M.THERMAL.heaterCapacity * (s.heaterTemperature - 90));
  const e = M.reading(s).energy;
  near(e.available, e.vaporization + e.loss + Math.max(0, e.heater) + Math.max(0, e.warming));
  assert.ok(s.mass > 0 && Number.isFinite(s.heaterTemperature) && s.temperature <= 100 + 1e-8);
}
function experiment(options = {}, step = 600) {
  const s = M.start(M.create(options));
  for (let i = 0; s.phase !== 'complete'; i++) {
    assert.ok(i < 600000, '實驗應在有限時間完成'); M.advance(s, step); checkConservation(s);
  }
  return { s, r: M.reading(s) };
}
const results = [];
for (const duration of [60, 120, 180, 240]) {
  const good = experiment({ duration });
  assert.ok(good.r.deviation > 0 && good.r.deviation < 4, '這組示意參數下，散熱大於關掣後的額外儲熱');
  results.push({ seconds: duration, deviation: +good.r.deviation.toFixed(4) });
  for (let bits = 0; bits < 32; bits++) {
    const config = Object.fromEntries(flags.map((key, index) => [key, !!(bits & (1 << index))]));
    const { s, r } = experiment({ ...config, duration });
    assert.equal(s.heatingTime, duration); assert.ok(s.initial && s.final && r.measured > 0);
    near(r.q, (r.final.kwh - r.initial.kwh) * M.KWH);
    near(r.lossGrams, (r.initial.mass - r.final.mass) * 1000);
    near(r.measured, r.q / (r.lossGrams / 1000));
    const end = s.final, start = s.initial;
    near(r.q + start.heater - end.heater, end.vaporization - start.vaporization + end.loss - start.loss + end.warming - start.warming);
    // 汽化質量使用量度區間；濺水是額外的質量減少。
    const vaporMass = (end.vaporization - start.vaporization) / M.L;
    near(start.mass - end.mass, vaporMass + s.spilled, 1e-9);
  }
  for (const key of flags) {
    const faulty = experiment({ duration, [key]: false }).r;
    assert.ok(key === 'noSpill' ? faulty.measured < good.r.measured : faulty.measured > good.r.measured, `${key} 誤差方向`);
  }
}
const checkpoint = M.start(M.create({ duration: 60 })); M.advance(checkpoint, 600, true);
assert.equal(checkpoint.phase, 'heating'); assert.equal(checkpoint.heatingTime, 0);
assert.ok(checkpoint.boiled && checkpoint.stableTime >= M.THERMAL.stableSeconds);
assert.ok(Math.abs(M.POWER - M.THERMAL.waterConductance * (checkpoint.heaterTemperature - 100)) < M.POWER * 0.01);
assert.equal(checkpoint.input, checkpoint.initial.energy); assert.equal(checkpoint.mass, checkpoint.initial.mass);
near(M.reading(checkpoint).energy.available, 0);
M.advance(checkpoint, 600, true);
assert.equal(checkpoint.phase, 'complete'); assert.equal(checkpoint.mass, checkpoint.final.mass);
assert.ok(checkpoint.final.boiled, '已止沸不可判為從未沸騰');
const e = M.reading(checkpoint).energy;
assert.ok(e.heaterRelease > 0 && e.vaporization > 0 && e.loss > e.heaterRelease);
near(e.input, 18000);
const early = M.start(M.create({ duration: 60, waitCalm: false })); M.advance(early, 600, true); M.advance(early, 600, true);
assert.equal(early.phase, 'cooling'); assert.equal(early.mass, early.final.mass);
const earlyReading = M.reading(early); M.advance(early, 100);
assert.ok(early.mass < early.final.mass);
assert.deepEqual(M.reading(early).energy, earlyReading.energy, '提早末讀數後，圖及比較區間都須固定');
assert.equal(M.reading(early).measured, earlyReading.measured);
// 尚未到沸點就關掣：有足夠餘熱時仍應到達沸點並汽化。
const nearBoil = M.start(M.create());
while (nearBoil.temperature < 99.9) M.advance(nearBoil, 0.01);
assert.equal(nearBoil.boiled, false); const before = nearBoil.time;
M.stop(nearBoil); M.advance(nearBoil, 0.01); assert.equal(nearBoil.phase, 'cooling');
M.advance(nearBoil, 100); assert.ok(nearBoil.boiled && nearBoil.mass < M.MASS && nearBoil.time > before + 0.1);
assert.equal(nearBoil.initial, null); checkConservation(nearBoil);
const cold = M.start(M.create({ lateInitial: false })); M.advance(cold, 5); const coldTemperature = cold.temperature;
M.stop(cold); M.advance(cold, 100); assert.equal(cold.final.boiled, false); assert.ok(cold.temperature > coldTemperature);
assert.equal(M.reading(cold).measured, null); checkConservation(cold);
const partial = M.create({ immersed: false }); near(M.immersion(partial), 0.5);
partial.mass -= 0.005; assert.ok(M.immersion(partial) < 0.5, '水位下降須改變浸沒比例');
assert.equal(M.immersion(M.create()), 1);
const coarse = experiment({ duration: 60 }), fine = experiment({ duration: 60 }, 0.001);
assert.ok(Math.abs(coarse.r.measured / fine.r.measured - 1) < 0.0001, '縮細步長後結果應收斂');
assert.equal(M.reading(M.create()).measured, null); assert.throws(() => M.advance(cold, -1), RangeError);
console.log('通過：128 組設定、五項誤差、全程及量度區間守恆、穩定初讀數、餘熱、歷史狀態、末讀數固定及步長收斂。');
console.log('全部措施啟用：', JSON.stringify(results));
