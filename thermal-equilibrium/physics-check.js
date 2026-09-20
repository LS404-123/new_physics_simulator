// 執行：node thermal-equilibrium/physics-check.js
'use strict';
const assert = require('node:assert/strict');
const { create, at, CONTACT_SECONDS, PLAYBACK_SECONDS, ALUMINIUM_SPECIFIC, TEA_SPECIFIC, LEMON_SPECIFIC } = require('./model.js');
const base = { massA: 1, specificA: 1000, initialA: 80, massB: 1, specificB: 1000, initialB: 20 };
const close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≠ ${expected}`);
close(create(base).equilibrium, 50);
close(create({ ...base, massA: 2 }).equilibrium, 60);
close(create({ ...base, specificA: 2000 }).equilibrium, 60);
close(create({ ...base, massB: 2 }).equilibrium, 40);
close(create({ ...base, massB: 2 }).equilibriumEnergy, 40000);
for (const time of [0, 20, 100]) {
  close(at(create({ ...base, massA: 2 }), time).temperatureA,
    at(create({ ...base, specificA: 2000 }), time).temperatureA);
}
for (const options of [base, { ...base, massA: 4, specificB: 4200 },
  { ...base, initialA: 20, initialB: 80 }, { ...base, initialA: 50, initialB: 50 },
  { ...base, massA: .5, specificA: 200, massB: 4, specificB: 4200, initialA: 0, initialB: 100 }]) {
  const config = create(options);
  close(at(config, 0).temperatureA, options.initialA);
  close(at(config, 0).temperatureB, options.initialB);
  for (const time of [0, CONTACT_SECONDS / 2, CONTACT_SECONDS]) {
    const beforeContact = at(config, time);
    close(beforeContact.energyA, 0);
    close(beforeContact.energyB, 0);
    close(beforeContact.temperatureA, options.initialA);
    close(beforeContact.temperatureB, options.initialB);
    close(beforeContact.contactFraction, time / CONTACT_SECONDS);
  }
  for (const time of [0, CONTACT_SECONDS + config.transferDuration / 4, CONTACT_SECONDS + config.transferDuration / 2, config.duration, config.duration + 10]) {
    const state = at(config, time);
    close(state.energyA + state.energyB, 0);
    close(config.capacityA * (state.temperatureA - config.initialA), state.energyA);
    close(config.capacityB * (state.temperatureB - config.initialB), state.energyB);
    // 吸熱量等於放熱量；兩個橫軸由相反方向增加。
    const q = Math.abs(state.energyA), direction = Math.sign(config.difference);
    close(state.temperatureA, config.initialA - direction * q / config.capacityA);
    close(state.temperatureB, config.initialB + direction * q / config.capacityB);
    assert.ok(q <= config.equilibriumEnergy + 1e-8);
    if (config.equilibriumEnergy) close(state.transferFraction, q / config.equilibriumEnergy);
    else close(state.transferFraction, 1);
    assert.ok(state.energyB * config.difference >= 0);
    for (const temperature of [state.temperatureA, state.temperatureB]) {
      assert.ok(temperature >= Math.min(options.initialA, options.initialB) - 1e-9);
      assert.ok(temperature <= Math.max(options.initialA, options.initialB) + 1e-9);
    }
  }
  close(at(config, config.duration).difference, 0);
  close(config.duration, CONTACT_SECONDS + (config.equilibriumEnergy === 0 ? 0 : PLAYBACK_SECONDS));
  const quarter = at(config, CONTACT_SECONDS + config.transferDuration / 4), half = at(config, CONTACT_SECONDS + config.transferDuration / 2);
  close(half.energyA - quarter.energyA, quarter.energyA);
  close(half.energyB - quarter.energyB, quarter.energyB);
  close(half.temperatureA - quarter.temperatureA, quarter.temperatureA - config.initialA);
  close(half.temperatureB - quarter.temperatureB, quarter.temperatureB - config.initialB);
}
for (const [specificA, specificB] of [[ALUMINIUM_SPECIFIC, ALUMINIUM_SPECIFIC], [TEA_SPECIFIC, LEMON_SPECIFIC]]) {
  const config = create({ ...base, initialA: 20, initialB: 80, specificA, specificB });
  close(at(config, 0).transferFraction, 0);
  const middle = at(config, CONTACT_SECONDS + config.transferDuration / 2), end = at(config, config.duration);
  assert.ok(middle.temperatureA > 20 && middle.temperatureB < 80);
  assert.ok(middle.transferFraction > 0 && middle.transferFraction < end.transferFraction);
  close(middle.transferFraction, .5);
  // A 的橫向位置為 p/2，B 為 1-p/2；終點在圖中央相遇。
  close(end.transferFraction / 2, .5, .0001);
  close(1 - end.transferFraction / 2, .5, .0001);
  close(config.equilibrium, (specificA * 20 + specificB * 80) / (specificA + specificB));
}
assert.throws(() => create({ ...base, massA: 0 }), RangeError);
assert.throws(() => create({ ...base, specificB: NaN }), RangeError);
assert.throws(() => at(create(base), -1), RangeError);
assert.throws(() => at(create(base), NaN), RangeError);
assert.throws(() => at(create(base), Infinity), RangeError);
console.log('通過：接觸前不傳熱、接觸後 30 秒等速轉移、吸熱放熱相等、T–Q 交點、加權平衡溫度及邊界條件。');
