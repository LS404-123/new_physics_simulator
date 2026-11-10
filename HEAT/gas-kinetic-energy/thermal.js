(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./model.js"), require("../kinetic-gas/model.js"));
  else root.ThermalGas = factory(root.GasEnergy, root.KineticGas);
})(globalThis, function (energy, gas) {
  "use strict";
  const axes = ["x", "y", "z"];
  const binWidth = 80, bins = 16; // 最後一欄包含 1200 m/s 或以上。
  const sampleStep = 0.5, windowSize = 32;

  function histogram(particles) {
    const counts = Array(bins).fill(0);
    for (const p of particles) {
      const speed = gas.SPEED_UNIT * Math.hypot(p.vx, p.vy, p.vz);
      counts[Math.min(bins - 1, Math.floor(speed / binWidth))]++;
    }
    return counts;
  }

  // 把三維平衡速率密度積分成相同組距的預期粒子數。此函數只供繪圖。
  function equilibriumCounts(meanSquare, count) {
    const sigma = Math.sqrt(meanSquare / 3);
    const density = v => Math.sqrt(2 / Math.PI) * v ** 2 / sigma ** 3 * Math.exp(-0.5 * (v / sigma) ** 2);
    const expected = [];
    let total = 0;
    for (let i = 0; i < bins - 1; i++) {
      const a = i * binWidth, b = a + binWidth;
      const n = count * binWidth * (density(a) + 4 * density((a + b) / 2) + density(b)) / 6;
      expected.push(n);
      total += n;
    }
    expected.push(Math.max(0, count - total));
    return expected;
  }

  function create() {
    const box = energy.createMixedBox(80);
    delete box.speedGroups;
    const radius = box.width * 0.01875;
    const grid = Math.ceil(Math.cbrt(box.particles.length));
    // 把粒子分放在不重疊的格子內，保留 B 箱的初速及三維方向。
    box.particles.forEach((p, i) => {
      let cell = i * 11 % (grid ** 3);
      for (const axis of axes) {
        const jitter = (p[axis] / box.width - 0.5) * 0.45;
        p[axis] = (cell % grid + 0.5 + jitter) * box.width / grid;
        cell = Math.floor(cell / grid);
      }
    });
    const initial = histogram(box.particles);
    box.thermal = { radius, collisions: 0, rightImpulse: 0, samples: [], counts: initial, nextSample: sampleStep,
      expected: equilibriumCounts(energy.readings(box).meanSquare, box.particles.length) };
    return box;
  }

  function fly(box, duration) {
    const { radius } = box.thermal;
    const particles = box.particles;
    let remaining = duration;
    while (remaining > 0) {
      let first, second, wall, time = remaining;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        for (const axis of axes) {
          const v = p["v" + axis];
          if (!v) continue;
          const t = ((v > 0 ? box.width - radius : radius) - p[axis]) / v;
          if (t >= -1e-10 && t <= time) {
            time = Math.max(0, t); first = p; second = null; wall = axis;
          }
        }
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z;
          const vx = q.vx - p.vx, vy = q.vy - p.vy, vz = q.vz - p.vz;
          const dot = dx * vx + dy * vy + dz * vz;
          if (dot >= 0) continue;
          const gap = dx * dx + dy * dy + dz * dz - 4 * radius ** 2;
          const disc = dot * dot - (vx * vx + vy * vy + vz * vz) * gap;
          if (disc <= 0) continue;
          const t = gap / (-dot + Math.sqrt(disc));
          if (t >= -1e-10 && t <= time) {
            time = Math.max(0, t); first = p; second = q; wall = null;
          }
        }
      }
      for (const p of particles) { p.x += p.vx * time; p.y += p.vy * time; p.z += p.vz * time; }
      box.time += time;
      remaining -= time;
      if (!first) break;
      if (wall) {
        const key = "v" + wall;
        if (wall === "x" && first.vx > 0) {
          const impulse = 2 * first.vx;
          box.thermal.rightImpulse += impulse;
          box.hits.push({ axis: "x", side: 1, z: first.z, impulse, time: box.time });
        }
        first[key] *= -1;
      } else {
        // 等質量硬球只交換沿兩球心連線的速度分量。
        const dx = second.x - first.x, dy = second.y - first.y, dz = second.z - first.z;
        const factor = ((second.vx - first.vx) * dx + (second.vy - first.vy) * dy + (second.vz - first.vz) * dz)
          / (dx * dx + dy * dy + dz * dz);
        first.vx += factor * dx; first.vy += factor * dy; first.vz += factor * dz;
        second.vx -= factor * dx; second.vy -= factor * dy; second.vz -= factor * dz;
        box.thermal.collisions++;
      }
    }
  }

  function advance(box, dt) {
    if (!Number.isFinite(dt) || dt < 0 || dt > 0.1) throw new RangeError("粒子時間步長超出範圍");
    const end = box.time + dt, thermal = box.thermal;
    while (thermal.nextSample <= end) {
      fly(box, thermal.nextSample - box.time);
      box.time = thermal.nextSample;
      thermal.nextSample += sampleStep;
      thermal.samples.push(histogram(box.particles));
      if (thermal.samples.length > windowSize) thermal.samples.shift();
      thermal.counts = thermal.samples[0].map((_, i) => thermal.samples.reduce((sum, s) => sum + s[i], 0) / thermal.samples.length);
    }
    fly(box, end - box.time);
    box.time = end;
    box.hits = box.hits.filter(hit => end - hit.time < 2 * energy.impactWindow);
  }

  function wallPressure(box) {
    const side = Math.cbrt(energy.volume);
    const seconds = box.time * side / (box.width * gas.SPEED_UNIT);
    return seconds ? box.thermal.rightImpulse * energy.mass * gas.SPEED_UNIT / (side ** 2 * seconds) : null;
  }
  return { create, advance, histogram, equilibriumCounts, binWidth, wallPressure };
});
