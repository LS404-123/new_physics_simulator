const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
function node(tag = "") {
  return { tag, children: [], attributes: {}, handlers: {}, style: {}, value: "", textContent: "",
    setAttribute(key, value) { this.attributes[key] = String(value); },
    getAttribute(key) { return this.attributes[key] ?? null; },
    append(child) { this.children.push(child); }, replaceChildren() { this.children = []; },
    addEventListener(name, fn) { this.handlers[name] = fn; }, setPointerCapture() {}, contains(item) { return this.children.includes(item); },
    getScreenCTM() { return { inverse() { return {}; } }; } };
}
const nodes = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m => [m[1], node()]));
nodes.count.value = "0"; nodes.kinetic.value = "2"; nodes.size.value = "1";
nodes.kinetic.max = "4";
let createdNodes = 0;
global.document = { getElementById: id => nodes[id], createElementNS: (_, tag) => { createdNodes++; return node(tag); } };
global.DOMPoint = class { constructor(x, y) { this.x = x; this.y = y; } matrixTransform() { return this; } };
let nextFrame;
global.requestAnimationFrame = fn => { nextFrame = fn; };
const reducedMotion = { matches: false };
global.window = { matchMedia: () => reducedMotion };
global.IdealGasEnergy = require("./model.js");
require("./app.js");
const scene = nodes["real-scene"];
const bridge = () => scene.children.find(child => child.tag === "path" && child.attributes.display !== "none");
const width = item => -Number(item.attributes.d.match(/^M 0 ([^ ]+) C/)[1]);
const initial = { attributes: { ...bridge().attributes } };
const initialIdealWidth = nodes["ideal-kinetic"].style.width;
const particle = scene.children.find(child => child.attributes["data-particle"] === "0");
scene.handlers.pointerdown({ target: particle, isPrimary: true, clientX: 185, clientY: 150, pointerId: 1, preventDefault() {} });
scene.handlers.pointermove({ clientX: 235, clientY: 150, pointerId: 1 });
const near = bridge();
assert.ok(width(near) > width(initial));
assert.ok(width(near) > 18);
const capEndX = Number(near.attributes.d.match(/C [^ ]+ [^,]+, [^ ]+ [^,]+, ([^ ]+) 0 C/)[1]);
assert.ok(capEndX > 50 + 18);
assert.ok(Number(near.attributes.opacity) > Number(initial.attributes.opacity));
const nearEnergy = parseFloat(nodes["real-potential"].style.width);
scene.handlers.pointermove({ clientX: 50, clientY: 150, pointerId: 1 });
assert.equal(bridge(), undefined);
const farEnergy = parseFloat(nodes["real-potential"].style.width);
assert.ok(farEnergy > 0 && farEnergy < nearEnergy);
assert.equal(nodes["ideal-kinetic"].style.width, initialIdealWidth, "拖動左邊不可改變右邊能量條的刻度");
scene.handlers.pointermove({ clientX: 235, clientY: 150, pointerId: 1 });
assert.equal(bridge(), near, "液橋重現時應重用原節點");
scene.handlers.pointerup({ pointerId: 1 });
nodes.count.value = "1";
nodes.count.handlers.input();
const visibleBridges = scene.children.filter(child => child.tag === "path");
assert.equal(visibleBridges.length, 6);
assert.equal(new Set(visibleBridges.map(item => item.attributes.fill)).size, visibleBridges.length);
const xBefore = scene.children.find(child => child.attributes["data-particle"] === "0").attributes.cx;
nextFrame(100); nextFrame(100 + 1000 / 60);
const xAfter = scene.children.find(child => child.attributes["data-particle"] === "0").attributes.cx;
const idealX = nodes["ideal-scene"].children.find(child => child.attributes["data-particle"] === "0").attributes.cx;
assert.notEqual(xAfter, xBefore);
assert.notEqual(xAfter, idealX);
let time = 200;
for (const level of [0, 1, 2, 3, 4, 0]) {
  nodes.count.value = String(level); nodes.count.handlers.input();
  const count = 2 ** (level + 1);
  const targets = scene.children.filter(child => child.attributes["data-particle"] !== undefined);
  assert.equal(targets.length, count);
  assert.equal(scene.children.filter(child => child.tag === "path").length, count * (count - 1) / 2);
  const createdBefore = createdNodes;
  const idealWidth = parseFloat(nodes["ideal-kinetic"].style.width);
  let previousX = targets[0].attributes.cx;
  for (let i = 0; i < 60; i++) {
    nextFrame(time += 1000 / 60);
    assert.notEqual(targets[0].attributes.cx, previousX, "每格 60 Hz 畫面均須推進運動");
    previousX = targets[0].attributes.cx;
    assert.ok(Math.abs(parseFloat(nodes["ideal-kinetic"].style.width) - idealWidth) < 1e-9, "完全彈性碰撞期間右邊總動能條須保持不變");
  }
  assert.equal(createdNodes, createdBefore, "動畫不可重新建立 SVG 節點");
  assert.ok(scene.children.includes(targets[0]), "粒子的互動節點須保持不變");
}
const target = scene.children.find(child => child.attributes["data-particle"] === "0");
const pausedX = target.attributes.cx;
document.activeElement = target; nextFrame(time += 1000 / 60);
assert.equal(target.attributes.cx, pausedX, "鍵盤操作期間須暫停");
document.activeElement = null; reducedMotion.matches = true; nextFrame(time += 1000 / 60);
assert.equal(target.attributes.cx, pausedX, "須保留減少動態設定");
reducedMotion.matches = false; document.hidden = true; nextFrame(time += 1000 / 60);
assert.equal(target.attributes.cx, pausedX, "隱藏頁面不應推進運動");
document.hidden = false; nextFrame(time += 1000 / 60);
assert.notEqual(target.attributes.cx, pausedX);
const visualParticle = () => scene.children.find(child => child.tag === "circle" && child.attributes["pointer-events"] === "none");
const originalRadius = Number(visualParticle().attributes.r);
const beforeResize = createdNodes;
nodes.size.value = "8"; nodes.size.handlers.input();
assert.equal(Number(visualParticle().attributes.r), originalRadius / 8);
assert.equal(Number(target.attributes.r), 24, "縮小分子後仍保留足夠觸控範圍");
assert.equal(bridge(), undefined);
assert.equal(nodes["real-kinetic"].style.width, nodes["ideal-kinetic"].style.width);
assert.ok(parseFloat(nodes["real-potential"].style.width) < 1e-20);
assert.equal(createdNodes, beforeResize, "調整大小也應重用 SVG 節點");
const startX = Number(target.attributes.cx), startY = Number(target.attributes.cy);
scene.handlers.pointerdown({ target, isPrimary: true, clientX: startX, clientY: startY, pointerId: 2, preventDefault() {} });
scene.handlers.pointermove({ clientX: startX + 20, clientY: startY, pointerId: 2 });
assert.ok(Math.abs(Number(target.attributes.cx) - startX - 20) < 1e-10, "縮放後拖曳須跟隨指標");
scene.handlers.pointerup({ pointerId: 2 });
nodes.size.value = "1"; nodes.size.handlers.input();
assert.equal(Number(visualParticle().attributes.r), originalRadius);
assert.ok(bridge());
let flashes = 0, freeFrames = 0;
const idealWidth = parseFloat(nodes["ideal-kinetic"].style.width);
let minRealWidth = Infinity, maxRealWidth = -Infinity;
for (let i = 0; i < 360; i++) {
  nextFrame(time += 1000 / 60);
  assert.ok(Math.abs(parseFloat(nodes["ideal-kinetic"].style.width) - idealWidth) < 1e-9);
  const realWidth = parseFloat(nodes["real-kinetic"].style.width);
  minRealWidth = Math.min(minRealWidth, realWidth); maxRealWidth = Math.max(maxRealWidth, realWidth);
  if (visualParticle().attributes.fill === "#fff1a8") flashes++;
  else freeFrames++;
}
assert.ok(flashes > 0 && freeFrames > flashes * 10, "畫面須呈現短促碰撞和較長自由運動");
assert.ok(maxRealWidth - minRealWidth > 0.1, "左邊的動能變化仍須顯示出來");
nodes.kinetic.value = "4"; nodes.kinetic.handlers.input();
assert.ok(Math.abs(parseFloat(nodes["ideal-kinetic"].style.width) - idealWidth * 2) < 1e-9, "動能加倍時，固定刻度下能量條長度也應加倍");
const beforeSizeChange = parseFloat(nodes["ideal-kinetic"].style.width);
nodes.size.value = "8"; nodes.size.handlers.input();
assert.ok(Math.abs(parseFloat(nodes["ideal-kinetic"].style.width) - beforeSizeChange) < 1e-9, "同粒子數及動能下，容器大小不可改變能量條長度");
console.log("液橋、縮放、碰撞、節點重用及固定能量刻度檢查通過");
