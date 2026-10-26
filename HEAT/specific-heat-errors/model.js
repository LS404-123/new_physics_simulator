(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.SpecificHeat = model;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const ROOM = 20, POWER = 60, TARGET_RISE = 10;
  const MATERIALS = {
    water: { name: '水', mass: 0.2, c: 4200 },
    metal: { name: '鋁塊', mass: 0.5, c: 900 }
  };

  function settings(material, error, corrected, probe) {
    if (!Object.hasOwn(MATERIALS, material) || !['ideal', 'loss', 'apparatus', 'uneven'].includes(error)) {
      throw new RangeError('未知的樣品或誤差');
    }
    if (!['near', 'far'].includes(probe)) throw new RangeError('未知測溫位置');
    const sample = MATERIALS[material];
    const loss = error === 'loss' && !corrected;
    const apparatus = error === 'apparatus';
    const heaterC = apparatus ? (material === 'water' ? 10 : 30) : 0;
    const cupC = apparatus && material === 'water' && !corrected ? 70 : 0;
    return {
      ...sample, material, error, corrected, probe: corrected ? 'far' : probe,
      referenceEnergy: sample.mass * sample.c * TARGET_RISE,
      // ponytail: 教學用集中參數模型，只比較單一誤差；定量擬合真實器材時需量度熱容量及散熱係數。
      heaterC, cupC, apparatusC: heaterC + cupC,
      tare: material === 'water' ? (apparatus && !corrected ? 80 : 8) : 0,
      efficiency: 1,
      conductance: loss ? 0.6 : 0,
      tau: material === 'water' ? 15 : 8,
      settleTime: error === 'uneven' && corrected ? (material === 'water' ? 14 : 126) : 0
    };
  }

  function create(material = 'water', error = 'loss', corrected = false, probe = 'far') {
    const config = settings(material, error, corrected, probe);
    const initial = () => ({ config, time: 0, mean: ROOM, spread: 0,
      input: 0, lost: 0, sampleEnergy: 0, heaterEnergy: 0, cupEnergy: 0, apparatusEnergy: 0, mass: config.mass });
    // 用同一傳熱模型求達到目標讀數的加熱時間；均溫情境以關掣後的末讀數為準。
    let low = 0, high = 2 * config.referenceEnergy / POWER;
    for (let i = 0; i < 45; i++) {
      config.duration = (low + high) / 2;
      const end = advance(initial(), config.duration + config.settleTime);
      if (reading(end).rise < TARGET_RISE) low = config.duration;
      else high = config.duration;
    }
    config.duration = (low + high) / 2;
    return initial();
  }

  function advance(state, elapsed) {
    if (!Number.isFinite(elapsed) || elapsed < 0) throw new RangeError('時間須為非負有限值');
    const c = state.config;
    const end = c.duration + c.settleTime;
    let remaining = Math.min(elapsed, end - state.time);
    while (remaining > 1e-9) {
      const heating = state.time < c.duration - 1e-9;
      const dt = Math.min(remaining, heating ? c.duration - state.time : end - state.time);
      const capacity = c.mass * c.c + c.apparatusC;
      const power = heating ? POWER : 0;
      const delivered = power * c.efficiency;
      const previous = state.mean;
      if (c.conductance) {
        const decay = Math.exp(-c.conductance * dt / capacity);
        state.mean = ROOM + (state.mean - ROOM) * decay + delivered / c.conductance * (1 - decay);
      } else state.mean += delivered * dt / capacity;
      if (c.error === 'uneven') {
        const tau = !heating && c.corrected && c.material === 'water' ? 2 : c.tau;
        const decay = Math.exp(-dt / tau);
        state.spread = state.spread * decay + delivered / capacity * tau * (1 - decay);
      }
      state.input += power * dt;
      state.lost += power * dt - capacity * (state.mean - previous);
      state.time = Math.min(end, state.time + dt);
      remaining -= dt;
    }
    state.sampleEnergy = c.mass * c.c * (state.mean - ROOM);
    state.heaterEnergy = c.heaterC * (state.mean - ROOM);
    state.cupEnergy = c.cupC * (state.mean - ROOM);
    state.apparatusEnergy = c.apparatusC * (state.mean - ROOM);
    return state;
  }

  function reading(state, probe = state.config.probe) {
    if (!['near', 'far'].includes(probe)) throw new RangeError('未知測溫位置');
    const c = state.config;
    const temperature = state.mean + (probe === 'near' ? state.spread : -state.spread);
    const rise = temperature - ROOM;
    const cMeasured = rise > 1e-9 ? state.input / (state.mass * rise) : null;
    const trend = (value, reference) => Math.abs(value - reference) <= Math.max(1e-9, Math.abs(reference) * 0.001)
      ? 'same' : value > reference ? 'more' : 'less';
    return {
      temperature, rise,
      cMeasured,
      inputTrend: trend(state.input, c.referenceEnergy),
      heatTrend: trend(state.sampleEnergy, c.referenceEnergy),
      riseTrend: trend(rise, TARGET_RISE),
      capacityTrend: cMeasured === null ? null : trend(cMeasured, c.c),
      massTrend: trend(state.mass, c.mass),
      initialBalance: c.mass * 1000 + c.tare,
      finalBalance: state.mass * 1000 + c.tare,
      done: state.time >= c.duration + c.settleTime - 1e-7,
      heating: state.time < c.duration - 1e-7
    };
  }
  return { ROOM, POWER, TARGET_RISE, MATERIALS, create, advance, reading };
});
