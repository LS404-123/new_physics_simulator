// 執行：node gas-mole/test-model.js
'use strict';
const assert = require('node:assert/strict');
const M = require('./model.js');
assert.equal(M.AVOGADRO.toString(), '602214076000000000000000');
for (let atoms = 1; atoms <= 24; atoms++) {
  const s = M.snapshot(0, atoms, 1, 1);
  assert.equal(s.count, BigInt(atoms));
  assert.equal(s.dots, atoms);
  assert.equal(s.atomsPerDot, 1n);
}
for (const groups of [1, 2]) {
  const dozen = M.snapshot(1, 6, groups, 1);
  assert.equal(dozen.count, BigInt(12 * groups));
  assert.equal(dozen.groups, groups);
  assert.equal(dozen.dotsPerGroup, 12);
  assert.equal(dozen.groups * dozen.dotsPerGroup, dozen.dots);
}
for (const groups of [1, 2, 3, 4, 5]) {
  const s = M.snapshot(3, 6, 1, groups);
  assert.equal(s.count, M.AVOGADRO * BigInt(groups));
  assert.equal(s.moles, groups);
  assert.equal(s.groups, groups);
  assert.equal(s.dotsPerGroup, 100);
  assert.equal(s.groups * s.dotsPerGroup, s.dots);
  assert.equal(s.count, BigInt(s.dots) * s.atomsPerDot, '示意點與真實總數必須一致');
  assert.equal(M.snapshot(2, 6, 1, groups).count, M.AVOGADRO, '定義步驟永遠顯示 1 mol');
  assert.equal(M.snapshot(2, 6, 1, groups).groups, 1);
}
assert.equal(M.snapshot(3, 6, 1, 2).count, 2n * M.snapshot(3, 6, 1, 1).count);
assert.equal(M.snapshot(3, 6, 1, 5).count, 3011070380000000000000000n);
assert.equal(M.scientific(M.AVOGADRO), '6.02214076\\times 10^{23}');
assert.equal(M.scientific(24n), '24');
for (const args of [[4, 6, 1, 1], [0, 0, 1, 1], [1, 6, 3, 1], [1, 6, 1.5, 1], [3, 6, 1, 0], [3, 6, 1, .5], [3, 6, 1, 1.5], [3, 6, 1, 6], [3, 6, 1, NaN]]) assert.throws(() => M.snapshot(...args), RangeError);
const particles = [{ x: .99, y: .01, vx: .2, vy: -.3 }];
const speedSquared = particles[0].vx ** 2 + particles[0].vy ** 2;
M.advance(particles, .2);
assert.ok(particles[0].vx < 0 && particles[0].vy > 0, '撞牆後應反向');
for (let i = 0; i < 500; i++) {
  M.advance(particles, .05);
  assert.ok(particles[0].x >= 0 && particles[0].x <= 1 && particles[0].y >= 0 && particles[0].y <= 1);
  assert.equal(particles[0].vx ** 2 + particles[0].vy ** 2, speedSquared);
}
console.log('通過：逐粒計數、打與 mol 完整分組、示意比例、加倍關係、拒絕非完整組、運動邊界及速率守恆。');
