(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../kinetic-gas/model.js"));
  else root.GasEnergy = factory(root.KineticGas);
})(globalThis, function (gas) {
  "use strict";
  const mass = 0.004 / 6.02214076e23;
  const volume = 1e-24;
  // 把 1 ps 換算為撞壁模型的時間單位：實際邊長對應 gas.HEIGHT。
  const impactWindow = 1e-12 * gas.SPEED_UNIT * gas.HEIGHT / Math.cbrt(volume);
  const boltzmann = 1.380649e-23;
  const defaults = { count: 24, speed: 1 };
  const groupSize = 12;

  function create() {
    const state = gas.create();
    state.width = gas.HEIGHT;
    state.pool = state.particles;
    // 每組有三種速率，各取四面體的四個方向。每加一組，速率分布和三軸均方分量都不變。
    const signs = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
    for (let i = 0; i < state.pool.length; i += 4) {
      const yaw = state.pool[i].vx, pitch = state.pool[i].vy;
      const magnitude = Math.sqrt(1 + 2 * ((i / 4) % 3)) / Math.sqrt(3);
      signs.forEach(([x, y, z], j) => {
        const p = state.pool[i + j];
        const u = x * Math.cos(yaw) - y * Math.sin(yaw);
        p.x *= state.width / 2;
        p.vx = magnitude * (u * Math.cos(pitch) + z * Math.sin(pitch));
        p.vy = magnitude * (x * Math.sin(yaw) + y * Math.cos(yaw));
        p.vz = magnitude * (z * Math.cos(pitch) - u * Math.sin(pitch));
      });
    }
    state.speed = 1;
    setControls(state, defaults.count, defaults.speed);
    return state;
  }

  function setControls(state, count, speed) {
    if (!Number.isInteger(count) || count < groupSize || count > state.pool.length || count % groupSize ||
        !Number.isFinite(speed) || speed < 0.5 || speed > 2) throw new RangeError("粒子設定超出範圍");
    const scale = speed / state.speed;
    for (const p of state.pool) {
      p.vx *= scale;
      p.vy *= scale;
      p.vz *= scale;
    }
    state.speed = speed;
    state.particles = state.pool.slice(0, count);
    state.hits = [];
  }

  function createComparisonBox(mixed) {
    const state = create();
    const speeds = mixed ? [200, 600] : [400];
    const perGroup = state.particles.length / speeds.length;
    state.speedGroups = speeds.map(speed => ({ speed, count: perGroup }));
    // 每半箱有三組完整的四面體方向，改速率後三軸均方分量仍相同。
    state.particles.forEach((p, i) => {
      const speed = speeds[Math.floor(i / perGroup)];
      const scale = speed / (gas.SPEED_UNIT * Math.hypot(p.vx, p.vy, p.vz));
      p.vx *= scale;
      p.vy *= scale;
      p.vz *= scale;
    });
    return state;
  }

  function readings(state) {
    const { total2, x2 } = gas.moments(state);
    const count = state.particles.length;
    const meanSpeed = gas.SPEED_UNIT * state.particles.reduce((sum, p) => sum + Math.hypot(p.vx, p.vy, p.vz), 0) / count;
    const meanSquare = total2 * gas.SPEED_UNIT ** 2 / count;
    const mean = mass * meanSquare / 2;
    // 每個粒子在同一面牆的長時間平均動量轉移率除以面積。
    const pressure = mass * x2 * gas.SPEED_UNIT ** 2 / volume;
    return { count, meanSpeed, meanSquare, pressure, mean, total: count * mean, temperature: 2 * mean / (3 * boltzmann) };
  }
  return { create, createComparisonBox, setControls, readings, advance: gas.advance, defaults, mass, volume, impactWindow };
});
