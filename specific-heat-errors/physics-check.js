'use strict';
const assert = require('node:assert/strict');
const { create, advance, reading, MATERIALS, TARGET_RISE, POWER } = require('./model.js');
const close = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≠ ${b}`);
for (const material of ['water', 'metal']) {
  const reference = MATERIALS[material].c;
  for (const error of ['ideal', 'loss', 'apparatus', 'uneven']) {
    for (const corrected of [false, true]) for (const probe of ['near', 'far']) {
      const state = create(material, error, corrected, probe);
      const stepped = create(material, error, corrected, probe);
      advance(state, 1000);
      for (let i = 0; i < 4000; i++) advance(stepped, 0.25);
      close(state.mean, stepped.mean);
      close(state.spread, stepped.spread);
      close(state.input, state.sampleEnergy + state.apparatusEnergy + state.lost);
      const r = reading(state);
      close(r.rise, TARGET_RISE);
      assert.equal(r.riseTrend, 'same');
      close(state.input, POWER * state.config.duration);
      const beforeEnd = advance(create(material, error, corrected, probe), state.time - 0.01);
      assert.ok(reading(beforeEnd).rise < TARGET_RISE, '達到目標讀數才完成');
      assert.equal(r.massTrend, 'same');
      close(r.initialBalance, r.finalBalance);
      close(state.mass, state.config.mass);
      assert.ok(r.done);
      if (error === 'ideal' || (error === 'loss' && corrected)) {
        close(r.cMeasured, reference);
        assert.deepEqual([r.inputTrend, r.heatTrend, r.capacityTrend], ['same', 'same', 'same']);
      }
      if ((error === 'loss' && !corrected) || error === 'apparatus') {
        assert.ok(r.cMeasured > reference);
        assert.deepEqual([r.inputTrend, r.heatTrend, r.capacityTrend], ['more', 'same', 'more']);
        assert.ok(state.config.duration > state.config.referenceEnergy / POWER, '相同溫升要加熱更久');
      }
      if (error === 'uneven' && !corrected) {
        const direction = probe === 'near' ? 'less' : 'more';
        assert.deepEqual([r.inputTrend, r.heatTrend, r.capacityTrend], [direction, direction, direction]);
        assert.ok(probe === 'near' ? state.mean - 20 < TARGET_RISE : state.mean - 20 > TARGET_RISE,
          '讀數達標不代表平均溫升達標');
      }
      if (error !== 'ideal' && !corrected) {
        assert.ok(Math.abs(r.cMeasured / reference - 1) <= 0.15, '示例誤差應保持在合理教學幅度');
      }
      if (error === 'uneven' && corrected) {
        close(r.cMeasured, reference, reference * 0.001);
        assert.equal(r.capacityTrend, 'same');
        assert.equal(r.inputTrend, 'same');
        const off = advance(create(material, error, corrected, probe), state.config.duration);
        assert.ok(reading(off).temperature < r.temperature, '關掣後遠端讀數繼續上升');
        close(off.input, state.input, 1e-6);
      }
    }
  }
}
const glass = advance(create('water', 'apparatus'), 1000);
const foam = advance(create('water', 'apparatus', true), 1000);
assert.ok(reading(foam).cMeasured < reading(glass).cMeasured);
assert.ok(foam.input < glass.input);
close(foam.sampleEnergy, glass.sampleEnergy);
assert.equal(reading(glass).initialBalance, 280);
assert.equal(reading(foam).initialBalance, 208);
assert.throws(() => create('ice'), RangeError);
assert.throws(() => create('water', 'loss', false, 'middle'), RangeError);
assert.throws(() => advance(create(), NaN), RangeError);
assert.throws(() => advance(create(), -1), RangeError);
assert.equal(reading(create()).cMeasured, null);
console.log('通過：相同目標溫升、總供能與樣品吸能、近／遠端停熱、能量及質量守恆、關掣後均溫、預防措施及時間步長一致性。');
