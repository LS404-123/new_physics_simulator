(function (root) {
  "use strict";
  // 示意模型：距離及能量均以任意共同單位表示。
  function bounds(size = 1) {
    if (!Number.isFinite(size) || size < 1 || size > 8) throw new RangeError("無效的容器大小");
    // 容器邊長改變，分子的實際半徑仍是 0.4。
    return { x: 4.15 + 4.55 * (size - 1), y: 2.5 + 2.9 * (size - 1) };
  }
  function snapshot(particles, interacting = true) {
    if (!Array.isArray(particles) || particles.length < 2 || particles.length > 32 || particles.some(p => ![p.x, p.y, p.vx, p.vy].every(Number.isFinite))) throw new RangeError("無效的模擬狀態");
    const count = particles.length;
    const pairs = [];
    if (interacting) for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) {
      const distance = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
      // 示意吸引勢能，並非任何特定氣體的量度結果。
      const potential = -Math.exp(-distance * distance / 2);
      pairs.push({ i, j, distance, potential });
    }
    const kinetic = particles.reduce((sum, p) => sum + (p.vx ** 2 + p.vy ** 2) / 2, 0);
    const potential = pairs.reduce((sum, pair) => sum + pair.potential, 0);
    return { particles, pairs, kinetic, potential };
  }
  function moveParticle(particles, index, x, y, size = 1) {
    if (!particles[index] || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    const limit = bounds(size);
    x = Math.max(-limit.x, Math.min(limit.x, x));
    y = Math.max(-limit.y, Math.min(limit.y, y));
    if (particles.some((p, i) => i !== index && Math.hypot(p.x - x, p.y - y) < 0.8)) return false;
    particles[index].x = x;
    particles[index].y = y;
    particles[index].flash = 0;
    return true;
  }
  function setKinetic(particles, kineticPerParticle) {
    if (!Number.isFinite(kineticPerParticle) || kineticPerParticle <= 0) throw new RangeError("無效的動能");
    const current = particles.reduce((sum, p) => sum + (p.vx ** 2 + p.vy ** 2) / 2, 0);
    const scale = Math.sqrt(particles.length * kineticPerParticle / current);
    for (const p of particles) { p.vx *= scale; p.vy *= scale; }
  }
  function createParticles(count, kineticPerParticle, size = 1) {
    if (![2, 4, 8, 16, 32].includes(count)) throw new RangeError("無效的分子數目");
    bounds(size);
    const columns = count === 2 ? 2 : count === 4 ? 2 : count === 8 ? 4 : count === 16 ? 4 : 8;
    const rows = count / columns;
    const dx = Math.min(2, 8 / (columns - 1));
    const dy = rows === 1 ? 0 : Math.min(1.6, 4.8 / (rows - 1));
    const particles = Array.from({ length: count }, (_, i) => {
      const angle = i * 2.399963 + 0.6, speed = 0.8 + (i % 5) * 0.1;
      return { x: (i % columns - (columns - 1) / 2) * dx * size, y: (Math.floor(i / columns) - (rows - 1) / 2) * dy * size, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, flash: 0 };
    });
    setKinetic(particles, kineticPerParticle);
    return particles;
  }
  function accelerate(particles, dt) {
    for (let i = 0; i < particles.length; i++) for (let j = i + 1; j < particles.length; j++) {
      const a = particles[i], b = particles[j], dx = b.x - a.x, dy = b.y - a.y;
      const factor = Math.exp(-(dx * dx + dy * dy) / 2) * dt;
      a.vx += dx * factor; a.vy += dy * factor;
      b.vx -= dx * factor; b.vy -= dy * factor;
    }
  }
  function step(particles, elapsed, interacting = false, size = 1) {
    const limit = bounds(size);
    const duration = Math.min(0.04, Math.max(0, elapsed)) * 0.55;
    const substeps = Math.max(1, Math.ceil(duration / 0.003));
    const dt = duration / substeps;
    if (interacting) accelerate(particles, dt / 2);
    for (let s = 0; s < substeps; s++) {
      for (const p of particles) {
        // 短暫餘光只標示碰撞事件，不是接觸時間，也不參與動力計算。
        p.flash = Math.max(0, (p.flash || 0) - dt);
        p.x += p.vx * dt; p.y += p.vy * dt;
        for (const axis of ["x", "y"]) {
          if (Math.abs(p[axis]) > limit[axis]) {
            p[axis] = Math.sign(p[axis]) * limit[axis];
            p["v" + axis] = -Math.sign(p[axis]) * Math.abs(p["v" + axis]);
            p.flash = 0.035;
          }
        }
      }
      for (let i = 0; i < particles.length; i++) for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j], dx = b.x - a.x, dy = b.y - a.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared >= 0.8 * 0.8 || distanceSquared === 0) continue;
        const distance = Math.sqrt(distanceSquared);
        const nx = dx / distance, ny = dy / distance, overlap = (0.8 - distance) / 2;
        a.x -= nx * overlap; a.y -= ny * overlap; b.x += nx * overlap; b.y += ny * overlap;
        const approach = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (approach < 0) {
          a.vx += approach * nx; a.vy += approach * ny; b.vx -= approach * nx; b.vy -= approach * ny;
          a.flash = b.flash = 0.035;
        }
      }
      for (const p of particles) { p.x = Math.max(-limit.x, Math.min(limit.x, p.x)); p.y = Math.max(-limit.y, Math.min(limit.y, p.y)); }
      // 相鄰小步在同一位置的兩次半步加速可合併，毋須重算作用力。
      if (interacting) accelerate(particles, s === substeps - 1 ? dt / 2 : dt);
    }
  }
  const model = { snapshot, moveParticle, createParticles, setKinetic, step, bounds };
  if (typeof module !== "undefined" && module.exports) module.exports = model;
  else root.IdealGasEnergy = model;
})(globalThis);
