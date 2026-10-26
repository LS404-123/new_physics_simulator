'use strict';
const assert = require('node:assert/strict');
const { solve, pressureRise, MAX_STROKES } = require('./model.js');
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} ≠ ${expected}`);

near(pressureRise, 2);
near(solve(0).pressure, 100);
near(solve(1).pressure, 102);
near(solve(27).pressure, 154);
assert.equal(solve(27).reached, false);
const target = solve(28);
assert.equal(target.reached, true);
near(target.pressure, 156);
near(target.addedVolume, 3360);
near(target.equivalentVolume, 9360);

for (let n = 0; n < MAX_STROKES; n++) {
  let previousPressure = solve(n).pressure;
  for (let step = 0; step <= 100; step++) {
    const state = solve(n, step / 100);
    assert.ok(state.pressure >= previousPressure - 1e-7, '推進及抽回時不可漏氣');
    near(state.pressure * 6000, 100 * state.equivalentVolume);
    if (state.cycle < 0.7) {
      near(state.pressure * 6000 + state.pumpPressure * state.pumpVolume,
        100 * (6000 + (n + 1) * 120));
      assert.ok(state.pumpPressure <= state.pressure + 1e-7);
    } else {
      near(state.pressure, solve(n + 1).pressure);
      assert.equal(state.valveOpen, false);
    }
    previousPressure = state.pressure;
  }
  near(solve(n, 1).equivalentVolume, solve(n + 1).equivalentVolume);
}
assert.equal(solve(20, 0.1).valveOpen, false, '高球壓下先壓縮，不能立即入氣');
for (const args of [[-1], [0.5], [41], [0, -0.1], [0, 1.1], [40, 0.1], [NaN], [0, NaN]]) {
  assert.throws(() => solve(...args), RangeError);
}
const { SPEED, RADIUS, HEIGHT, BASE_WIDTH, create, advance } = require('./particles.js');
const boxHit = { x: BASE_WIDTH - 1, y: 40, vx: SPEED, vy: 0 };
assert.equal(advance(boxHit, 'box', 0.05).length, 1);
assert.equal(boxHit.vx, -SPEED);
const corner = { x: BASE_WIDTH - 1, y: HEIGHT - 1, vx: 30, vy: 30 };
assert.equal(advance(corner, 'box', 0.05).length, 1);
assert.equal(corner.vx, -30); assert.equal(corner.vy, -30);
const radial = { x: RADIUS - 1, y: 0, vx: SPEED, vy: 0 };
const impact = advance(radial, 'ball', 0.05);
assert.equal(impact.length, 1); near(impact[0].x, RADIUS); near(radial.vx, -SPEED);

function countHits(shape, count, width) {
  const gas = Array.from({ length: count }, (_, i) => create(i, shape, width));
  let hits = 0;
  for (let step = 0; step < 3600; step++) {
    for (const p of gas) {
      const collisions = advance(p, shape, 1 / 60, width);
      if (step >= 600) hits += collisions.length;
      near(Math.hypot(p.vx, p.vy), SPEED);
      if (shape === 'ball') assert.ok(Math.hypot(p.x, p.y) <= RADIUS + 1e-7, '粒子不可穿過球壁');
      else assert.ok(p.x >= -1e-7 && p.x <= width + 1e-7 && p.y >= -1e-7 && p.y <= HEIGHT + 1e-7, '粒子不可穿過容器壁');
    }
  }
  return hits;
}
const ballRatio = countHits('ball', 78, BASE_WIDTH) / countHits('ball', 50, BASE_WIDTH);
assert.ok(ballRatio > 1.35 && ballRatio < 1.8, '同速率、固定容器下，加氣應增加撞壁頻率');
const expandedWidth = 240 * solve(28).gasRatio - 6.6;
const densityRatio = countHits('box', 78, expandedWidth) / (2 * (expandedWidth + HEIGHT)) /
  (countHits('box', 50, BASE_WIDTH) / (2 * (BASE_WIDTH + HEIGHT)));
assert.ok(Math.abs(densityRatio - 1) < 0.12, '等壓等效空間擴大後，每單位壁長的撞擊頻率應相近');
assert.throws(() => advance(radial, 'ball', -1), RangeError);
console.log('通過：打氣守恆、28次達標、粒子速率守恆、壁面反射及加氣撞擊頻率。');
