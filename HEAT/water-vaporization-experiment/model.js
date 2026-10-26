(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.WaterVaporization = model;
})(globalThis, function () {
  'use strict';
  const L = 2260000, C = 4200, MASS = 0.2, POWER = 300, KWH = 3600000;
  // 教學假設，並非指定器材的實測值。U_h 以初溫 90°C 為零點。
  const THERMAL = { heaterCapacity: 10, waterConductance: 20, airConductance: 2, cupConductance: 0.1, stableSeconds: 2 };
  // 與三維裝置共用尺寸；相對水底，單位為裝置繪圖單位。
  const GEOMETRY = { waterDepth: 1.635, coilHeight: 0.26, coilBottom: 0.285, partialCoilBottom: 1.505 };
  function immersion(state) {
    const bottom = state.config.immersed ? GEOMETRY.coilBottom : GEOMETRY.partialCoilBottom;
    return Math.max(0, Math.min(1, (GEOMETRY.waterDepth * state.mass / MASS - bottom) / GEOMETRY.coilHeight));
  }
  function create(options = {}) {
    const config = { immersed: true, noSpill: true, noLid: true, lateInitial: true, waitCalm: true, duration: 180, ...options };
    if (![60, 120, 180, 240].includes(config.duration)) throw new RangeError('未知的加熱時間');
    return { config, phase: 'ready', time: 0, heatingTime: 0, temperature: 90, heaterTemperature: 90, mass: MASS,
      input: 0, heater: 0, warming: 0, vaporization: 0, loss: 0, escaped: 0, condensed: 0, spilled: 0,
      evaporationRate: 0, condensationRate: 0, boiled: false, stableTime: 0, initial: null, final: null, spillTime: null };
  }
  function record(state) {
    return { mass: state.mass, energy: state.input, kwh: state.input / KWH, grams: state.mass * 1000,
      heater: state.heater, warming: state.warming, vaporization: state.vaporization, loss: state.loss,
      time: state.time, boiled: state.boiled };
  }
  function start(state) {
    if (state.phase !== 'ready') return state;
    state.phase = state.config.lateInitial ? 'warming' : 'heating';
    if (!state.config.lateInitial) state.initial = record(state);
    return state;
  }
  function stop(state) {
    if (!['warming', 'heating'].includes(state.phase)) return state;
    state.phase = 'cooling';
    if (!state.config.waitCalm && state.initial) state.final = record(state);
    return state;
  }
  // ponytail: 兩個集中熱容量、線性熱導；忽略杯的熱容量及沸點以下蒸發。
  // 冷凝比例 35%、一次濺水 3 g 為示意條件，定量預測須先校準器材。
  function advance(state, elapsed, pauseAtRecord = false) {
    if (!Number.isFinite(elapsed) || elapsed < 0) throw new RangeError('時間須為非負有限值');
    if (['ready', 'complete'].includes(state.phase)) return state;
    const hadInitial = !!state.initial, hadFinal = !!state.final;
    let remaining = elapsed;
    while (remaining > 1e-9 && state.phase !== 'complete') {
      const powered = ['warming', 'heating'].includes(state.phase), measuring = state.phase === 'heating';
      const dt = Math.min(0.01, remaining, measuring ? state.config.duration - state.heatingTime : Infinity);
      if (dt < 1e-9) { stop(state); continue; }
      const power = powered ? POWER : 0, fraction = immersion(state);
      const toWater = THERMAL.waterConductance * fraction * (state.heaterTemperature - state.temperature);
      const toAir = THERMAL.airConductance * (1 - fraction) * (state.heaterTemperature - 20);
      const ambientLoss = THERMAL.cupConductance * (state.temperature - 20);
      const heaterPower = power - toWater - toAir;
      state.heater += heaterPower * dt;
      state.heaterTemperature = 90 + state.heater / THERMAL.heaterCapacity;
      let heat = (toWater - ambientLoss) * dt;
      state.input += power * dt;
      state.loss += (toAir + ambientLoss) * dt;
      state.time += dt;
      if (measuring) state.heatingTime += dt;
      const toBoiling = state.mass * C * (100 - state.temperature);
      const sensible = Math.min(toBoiling, heat);
      state.warming += sensible;
      state.temperature += sensible / (state.mass * C);
      heat -= sensible;
      const gross = Math.min(state.mass, Math.max(0, heat) / L), returnFraction = state.config.noLid ? 0 : 0.35;
      const returned = gross * returnFraction, escaped = gross - returned;
      state.mass -= escaped; state.escaped += escaped; state.condensed += returned;
      state.vaporization += escaped * L; state.loss += returned * L;
      state.evaporationRate = escaped / dt; state.condensationRate = returned / dt;
      if (gross > 0) state.boiled = true;
      state.stableTime = gross > 0 && Math.abs(heaterPower) < POWER * 0.01 ? state.stableTime + dt : 0;
      if (state.phase === 'warming' && state.stableTime >= THERMAL.stableSeconds) {
        state.phase = 'heating'; state.initial = record(state);
      }
      if (!state.config.noSpill && state.initial && !state.spilled && gross > 0 && state.heatingTime >= state.config.duration / 2) {
        state.spilled = Math.min(0.003, state.mass); state.mass -= state.spilled; state.spillTime = state.time;
      }
      // 先處理剛積分的冷卻區間，再關掣，避免用加熱時的熱流判斷已止沸。
      if (state.phase === 'cooling' && toWater <= ambientLoss) {
        if (state.initial && !state.final) state.final = record(state);
        state.phase = 'complete'; state.evaporationRate = 0; state.condensationRate = 0;
      }
      if (measuring && state.heatingTime >= state.config.duration - 1e-8) { state.heatingTime = state.config.duration; stop(state); }
      remaining -= dt;
      if (pauseAtRecord && ((!hadInitial && state.initial) || (!hadFinal && state.final))) break;
    }
    return state;
  }
  function reading(state) {
    const current = record(state), end = state.final ?? current, start = state.initial;
    const q = start ? end.energy - start.energy : 0;
    const lossGrams = start ? (start.mass - end.mass) * 1000 : 0;
    const measured = q > 0 && lossGrams > 0 ? q / (lossGrams / 1000) : null;
    // 圖、Q 及質量差共用初末快照；提早記末讀數後，圖亦固定在該末讀數。
    const energy = Object.fromEntries(['heater', 'warming', 'vaporization', 'loss'].map(key => [key, end[key] - (start?.[key] ?? 0)]));
    energy.input = start ? q : end.energy;
    energy.heaterRelease = Math.max(0, -energy.heater);
    energy.waterRelease = Math.max(0, -energy.warming);
    energy.available = energy.input + energy.heaterRelease + energy.waterRelease;
    return { current, q, lossGrams, measured, deviation: measured === null ? null : (measured / L - 1) * 100,
      initial: start, final: state.final, boiling: state.evaporationRate > 1e-8, energy,
      input: state.input, temperature: state.temperature, mass: state.mass };
  }
  return { L, C, MASS, POWER, KWH, THERMAL, GEOMETRY, immersion, create, start, stop, advance, reading };
});
