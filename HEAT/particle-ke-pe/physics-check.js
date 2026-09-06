"use strict";
const assert = require("node:assert/strict");
const M = require("./model.js");
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-9, `${a} ≠ ${b}`);
for (const phase of Object.keys(M.PHASES)) {
  const state = M.createState(phase, 1);
  near(M.averageKinetic(state), 1);
  const positions = state.particles.map(p => [p.x,p.y]);
  M.setSpeed(state, 2);
  near(M.averageKinetic(state), 4);
  assert.deepEqual(state.particles.map(p => [p.x,p.y]), positions);
  assert.equal(state.phase, phase);
  for (let i=0;i<3000;i++) {
    M.step(state, 1/30);
    assert.ok(state.particles.every(p => p.x >= p.bounds.left && p.x <= p.bounds.right && p.y >= p.bounds.top && p.y <= p.bounds.bottom));
    if (phase !== "solid") {
      for (let a = 0; a < state.particles.length; a++) {
        for (let b = a + 1; b < state.particles.length; b++) {
          const p = state.particles[a], q = state.particles[b];
          assert.ok(Math.hypot(p.x - q.x, p.y - q.y) >= 2 * M.RADIUS - 1e-7, "流體粒子不可重疊");
        }
      }
    }
  }
  near(M.averageKinetic(state), 4);
  assert.ok(state.particles.some((p,i) => p.x !== positions[i][0] || p.y !== positions[i][1]));
  M.setSpeed(state, 0);
  const stopped = structuredClone(state.particles);
  M.step(state, 1/30);
  near(M.averageKinetic(state), 0);
  assert.deepEqual(state.particles, stopped);
  M.setSpeed(state, 0.5); near(M.averageKinetic(state), 0.25);
}
for (const phase of ["liquid", "gas"]) {
  for (const offset of [0, 5]) {
    const bounds = { left: -100, right: 100, top: -100, bottom: 100 };
    const state = { phase, speed: 1, particles: [
      { x: -10, y: 0, vx: 1, vy: 0, bounds },
      { x: 10, y: offset, vx: -1, vy: 0, bounds }
    ] };
    M.step(state, 0.04);
    const [p, q] = state.particles;
    assert.ok(p.vx < 0 && q.vx > 0, "接觸後必須反彈");
    near(p.vx + q.vx, 0); near(p.vy + q.vy, 0);
    near(M.averageKinetic(state), 1);
    if (offset === 0) { near(p.vx, -1); near(q.vx, 1); }
    else assert.ok(Math.abs(p.vy) > 0, "斜碰應改變運動方向");
  }
}
const solid = M.createState("solid");
near(solid.particles.reduce((sum,p) => sum+p.x,0)/M.COUNT, 350);
near(solid.particles.reduce((sum,p) => sum+p.y,0)/M.COUNT, 213.5);
assert.ok(M.PHASES.solid.bar < M.PHASES.liquid.bar && M.PHASES.liquid.bar < M.PHASES.gas.bar);
assert.throws(() => M.createState("unknown"), RangeError);
assert.throws(() => M.createState("solid",NaN), RangeError);
assert.throws(() => M.setSpeed(M.createState(),-1), RangeError);
console.log("通過：正碰／斜碰、碰撞動量及動能守恆、長時間不重疊、固體置中、速率平方關係及三物態能量顯示。");

