(function (root) {
  "use strict";
  const COUNT = 16;
  const RADIUS = 9;
  const PHASES = {
    solid: { label: "固體", description: "粒子排列緊密，在固定位置附近振動。", potential: "較低", bar: 24 },
    liquid: { label: "液體", description: "粒子仍然靠近，可以互相移動。", potential: "較高", bar: 55 },
    gas: { label: "氣體", description: "粒子相距較遠，在容器內自由移動。", potential: "最高", bar: 88 }
  };

  function createState(phase = "solid", speed = 1) {
    if (!Object.hasOwn(PHASES, phase) || !Number.isFinite(speed) || speed < 0 || speed > 2) {
      throw new RangeError("物態或速率無效");
    }
    const particles = Array.from({ length: COUNT }, (_, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      let x, y, bounds;
      if (phase === "solid") {
        x = 269 + col * 54; y = 132.5 + row * 54;
        bounds = { left: x - 7, right: x + 7, top: y - 7, bottom: y + 7 };
      } else if (phase === "liquid") {
        x = 196 + col * 95 + Math.sin(i * 2.4) * 18;
        y = 235 + row * 37;
        bounds = { left: 162, right: 538, top: 220, bottom: 369 };
      } else {
        x = 118 + col * 152 + Math.sin(i * 2.4) * 20;
        y = 100 + row * 78;
        bounds = { left: 62, right: 638, top: 60, bottom: 369 };
      }
      const angle = i * 2.399963 + 0.37;
      return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, bounds };
    });
    return { phase, speed, particles };
  }

  function setSpeed(state, speed) {
    if (!Number.isFinite(speed) || speed < 0 || speed > 2) throw new RangeError("速率無效");
    const currentSpeed = Math.sqrt(averageKinetic(state));
    state.particles.forEach((p, i) => {
      const angle = i * 2.399963 + 0.37;
      p.vx = currentSpeed > 0 ? p.vx * speed / currentSpeed : Math.cos(angle) * speed;
      p.vy = currentSpeed > 0 ? p.vy * speed / currentSpeed : Math.sin(angle) * speed;
    });
    state.speed = speed;
  }

  function averageKinetic(state) {
    // 等質量粒子；以速率 1 時每粒子的平均動能作基準。
    return state.particles.reduce((sum, p) => sum + p.vx ** 2 + p.vy ** 2, 0) / state.particles.length;
  }

  function step(state, elapsed) {
    const dt = Math.min(0.04, Math.max(0, elapsed));
    if (state.phase !== "solid") { stepFluid(state.particles, dt * 52); return; }
    // 固體只示意固定位置附近的振動，不模擬物態轉變。
    for (const p of state.particles) {
      p.x += p.vx * 52 * dt; p.y += p.vy * 52 * dt;
      for (const [axis, low, high] of [["x", "left", "right"], ["y", "top", "bottom"]]) {
        if (p[axis] < p.bounds[low]) {
          p[axis] = 2 * p.bounds[low] - p[axis]; p["v" + axis] *= -1;
        } else if (p[axis] > p.bounds[high]) {
          p[axis] = 2 * p.bounds[high] - p[axis]; p["v" + axis] *= -1;
        }
      }
    }
  }

  function stepFluid(particles, remaining) {
    // ponytail: 16 個粒子逐對找下一次接觸；大量粒子才需要空間分區。
    // 移到接觸一刻才碰撞，避免高速度時穿透或靠推開重疊粒子補救。
    while (remaining > 1e-10) {
      let travel = remaining, contact = null;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        for (const [axis, low, high] of [["x", "left", "right"], ["y", "top", "bottom"]]) {
          const velocity = p["v" + axis];
          if (velocity === 0) continue;
          const wall = velocity > 0 ? p.bounds[high] : p.bounds[low];
          const time = Math.max(0, (wall - p[axis]) / velocity);
          if (time <= travel) { travel = time; contact = { p, axis }; }
        }
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x, dy = p.y - q.y;
          const vx = p.vx - q.vx, vy = p.vy - q.vy;
          const approach = dx * vx + dy * vy;
          if (approach >= -1e-10) continue;
          const speed2 = vx * vx + vy * vy;
          const discriminant = approach * approach - speed2 * (dx * dx + dy * dy - (2 * RADIUS) ** 2);
          if (discriminant <= 0) continue;
          const time = Math.max(0, (-approach - Math.sqrt(discriminant)) / speed2);
          if (time <= travel) { travel = time; contact = { p, q }; }
        }
      }
      for (const p of particles) { p.x += p.vx * travel; p.y += p.vy * travel; }
      remaining -= travel;
      if (!contact) break;
      const { p, q, axis } = contact;
      if (axis) { p["v" + axis] *= -1; continue; }
      const distance = Math.hypot(p.x - q.x, p.y - q.y);
      const nx = (p.x - q.x) / distance, ny = (p.y - q.y) / distance;
      const normalVelocity = (p.vx - q.vx) * nx + (p.vy - q.vy) * ny;
      // 等質量完全彈性碰撞：交換法向速度，保留切向速度。
      p.vx -= normalVelocity * nx; p.vy -= normalVelocity * ny;
      q.vx += normalVelocity * nx; q.vy += normalVelocity * ny;
    }
  }
  const model = { COUNT, RADIUS, PHASES, createState, setSpeed, averageKinetic, step };
  if (typeof module !== "undefined" && module.exports) module.exports = model;
  else root.ParticleModel = model;
})(globalThis);
