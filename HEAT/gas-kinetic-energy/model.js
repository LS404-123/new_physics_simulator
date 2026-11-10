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

  function readings(state) {
    const { total2, x2 } = gas.moments(state);
    const count = state.particles.length;
    const meanSquare = total2 * gas.SPEED_UNIT ** 2 / count;
    const mean = mass * meanSquare / 2;
    // 每個粒子在同一面牆的長時間平均動量轉移率除以面積。
    const pressure = mass * x2 * gas.SPEED_UNIT ** 2 / volume;
    return { count, meanSquare, pressure, mean, total: count * mean, temperature: 2 * mean / (3 * boltzmann) };
  }
  return { create, setControls, readings, advance: gas.advance, defaults, mass, volume, impactWindow };
});
