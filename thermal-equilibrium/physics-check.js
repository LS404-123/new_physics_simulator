// 執行：node thermal-equilibrium/physics-check.js
'use strict';
const assert = require('node:assert/strict');
const { create, at, CONTACT_SECONDS, PLAYBACK_SECONDS, ALUMINIUM_SPECIFIC, TEA_SPECIFIC, LEMON_SPECIFIC, WATER_SPECIFIC, ICE_SPECIFIC, FUSION_LATENT } = require('./model.js');
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
const iceBase = { ice: true, massA: .42, specificA: WATER_SPECIFIC, initialA: 0, massB: 1, specificB: WATER_SPECIFIC };
for (const initialB of [0, 20, 33.4, 60, 100]) {
  const config = create({ ...iceBase, initialB });
  const end = at(config, config.duration);
  close(end.temperatureA, end.temperatureB);
  close(end.temperatureA, Math.max(0, (4200 * initialB - 140280) / 5964));
  close(end.remainingIce, Math.max(0, .42 - 4200 * initialB / FUSION_LATENT));
  if (initialB < 33.4) { assert.ok(end.remainingIce > 0); close(end.temperatureA, 0); }
  if (initialB === 33.4) { close(end.remainingIce, 0); close(end.temperatureA, 0); }
  if (initialB > 33.4) { close(end.remainingIce, 0); assert.ok(end.temperatureA > 0 && end.temperatureA < initialB); }
  for (let i = 0; i <= 20; i++) {
    const sample = at(config, config.duration * i / 20);
    close(sample.energyA + sample.energyB, 0);
    close(sample.meltedMass + sample.remainingIce, config.massA);
    close(sample.energyA, sample.meltedMass * FUSION_LATENT + config.capacityA * sample.temperatureA);
    close(-sample.energyB, config.capacityB * (initialB - sample.temperatureB));
    assert.ok(sample.temperatureA <= sample.temperatureB + 1e-8);
    if (sample.remainingIce > 1e-9) close(sample.temperatureA, 0);
  }
  if (config.equilibriumEnergy > config.meltingEnergy) {
    const meltTime = CONTACT_SECONDS + PLAYBACK_SECONDS * config.meltingEnergy / config.equilibriumEnergy;
    close(at(config, meltTime).temperatureA, 0);
    close(at(config, meltTime).remainingIce, 0);
    assert.ok(at(config, meltTime + .01).temperatureA > 0);
  }
}
assert.throws(() => create({ ...iceBase, initialA: 5, initialB: 20 }), RangeError);
// 獨立已知結果：1 kg、−20°C 冰先吸收 42 kJ 升至 0°C。
const cold = create({ ...iceBase, massA: 1, initialA: -20, initialB: 20 });
const sampleAtQ = (config, q) => at(config, CONTACT_SECONDS + PLAYBACK_SECONDS * q / config.equilibriumEnergy);
close(at(cold, 0).temperatureA, -20);
close(sampleAtQ(cold, 21000).temperatureA, -10);
close(sampleAtQ(cold, 21000).meltedMass, 0);
close(sampleAtQ(cold, 42000).temperatureA, 0);
close(sampleAtQ(cold, 42000).meltedMass, 0);
close(at(cold, cold.duration).meltedMass, 42000 / FUSION_LATENT);
for (const options of [
  { ...iceBase, initialA: -20, initialB: 20 },
  { ...iceBase, initialA: -20, initialB: 37.6 },
  { ...iceBase, initialA: -20, initialB: 60 },
  { ...iceBase, initialA: -40, massA: 4, massB: .01, initialB: 0 },
  { ...iceBase, initialA: -20, massA: 1, massB: .2, initialB: 20 },
  { ...iceBase, initialA: -20, massA: 1, massB: .1, initialB: 20 }
]) {
  const config = create(options), end = at(config, config.duration);
  close(end.temperatureA, end.temperatureB);
  close(at(config, 0).temperatureA, options.initialA);
  close(at(config, 0).temperatureB, options.initialB);
  for (let i = 0; i <= 50; i++) {
    const sample = at(config, config.duration * i / 50);
    close(sample.energyA + sample.energyB, 0);
    close(sample.meltedMass + sample.remainingIce, config.massA);
    const sensibleA = config.massA * (sample.temperatureA < 0 ? ICE_SPECIFIC : WATER_SPECIFIC) * sample.temperatureA;
    close(sample.energyA, config.warmingEnergy + sensibleA + sample.meltedMass * FUSION_LATENT);
    const sensibleB = config.massB * (sample.temperatureB < 0 ? ICE_SPECIFIC : config.specificB) * sample.temperatureB;
    close(-sample.energyB, config.coolingEnergy - sensibleB + sample.frozenMass * FUSION_LATENT);
    assert.ok(sample.temperatureA <= sample.temperatureB + 1e-8);
    assert.ok(sample.temperatureA >= options.initialA - 1e-8);
    if (sample.temperatureA < -1e-8) close(sample.meltedMass, 0);
  }
}
const critical = create({ ...iceBase, initialA: -20, initialB: 37.6 });
close(at(critical, critical.duration).remainingIce, 0);
close(critical.equilibrium, 0);
const warm = create({ ...iceBase, initialA: -20, initialB: 60 });
close(warm.equilibrium, (252000 - 17640 - 140280) / 5964);
const freeze = create({ ...iceBase, massA: 1, massB: .1, initialA: -20, initialB: 20 });
close(at(freeze, freeze.duration).frozenMass, .1);
close(freeze.equilibrium, -200 / 2310);
const partialFreeze = create({ ...iceBase, massA: 1, massB: .2, initialA: -20, initialB: 20 });
close(at(partialFreeze, partialFreeze.duration).frozenMass, (42000 - 16800) / FUSION_LATENT);
close(partialFreeze.equilibrium, 0);
assert.throws(() => create({ ...iceBase, initialA: -40.1, initialB: 20 }), RangeError);
// 執行實際繪圖程式：相變平台着色，升降溫斜線及 0°C 座標線不變。
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const appSource = readFileSync(require.resolve('./app.js'), 'utf8');
function graphAt(config, time) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', min: 0, max: 4, style: {}, attributes: {}, handlers: {},
      setAttribute(key, value) { this.attributes[key] = String(value); },
      toggleAttribute() {}, addEventListener(event, handler) { this.handlers[event] = handler; },
      querySelector() { return element('liquidFill'); } });
    return elements.get(id);
  };
  for (const id of ['initialA', 'initialB', 'massA', 'massB']) element(id).value = String(config[id]);
  element('materialMode').value = config.ice ? 'ice-water' : 'same';
  element('zeroAxis').attributes.stroke = 'black';
  runInNewContext(appSource, { ThermalEquilibrium: { ...require('./model.js'), create: () => config, at: () => at(config, time) },
    document: { getElementById: element, addEventListener() {} }, cancelAnimationFrame() {}, requestAnimationFrame() {} });
  element('play').handlers.click();
  assert.equal(element('zeroAxis').attributes.stroke, 'black');
  return id => element(id).attributes.d;
}
assert.equal(graphAt(warm, CONTACT_SECONDS + .01)('phaseCurveA'), '');
let graph = graphAt(warm, CONTACT_SECONDS + PLAYBACK_SECONDS * 25000 / warm.equilibriumEnergy);
assert.equal(graph('phaseCurveA'), `M${64 + 303 * 17640 / warm.equilibriumEnergy},452.5L${64 + 303 * 25000 / warm.equilibriumEnergy},452.5`);
assert.equal(graph('phaseCurveB'), '');
graph = graphAt(warm, warm.duration);
assert.equal(graph('phaseCurveA'), `M${64 + 303 * 17640 / warm.equilibriumEnergy},452.5L${64 + 303 * 157920 / warm.equilibriumEnergy},452.5`);
graph = graphAt(freeze, CONTACT_SECONDS + PLAYBACK_SECONDS * 20000 / freeze.equilibriumEnergy);
assert.equal(graph('phaseCurveA'), '');
assert.equal(graph('phaseCurveB'), `M${670 - 303 * 8400 / freeze.equilibriumEnergy},452.5L${670 - 303 * 20000 / freeze.equilibriumEnergy},452.5`);
assert.equal(graphAt(create(base), 10)('phaseCurveA'), '');
console.log('通過：零下冰升溫、0°C 融冰平台、臨界全溶、融水升溫、液體結冰、低於 0°C 的平衡、質量與能量守恆及原有模式。');
