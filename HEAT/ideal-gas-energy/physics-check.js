const assert = require("node:assert/strict");
const { snapshot, moveParticle, createParticles, setKinetic, step, bounds } = require("./model.js");
for (const count of [2, 4, 8, 16, 32]) {
  const particles = createParticles(count, 2);
  const initial = snapshot(particles);
  assert.equal(initial.pairs.length, count * (count - 1) / 2);
  assert.ok(initial.pairs.every(pair => pair.distance >= 0.8));
  assert.ok(Math.abs(initial.kinetic - count * 2) < 1e-10);
  const idealState = snapshot(particles, false);
  assert.equal(idealState.potential, 0);
  assert.equal(idealState.pairs.length, 0);
  assert.equal(idealState.kinetic, initial.kinetic);
  const combined = particles.map(p => ({ ...p })), separate = particles.map(p => ({ ...p }));
  step(combined, 0.04, true);
  for (let i = 0; i < 8; i++) step(separate, 0.005, true);
  combined.forEach((p, i) => {
    for (const key of ["x", "y", "vx", "vy"]) assert.ok(Math.abs(p[key] - separate[i][key]) < 1e-10, "合併半步加速不可改變軌跡");
  });
  const before = particles.map(p => ({ ...p }));
  for (let i = 0; i < 100; i++) step(particles, 0.04);
  assert.ok(particles.some((p, i) => Math.hypot(p.x - before[i].x, p.y - before[i].y) > 0.01));
  assert.ok(particles.every(p => Math.abs(p.x) <= 4.15 && Math.abs(p.y) <= 2.5));
  assert.ok(Math.abs(snapshot(particles).kinetic - initial.kinetic) < 1e-9);
  setKinetic(particles, 4);
  assert.ok(Math.abs(snapshot(particles).kinetic - count * 4) < 1e-9);
}
const collision = [{ x: -0.42, y: 0, vx: 1, vy: 0 }, { x: 0.42, y: 0, vx: -1, vy: 0 }];
step(collision, 0.04);
assert.ok(collision[0].vx < 0 && collision[1].vx > 0);
// 極短步長分辨碰撞有否耗散；左邊仍保留吸引力的微小作用。
for (const interacting of [false, true]) {
  const separation = (0.8 + 1e-10) / Math.sqrt(2);
  const oblique = [
    { x: -separation / 2, y: -separation / 2, vx: 1.6, vy: 0.3 },
    { x: separation / 2, y: separation / 2, vx: -0.2, vy: -0.7 }
  ];
  const beforeKinetic = snapshot(oblique).kinetic;
  const beforeMomentum = { x: oblique[0].vx + oblique[1].vx, y: oblique[0].vy + oblique[1].vy };
  step(oblique, 1e-8, interacting);
  assert.ok(oblique.every(p => p.flash > 0), "兩邊均須實際發生碰撞");
  assert.ok(Math.abs(snapshot(oblique).kinetic - beforeKinetic) < 1e-7, "斜碰撞不可耗散總動能");
  assert.ok(Math.abs(oblique[0].vx + oblique[1].vx - beforeMomentum.x) < 1e-12);
  assert.ok(Math.abs(oblique[0].vy + oblique[1].vy - beforeMomentum.y) < 1e-12);
  const wallContact = [{ x: 4.15 - 1e-10, y: 0, vx: 1, vy: 0.3 }, { x: 0, y: 1, vx: 0, vy: 0 }];
  const wallKinetic = snapshot(wallContact).kinetic;
  step(wallContact, 1e-8, interacting);
  assert.ok(wallContact[0].vx < 0 && wallContact[0].flash > 0);
  assert.ok(Math.abs(snapshot(wallContact).kinetic - wallKinetic) < 1e-7, "兩邊撞牆均不可耗散動能");
}
const encounter = [{ x: -1, y: 0, vx: 1, vy: 0 }, { x: 1, y: 0, vx: -1, vy: 0 }];
const encounterInitial = snapshot(encounter);
let collided = false;
for (let i = 0; i < 15000; i++) {
  step(encounter, 0.0002, true);
  collided ||= encounter.some(p => p.flash > 0);
  if (collided && encounter[1].x - encounter[0].x >= 2) break;
}
const encounterFinal = snapshot(encounter);
assert.ok(collided && encounterFinal.pairs[0].distance >= 2, "左邊分子須完成接近、碰撞及分開");
assert.ok(Math.abs(encounterFinal.kinetic + encounterFinal.potential - encounterInitial.kinetic - encounterInitial.potential) < 0.001, "含吸引力與彈性碰撞的過程須近似守恆總能量");
const particles = createParticles(2, 2);
const initialPotential = snapshot(particles).potential;
assert.ok(moveParticle(particles, 1, 3, 0));
assert.ok(Math.abs(snapshot(particles).potential) < Math.abs(initialPotential));
assert.equal(moveParticle(particles, 1, particles[0].x, particles[0].y), false);
assert.ok(moveParticle(particles, 1, 99, 0));
assert.equal(particles[1].x, 4.15);
assert.throws(() => createParticles(3, 2), RangeError);
const real = [{ x: -1, y: 0, vx: 0, vy: 0 }, { x: 1, y: 0, vx: 0, vy: 0 }];
const ideal = real.map(p => ({ ...p }));
const initial = snapshot(real);
for (let i = 0; i < 300; i++) { step(real, 0.005, true); step(ideal, 0.005); }
const final = snapshot(real);
assert.ok(real[0].x > ideal[0].x && real[1].x < ideal[1].x);
assert.ok(final.kinetic > initial.kinetic && final.potential < initial.potential);
assert.ok(Math.abs(final.kinetic + final.potential - initial.kinetic - initial.potential) < 0.0001);
for (const size of [1, 2, 4, 8]) {
  const dense = createParticles(32, 2), dilute = createParticles(32, 2, size);
  dilute.forEach((p, i) => {
    assert.equal(p.x, dense[i].x * size); assert.equal(p.y, dense[i].y * size);
    assert.equal(p.vx, dense[i].vx); assert.equal(p.vy, dense[i].vy);
  });
  assert.equal(snapshot(dilute).kinetic, snapshot(dense).kinetic, "放大容器不可改變初始動能");
  assert.ok(Math.abs(snapshot(dilute).potential) <= Math.abs(snapshot(dense).potential));
  const limit = bounds(size);
  const wall = [{ x: limit.x - 0.01, y: 0, vx: 1, vy: 0 }, { x: 0, y: 1, vx: 0, vy: 0 }];
  step(wall, 0.04, false, size);
  assert.ok(wall[0].vx < 0 && wall[0].flash > 0);
  assert.equal(snapshot(wall).kinetic, 0.5);
  assert.ok(wall.every(p => Math.abs(p.x) <= limit.x && Math.abs(p.y) <= limit.y));
  moveParticle(wall, 0, 999, -999, size);
  assert.equal(wall[0].x, limit.x); assert.equal(wall[0].y, -limit.y);
  const contact = [{ x: -0.42, y: 0, vx: 1, vy: 0 }, { x: 0.42, y: 0, vx: -1, vy: 0 }];
  step(contact, 0.04, false, size);
  assert.ok(contact[0].vx < 0 && contact[1].vx > 0, "分子的碰撞半徑不可隨容器縮小");
  assert.ok(contact.every(p => p.flash > 0));
  for (let i = 0; i < 3; i++) step(contact, 0.04, false, size);
  assert.ok(contact.every(p => p.flash === 0), "碰撞提示須很快消失，分子繼續自由運動");
}
for (const size of [0, 9, NaN, Infinity]) assert.throws(() => createParticles(2, 2, size), RangeError);
const diluteReal = createParticles(2, 2, 8), diluteIdeal = diluteReal.map(p => ({ ...p }));
for (let i = 0; i < 120; i++) { step(diluteReal, 1 / 60, true, 8); step(diluteIdeal, 1 / 60, false, 8); }
diluteReal.forEach((p, i) => {
  for (const key of ["x", "y", "vx", "vy"]) assert.ok(Math.abs(p[key] - diluteIdeal[i][key]) < 1e-9, "稀薄時兩邊短時間運動應接近");
});
console.log("粒子運動、容器縮放、能量及即時彈性碰撞檢查通過");
