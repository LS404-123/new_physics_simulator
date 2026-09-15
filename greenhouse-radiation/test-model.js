"use strict";
const assert = require("node:assert/strict");
const { constants: c, initial, flows, advance, lightTrace } = require("./model.js");
const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≠ ${b}`);
const cold = initial(), dark = advance(cold, 0, 3600);
for (const sunlight of [0, 400, 600]) {
  const f = flows(cold, sunlight);
  close(f.incident, f.solar + f.reflected);
  close(f.reflected, sunlight * .2);
  close(f.net, f.solar, 1e-8); // 反射光沒有被溫室吸收，不可再扣作儲熱後的散失。
}
for (const key of ["ground", "glass", "air"]) close(dark[key], 20);
assert.ok(flows(cold, 0).glassIR > 0, "無陽光時玻璃仍放出紅外線");
for (const state of [cold, { ground: 65, glass: 32, air: 40, time: 0 }]) {
  const f = flows(state, 400), next = advance(state, 400, 1);
  close(f.groundNet + f.glassNet + f.airNet, f.net);
  close(c.groundCapacity * (next.ground - state.ground) + c.glassCapacity * (next.glass - state.glass)
    + c.airCapacity * (next.air - state.air), f.solar - f.lost);
  close(f.absorbedIR, c.infraredAbsorption * f.groundIR);
}
const warm = advance(cold, 400, 14400), balance = flows(warm, 400);
assert.ok(warm.ground > warm.air && warm.air > warm.glass && warm.glass > 20);
assert.ok(balance.lost > 0 && Math.abs(balance.net) < balance.solar * .01, "持續日照後收支差應小於供能的 1%");
const later = advance(warm, 400, 7200);
assert.ok(later.ground - warm.ground < .2 && Math.abs(flows(later, 400).net) < .1, "持續日照應趨向有限溫度的動態平衡");
assert.ok(flows(warm, 0).net < 0);
const cooled = advance(warm, 0, 7200);
for (const key of ["ground", "glass", "air"]) assert.ok(cooled[key] < warm[key] && cooled[key] >= 20 - 1e-8);
const batch = advance(cold, 400, 600);
let repeated = cold;
for (let i = 0; i < 600; i++) repeated = advance(repeated, 400, 1);
assert.deepEqual(batch, repeated);
const hottest = advance(cold, 600, 14400);
assert.ok(hottest.ground < 100 && hottest.ground > 20, "固定圖軸必須容納控制範圍內的溫度");
assert.throws(() => advance(cold, NaN, 1), RangeError);
assert.throws(() => advance(cold, 601, 1), RangeError);
assert.throws(() => advance(cold, 400, -1), RangeError);
assert.equal(lightTrace(0, true).incoming, 0);
assert.equal(lightTrace(0, true).transmitted, null, "光未到玻璃時不可先透射");
assert.equal(lightTrace(360, true).incoming, null);
assert.equal(lightTrace(360, true).transmitted, 0);
assert.equal(lightTrace(360, true).reflected, 0, "透射與反射都由玻璃接續");
assert.equal(lightTrace(1080, true).surfaceAbsorption, 1);
assert.equal(lightTrace(1080, true).surfaceIR, null, "先吸收，再發出新的紅外線");
assert.equal(lightTrace(1200, true).surfaceIR, 0);
assert.equal(lightTrace(1800, true).glassAbsorption, 1);
assert.equal(lightTrace(1800, true).returned, null);
assert.equal(lightTrace(1920, true).returned, 0);
assert.equal(lightTrace(1920, true).outside, 0);
assert.equal(lightTrace(2520, true).returnAbsorption, 1);
assert.equal(lightTrace(2760, true).source, "plant", "交替追蹤地面與植物");
for (let time = 0; time < 6000; time += 30) {
  const trace = lightTrace(time, false);
  assert.equal(trace.incoming, null); assert.equal(trace.transmitted, null); assert.equal(trace.reflected, null);
  for (const key of ["surfaceIR", "returned", "outside"]) assert.ok(trace[key] === null || (trace[key] >= 0 && trace[key] < 1));
}
assert.equal(lightTrace(0, false).surfaceIR, 0, "沒有陽光，物體仍可發出紅外線");
console.log("通過：光點順序、玻璃分流、先吸收後再輻射、植物來源及無日照紅外線。");
console.log("通過：入射＝透射＋反射、能量守恆、無日照平衡、雙向再輻射、升溫平衡、冷卻、快進一致及圖軸範圍。");
console.log(`日照 400 W/m²，240 分鐘：地面 ${warm.ground.toFixed(2)}°C，室內 ${warm.air.toFixed(2)}°C，玻璃 ${warm.glass.toFixed(2)}°C，淨吸收 ${balance.net.toFixed(3)} W/m²。`);
