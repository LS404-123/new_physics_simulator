"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const model = require("./model.js");
const cold = model.at(20), hot = model.at(80);
// 密度參考：https://openstax.org/books/chemistry/pages/e-water-properties
assert.ok(Math.abs(cold.density - 998.2) < .2);
assert.ok(Math.abs(hot.density - 971.8) < .2);
assert.ok(hot.scale > cold.scale && hot.count < cold.count);
assert.equal(cold.densityLevel, "高");
assert.equal(hot.densityLevel, "低");
assert.equal(model.at(40).densityLevel, "高");
assert.equal(model.at(60).densityLevel, "低");
assert.equal(model.magnification, 10);
assert.ok(cold.count >= 20 && cold.count <= 40, "局部放大只需少量粒子");
assert.ok(model.sample.width * model.sample.height < model.vessel.width * model.vessel.height * .03, "取樣範圍少於整杯的 3%");
const center = { x: model.sample.x + model.sample.width / 2, y: model.sample.y + model.sample.height / 2 };
let previousCount = cold.count;
for (let temperature = 20; temperature <= 80; temperature++) {
  const s = model.at(temperature);
  assert.equal(s.particles.length, model.total);
  const physicalVolumeRatio = 1 + (s.volumeRatio - 1) / model.magnification;
  assert.ok(Math.abs(s.density * physicalVolumeRatio - cold.density) < 1e-6, "實際體積須守恆質量，畫面只放大增幅");
  assert.ok(Math.abs(s.scale ** 2 - s.volumeRatio) < 1e-12, "水平與垂直縮放須對應同一體積");
  assert.equal(s.count, s.particles.filter(p => model.inside(p.x, p.y)).length);
  const expected = model.total * model.sample.width * model.sample.height / (model.vessel.width * model.vessel.height * s.volumeRatio);
  assert.ok(Math.abs(s.count - expected) < 3, "粒子分佈須反映放大後的體積");
  s.particles.forEach((p, i) => {
    for (const axis of ["x", "y"]) {
      assert.ok(Math.abs(p[axis] - center[axis] - (cold.particles[i][axis] - center[axis]) * s.scale) < 1e-9, "應向四周均勻膨脹，不可整體向上平移");
    }
  });
  assert.ok(s.count <= previousCount, "固定框內的粒子隨向外膨脹減少");
  previousCount = s.count;
}
assert.deepEqual(model.at(20), cold, "冷卻後應回復原本分佈");
for (const invalid of [NaN, Infinity, 19, 81]) assert.throws(() => model.at(invalid), RangeError);
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
for (const [, script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(script);
// 同一影格的 rAF 時戳可能早於輸入事件中的 performance.now()。
const state = { temperature: 20, target: 80, last: 105, frame: 0 };
const context = vm.createContext({ state, render: () => model.at(state.temperature), requestAnimationFrame: () => 1 });
vm.runInContext(html.match(/function tick\(now\) \{[\s\S]*?\n\}/)[0], context);
vm.runInContext("tick(100)", context);
assert.equal(state.temperature, 20);
for (let time = 150; time <= 2150; time += 50) vm.runInContext(`tick(${time})`, context);
assert.equal(state.temperature, 80);
assert.equal(state.frame, 0);
console.log(`通過：雙向膨脹、面積與體積比例、粒子守恆、固定框點算、升降溫及 JavaScript 語法。20°C：${cold.count}；80°C：${hot.count}。`);
