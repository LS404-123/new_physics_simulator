(function (root, factory) {
  const model = factory(typeof module === 'object' && module.exports ? require('../gas-laws/model.js') : root.GasLaws);
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.KineticGas = model;
})(globalThis, function (laws) {
  'use strict';
  const COUNT = 96, HEIGHT = 1.5, DEPTH = 1.5;
  const R = 8.31446261815324, NA = 6.02214076e23, MOLAR_MASS = 0.004;
  const SPEED_UNIT = Math.sqrt(R * 300 / MOLAR_MASS);

  function create() {
    const gas = { V: 20, T: 300, p: 100 };
    let seed = 48271;
    function random() { seed = seed * 16807 % 2147483647; return seed / 2147483647; }
    function normal() { return Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random()); }
    const particles = Array.from({ length: COUNT }, () => ({
      x: random() * 2, y: random() * HEIGHT, z: random() * DEPTH,
      vx: normal(), vy: normal(), vz: normal()
    }));
    // 有限代表粒子也保持無淨漂移及三方向相同的平均動能。
    for (const key of ['vx', 'vy', 'vz']) {
      const mean = particles.reduce((sum, p) => sum + p[key], 0) / COUNT;
      const deviation = Math.sqrt(particles.reduce((sum, p) => sum + (p[key] - mean) ** 2, 0) / COUNT);
      for (const p of particles) p[key] = (p[key] - mean) / deviation;
    }
    const state = { gas, particles, width: 2, time: 0, hits: [] };
    const initial = moments(state);
    state.reference = { rate: initial.rate, impulse: initial.impulse };
    return state;
  }

  function moments(state) {
    let x2 = 0, total2 = 0, absX = 0;
    for (const p of state.particles) {
      x2 += p.vx ** 2; total2 += p.vx ** 2 + p.vy ** 2 + p.vz ** 2; absX += Math.abs(p.vx);
    }
    return { x2, total2, rate: absX / (2 * state.width), impulse: 2 * x2 / absX };
  }

  function readings(state) {
    const m = moments(state);
    return {
      V: state.gas.V, T: 300 * m.total2 / (3 * COUNT),
      p: 100 * (m.x2 / COUNT) * (2 / state.width),
      rms: SPEED_UNIT * Math.sqrt(m.total2 / COUNT),
      kinetic: 0.5 * (MOLAR_MASS / NA) * SPEED_UNIT ** 2 * m.total2 / COUNT,
      frequency: m.rate / state.reference.rate,
      impulse: m.impulse / state.reference.impulse,
      energy: m.total2 / (3 * COUNT),
      speed: Math.sqrt(m.total2 / (3 * COUNT))
    };
  }

  function inputRange(quantity, pressure = null) {
    if (quantity !== 'V' && quantity !== 'T') throw new RangeError('只能調整體積或溫度');
    let min = quantity === 'V' ? 5 : 150, max = quantity === 'V' ? 40 : 600;
    if (pressure !== null) {
      if (!Number.isFinite(pressure) || pressure < 25 - 1e-8 || pressure > 800 + 1e-8) throw new RangeError('壓強超出模擬範圍');
      pressure = Math.max(25, Math.min(800, pressure));
      min = Math.max(min, quantity === 'V' ? laws.NR * 150 / pressure : pressure * 5 / laws.NR);
      max = Math.min(max, quantity === 'V' ? laws.NR * 600 / pressure : pressure * 40 / laws.NR);
    }
    return { min, max, step: pressure === null ? quantity === 'V' ? 0.1 : 1 : 'any' };
  }

  function setCondition(state, quantity, value, pressure = null) {
    const limits = inputRange(quantity, pressure);
    if (!Number.isFinite(value) || value < limits.min - 1e-8 || value > limits.max + 1e-8) {
      throw new RangeError('體積或溫度超出模擬範圍');
    }
    value = Math.max(limits.min, Math.min(limits.max, value));
    let V = quantity === 'V' ? value : state.gas.V, T = quantity === 'T' ? value : state.gas.T;
    if (pressure !== null) {
      if (quantity === 'V') T = Math.max(150, Math.min(600, pressure * V / laws.NR));
      else V = Math.max(5, Math.min(40, laws.NR * T / pressure));
    }
    const gas = { V, T, p: laws.NR * T / V };
    const width = gas.V / 10, speedScale = Math.sqrt(gas.T / state.gas.T);
    for (const p of state.particles) {
      p.x *= width / state.width;
      p.vx *= speedScale; p.vy *= speedScale; p.vz *= speedScale;
    }
    state.gas = gas; state.width = width; state.hits = [];
  }

  function advance(state, dt) {
    if (!Number.isFinite(dt) || dt < 0 || dt > 0.1) throw new RangeError('粒子時間步長超出範圍');
    const events = [];
    for (const p of state.particles) {
      let remaining = dt;
      while (remaining > 1e-10) {
        const tx = p.vx > 0 ? (state.width - p.x) / p.vx : p.vx < 0 ? -p.x / p.vx : Infinity;
        const ty = p.vy > 0 ? (HEIGHT - p.y) / p.vy : p.vy < 0 ? -p.y / p.vy : Infinity;
        const tz = p.vz > 0 ? (DEPTH - p.z) / p.vz : p.vz < 0 ? -p.z / p.vz : Infinity;
        const hitTime = Math.min(tx, ty, tz), travel = Math.min(remaining, Math.max(0, hitTime));
        p.x += p.vx * travel; p.y += p.vy * travel; p.z += p.vz * travel;
        remaining -= travel;
        if (hitTime > travel + 1e-10) break;
        for (const [axis, velocity, time, limit] of [['x', 'vx', tx, state.width], ['y', 'vy', ty, HEIGHT], ['z', 'vz', tz, DEPTH]]) {
          if (Math.abs(time - hitTime) > 1e-9) continue;
          const side = p[velocity] > 0 ? 1 : -1;
          events.push({ x: p.x, y: p.y, z: p.z, axis, side, impulse: 2 * Math.abs(p[velocity]), time: state.time + dt - remaining });
          p[velocity] *= -1;
          p[axis] = side > 0 ? limit : 0;
        }
      }
    }
    state.time += dt;
    state.hits = state.hits.concat(events).filter(hit => state.time - hit.time < 0.28);
    return events;
  }

  return { COUNT, HEIGHT, DEPTH, SPEED_UNIT, create, moments, readings, inputRange, setCondition, advance };
});
