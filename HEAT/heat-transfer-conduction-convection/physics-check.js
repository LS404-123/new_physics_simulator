"use strict";

const assert = require("node:assert/strict");
const model = require("./model.js");

assert.equal(model.densityAt(20), 1000, "20°C 水的參考密度應為 1000 kg m⁻³");
assert(model.densityAt(60) < model.densityAt(20), "受熱後密度必須下降");
assert(Math.abs(model.waterDensityAt(20) - 998.2) < 0.2, "20°C 真實水密度應接近 998.2 kg m⁻³");
assert(Math.abs(model.waterDensityAt(60) - 983.2) < 0.2, "60°C 真實水密度應接近 983.2 kg m⁻³");

const stratifiedStart = model.createStratifiedFluidParticles();
const topParticles = stratifiedStart.filter((particle) => particle.source === "cold");
const bottomParticles = stratifiedStart.filter((particle) => particle.source === "hot");
assert.equal(stratifiedStart.length, 175, "雙圓筒模式必須保持 175 個相同大小粒子");
assert(topParticles.every((particle) => particle.temperature === 20 && particle.y < .5), "上筒初始必須全為 20°C 冷水");
assert(bottomParticles.every((particle) => particle.temperature === 60 && particle.y > .5), "下筒初始必須全為 60°C 熱水");
assert(topParticles.length > bottomParticles.length, "視覺放大後，上筒冷水粒子必須較密");
assert(stratifiedStart.every((particle) => particle.velocity.x === 0 && particle.velocity.y === 0), "隔板關閉時粒子必須靜止");
const firstSeed = model.createPlumeSeed();
const secondSeed = model.createPlumeSeed();
assert(firstSeed >= 0 && firstSeed < 1 && secondSeed >= 0 && secondSeed < 1, "羽流種子必須落在 0 至 1 之間");
assert.notEqual(firstSeed, secondSeed, "每次重設必須改變羽流位置");
assert(model.thermalMotionAmplitude(60) > model.thermalMotionAmplitude(20), "暖粒子的微觀熱運動必須較快");

const weightedAverage = (particles, read) => particles.reduce((sum, particle) => sum + read(particle) * particle.mass, 0)
  / particles.reduce((sum, particle) => sum + particle.mass, 0);
const initialHeat = stratifiedStart.reduce((sum, particle) => sum + particle.temperature * particle.mass, 0);
const initialHotHeight = weightedAverage(bottomParticles, (particle) => particle.y);
const initialColdHeight = weightedAverage(topParticles, (particle) => particle.y);
let mixedParticles = stratifiedStart;
for (let step = 0; step < 1200; step += 1) mixedParticles = model.stepStratifiedFluid(mixedParticles, 0.016, .3);
const mixedHeat = mixedParticles.reduce((sum, particle) => sum + particle.temperature * particle.mass, 0);
assert(Math.abs(mixedHeat - initialHeat) < 1e-7, "無熱源混合前後總熱量必須守恆");
assert(weightedAverage(mixedParticles.filter((particle) => particle.source === "hot"), (particle) => particle.y) < initialHotHeight - .08, "暖水重心必須明顯上升");
assert(weightedAverage(mixedParticles.filter((particle) => particle.source === "cold"), (particle) => particle.y) > initialColdHeight + .1, "凍水重心必須向下補位");
const mixedUpperTemperature = weightedAverage(mixedParticles.filter((particle) => particle.y < .5), (particle) => particle.temperature);
const mixedLowerTemperature = weightedAverage(mixedParticles.filter((particle) => particle.y >= .5), (particle) => particle.temperature);
assert(Math.abs(mixedLowerTemperature - mixedUpperTemperature) < 3, "混合後兩筒平均溫度必須接近相同");
const mixedYPositions = mixedParticles.map((particle) => particle.y).sort((left, right) => left - right);
assert(mixedYPositions[157] - mixedYPositions[17] > .65, "混合後粒子仍須填滿兩個圓筒");

const noExchange = model.exchangeVelocity(.4, .5, 0, .3);
assert.equal(Math.hypot(noExchange.x, noExchange.y), 0, "兩筒同溫時不可再產生交換流動");
const interfaceFlows = Array.from({ length: 21 }, (_, index) => model.exchangeVelocity(index / 20, .5, 40, .3).y);
assert(interfaceFlows.some((velocity) => velocity < 0) && interfaceFlows.some((velocity) => velocity > 0), "界面必須同時有暖水上升及凍水下沉通道");
const epsilon = 1e-5;
const x = .37, y = .56;
const divergence = (
  model.exchangeVelocity(x + epsilon, y, 40, .3).x - model.exchangeVelocity(x - epsilon, y, 40, .3).x
  + model.exchangeVelocity(x, y + epsilon, 40, .3).y - model.exchangeVelocity(x, y - epsilon, 40, .3).y
) / (2 * epsilon);
assert(Math.abs(divergence) < 1e-8, "成對羽流速度場必須保持無散度");

const equalTemperatureParticles = model.createStratifiedFluidParticles().map((particle) => ({
  ...particle,
  temperature: 40,
  density: model.waterDensityAt(40)
}));
const equalTemperatureStep = model.stepStratifiedFluid(equalTemperatureParticles, .016, .3);
assert(equalTemperatureStep.every((particle, index) => particle.x === equalTemperatureParticles[index].x && particle.y === equalTemperatureParticles[index].y), "兩筒同溫時粒子不可自行流動");

const resting = model.stepConduction({
  columns: 2, rows: 1,
  displacements: [0, 0], velocities: [0, 0], temperatures: [20, 20]
}, 0, 0.02, 0);
assert.equal(resting.interactions.length, 0, "沒有位移或溫差時不可產生作用");
assert.equal(resting.velocities[1], 0, "靜止晶格不可自行移動");

const separated = model.stepConduction({
  columns: 2, rows: 1,
  displacements: [0.2, 0], velocities: [0.5, 0], temperatures: [20, 20]
}, 0, 0.02, 0);
assert.equal(separated.interactions.length, 0, "粒子未接近時不可顯示推撞");
assert.equal(separated.velocities[1], 0, "未被推撞前右邊粒子必須保持靜止");

const collided = model.stepConduction({
  columns: 2, rows: 1,
  displacements: [0, 0], velocities: [0, 0], temperatures: [100, 20]
}, 0, 0.02, Math.asin(6.3 / 7.8) / 4.2);
assert.equal(collided.interactions.length, 1, "粒子接近門檻時必須觸發推撞");
assert(collided.velocities[1] > 0, "推撞後右邊粒子必須向右移動");

const heatFlow = model.stepConduction({
  columns: 2, rows: 1,
  displacements: [0, 0], velocities: [0, 0], temperatures: [100, 20]
}, 0, 0.1, Math.PI / (2 * 4.2));
assert(heatFlow.temperatures[0] < 100, "較熱粒子必須失去能量");
assert(heatFlow.temperatures[1] > 20, "較冷鄰粒必須得到能量");
assert.equal(heatFlow.temperatures[0] + heatFlow.temperatures[1], 120, "相鄰交換必須守恆");

let chain = {
  columns: 17, rows: 1,
  displacements: Array(17).fill(0), velocities: Array(17).fill(0), temperatures: Array(17).fill(20)
};
let maximumDisplacement = 0;
let collisionCount = 0;
let stalledFrames = 0;
let previousLeftDisplacement;
let rightTemperatureAtBoiling;
for (let step = 0; step < 2400; step += 1) {
  const result = model.stepConduction(chain, 1, 0.016, step * 0.016);
  collisionCount += result.interactions.length;
  chain = { ...chain, ...result };
  maximumDisplacement = Math.max(maximumDisplacement, ...chain.displacements.map(Math.abs));
  if (chain.displacements[0] === previousLeftDisplacement) stalledFrames += 1;
  previousLeftDisplacement = chain.displacements[0];
  if (rightTemperatureAtBoiling === undefined && chain.temperatures[0] >= 100) {
    rightTemperatureAtBoiling = chain.temperatures[16];
  }
}
assert(collisionCount > 16, "推撞必須由左至右重複傳遞");
assert(rightTemperatureAtBoiling >= 20.1, "左端到達 100°C 前，右端必須已有可見升溫");
assert(chain.temperatures[16] > 20, "能量必須經鄰近作用傳到最右粒子");
assert(chain.temperatures.every((temperature, index, values) => index === 0 || values[index - 1] >= temperature), "溫度—位置曲線必須由熱端向冷端平滑下降");
assert(maximumDisplacement > 6.2, "加熱粒子必須能到達推撞門檻");
assert(maximumDisplacement <= 9, "粒子仍須限制在晶格平衡位置附近");
assert.equal(stalledFrames, 0, "最左粒子不可連續兩幀停在同一位置");

const contrast = (model.densityAt(20) - model.densityAt(60)) / model.REFERENCE_DENSITY;
const noFlow = model.convectionVelocity(0.5, 0.5, 0);
const rising = model.convectionVelocity(0.5, 0.5, contrast);
const sinking = model.convectionVelocity(0.05, 0.5, contrast);
assert.equal(Math.hypot(noFlow.x, noFlow.y), 0, "沒有密度差時不可產生對流");
assert(rising.y < 0, "中央暖流應向上");
assert(sinking.y > 0, "兩側冷流應向下");

console.log("Heat-transfer physics checks passed.");
