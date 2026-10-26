(function (root) {
  'use strict';
  const SPEED = 68, RADIUS = 110.7, HEIGHT = 153.4, BASE_WIDTH = 233.4;

  function create(index, shape, width = BASE_WIDTH) {
    const u = (0.23 + index * 0.61803398875) % 1;
    const v = (0.41 + index * 0.754877666) % 1;
    let angle = 2 * Math.PI * v;
    const radius = RADIUS * 0.9 * Math.sqrt(u);
    const particle = shape === 'ball'
      ? { x: radius * Math.cos(index * 2.4), y: radius * Math.sin(index * 2.4) }
      : { x: u * width, y: v * HEIGHT };
    if (shape === 'ball' && index >= 50) {
      particle.x = RADIUS - 0.1; particle.y = 0;
      angle = Math.PI + (v - 0.5) * Math.PI / 2;
    }
    return { ...particle, vx: SPEED * Math.cos(angle), vy: SPEED * Math.sin(angle) };
  }

  function advance(particle, shape, dt, width = BASE_WIDTH) {
    if (!Number.isFinite(dt) || dt < 0 || dt > 0.1 || !Number.isFinite(width) || width <= 0) {
      throw new RangeError('粒子步長或容器寬度超出範圍');
    }
    const hits = [];
    let remaining = dt;
    while (remaining > 1e-9) {
      const { x, y, vx, vy } = particle;
      let hitTime, tx, ty;
      if (shape === 'ball') {
        const speed2 = vx * vx + vy * vy;
        const dot = x * vx + y * vy;
        hitTime = (-dot + Math.sqrt(Math.max(0, dot * dot + speed2 * (RADIUS * RADIUS - x * x - y * y)))) / speed2;
      } else {
        tx = vx > 0 ? (width - x) / vx : vx < 0 ? -x / vx : Infinity;
        ty = vy > 0 ? (HEIGHT - y) / vy : vy < 0 ? -y / vy : Infinity;
        hitTime = Math.min(tx, ty);
      }
      const travel = Math.min(remaining, Math.max(0, hitTime));
      particle.x += vx * travel; particle.y += vy * travel;
      remaining -= travel;
      if (hitTime > travel + 1e-9) break;
      let nx = 0, ny = 0;
      if (shape === 'ball') {
        const distance = Math.hypot(particle.x, particle.y);
        nx = particle.x / distance; ny = particle.y / distance;
        const normalSpeed = particle.vx * nx + particle.vy * ny;
        particle.vx -= 2 * normalSpeed * nx; particle.vy -= 2 * normalSpeed * ny;
      } else {
        if (Math.abs(tx - hitTime) < 1e-8) { nx = Math.sign(vx); particle.vx = -vx; }
        if (Math.abs(ty - hitTime) < 1e-8) { ny = Math.sign(vy); particle.vy = -vy; }
      }
      hits.push({ x: particle.x, y: particle.y, nx, ny });
      // 把浮點位置移回壁內，避免同一碰撞在下一步再次被計算。
      particle.x -= nx * 1e-7; particle.y -= ny * 1e-7;
    }
    return hits;
  }

  const model = { SPEED, RADIUS, HEIGHT, BASE_WIDTH, create, advance };
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.GasParticles = model;
})(globalThis);
