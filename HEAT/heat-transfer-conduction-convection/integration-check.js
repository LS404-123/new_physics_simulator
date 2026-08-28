"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..", "..");
const catalogue = fs.readFileSync(path.join(root, "simulations.js"), "utf8");
const simulator = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const model = fs.readFileSync(path.join(__dirname, "model.js"), "utf8");

assert(catalogue.includes("./HEAT/heat-transfer-conduction-convection/index.html"));
assert(catalogue.includes("./HEAT/heat-transfer-conduction-convection/preview.png"));
assert(catalogue.lastIndexOf("熱如何移動：傳導與對流") > catalogue.lastIndexOf("粒子能量實驗台"));
assert(fs.existsSync(path.join(__dirname, "preview.png")));
assert(simulator.includes("width: 1140px"));
assert(simulator.includes("height: 768px"));
assert(simulator.includes("overflow: hidden"));
assert(simulator.includes('data-mode="conduction"'));
assert(simulator.includes('data-mode="convection"'));
assert(simulator.includes('data-convection-mode="stratified"'));
assert(simulator.includes('data-convection-mode="heated"'));
assert(simulator.includes('id="heaterControl"'));
assert(simulator.includes("兩筒真實平均密度"));
assert(model.includes("createStratifiedFluidParticles"));
assert(model.includes("stepStratifiedFluid"));
assert(model.includes("waterDensityAt"));
assert(model.includes("exchangeVelocity"));
assert(model.includes("createPlumeSeed"));
assert(simulator.includes("gateProgress"));
assert(simulator.includes("convection.gateProgress < 1"));
assert(simulator.includes("if (convection.revealed && !stratified)"));
assert(!simulator.includes("層取樣`"));
assert(simulator.includes('state.running = activeModeName() === "stratified" ? false : !reducedMotion'));
assert(simulator.includes('href="../../"'));
assert(simulator.includes("grid-template-rows: 140px 112px 180px"));
assert.equal(140 + 112 + 180 + 9 * 2, 450);
assert(simulator.includes("result.interactions"));
assert(!simulator.includes("result.contacts"));
assert(simulator.includes("左粒子接近右粒子時觸發推撞"));
assert(simulator.includes("columns: 17"));
assert(simulator.includes("const spacingX = 26"));
assert.equal(169 + (17 - 1) * 26, 585);

const inlineScript = [...simulator.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map((match) => match[1])
  .find((script) => script.includes('const $ ='));
assert(inlineScript, "必須找到模擬器內嵌程式");
new vm.Script(inlineScript);

console.log("Heat-transfer integration checks passed.");
