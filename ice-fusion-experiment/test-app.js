// 執行：node ice-fusion-experiment/test-app.js
'use strict';
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const M = require('./model.js');
const html = readFileSync(`${__dirname}/index.html`, 'utf8');
const elements = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(([, id]) => [id, {
  checked: true, value: id === 'duration' ? '60' : 'B', dataset: {}, attributes: {}, events: {},
  classList: { toggle() {} }, addEventListener(name, callback) { this.events[name] = callback; },
  setAttribute(name, value) { this.attributes[name] = String(value); },
  toggleAttribute(name, enabled) { if (enabled) this.attributes[name] = ''; else delete this.attributes[name]; }
}]));
let tones = 0;
class AudioContext {
  constructor() { this.state = 'running'; this.currentTime = 0; }
  resume() { return Promise.resolve(); }
  createOscillator() { return { frequency: { setValueAtTime() {} }, connect() {}, start() { tones++; }, stop() {} }; }
  createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} }; }
}
const context = vm.createContext({ IceFusion: M, AudioContext, console,
  document: { getElementById: id => elements[id] ?? null, querySelectorAll: () => [] },
  IceFusion3D: { mount: () => ({ update() {} }) }, matchMedia: () => ({ matches: false }),
  cancelAnimationFrame() {}, requestAnimationFrame: () => 1
});
vm.runInContext(readFileSync(`${__dirname}/app.js`, 'utf8'), context);
let timestamp = 100;
function tick(count) { for (let i = 0; i < count; i++) vm.runInContext(`frame(${timestamp += 100})`, context); }
function heaterWidth() {
  const [, top, bottom] = elements['energy-heater'].attributes.d.match(/275 ([\d.e+-]+)V([\d.e+-]+)/);
  return Number(bottom) - Number(top);
}
elements.play.events.click(); tick(11);
const earlyWidth = heaterWidth(), earlyEnergy = vm.runInContext('state.heater', context);
tick(20);
const laterWidth = heaterWidth(), laterEnergy = vm.runInContext('state.heater', context);
assert.ok(laterEnergy > earlyEnergy && laterWidth > earlyWidth, '儲能增加時，線寬亦須增加');
assert.ok(Math.abs(earlyWidth / earlyEnergy - laterWidth / laterEnergy) < 1e-12, '線寬須使用固定刻度，不除以總供能');
assert.ok(elements['timer-signal'].hidden, '未到時間不可提示');
tick(30);
assert.equal(vm.runInContext('state.phase', context), 'draining');
assert.equal(elements['timer-signal'].hidden, false, '時間到須顯示提示');
assert.equal(tones, 2, '時間到只播放一組兩短音');
tick(10); assert.equal(tones, 2, '後續集水不可重複響聲');
elements.reset.events.click(); assert.equal(elements['timer-signal'].hidden, true, '重設須清除提示');
elements.play.events.click(); tick(10); elements.stop.events.click(); tick(60);
assert.equal(tones, 2, '提早關掣不可誤報時間到');
assert.equal(elements['timer-signal'].hidden, true);
elements.reset.events.click(); elements.duration.value = '240'; elements.duration.events.change();
elements.play.events.click(); tick(11);
assert.ok(Math.abs(heaterWidth() - earlyWidth) < 1e-12, '改變加熱時間不可改變線寬刻度');
tick(240); assert.equal(tones, 4, '新一輪時間到須再次提示');
assert.ok(Number(elements['energy-trunk'].attributes.height) <= 48, '最大供能必須放得進能量圖');
elements.reset.events.click(); elements.duration.value = '60'; elements.duration.events.change(); elements.play.events.click();
vm.runInContext('M.advance(state, 59.499999995); previous = 100; frame(150)', context);
assert.equal(vm.runInContext('state.phase', context), 'draining');
assert.equal(elements['timer-signal'].hidden, false, '小數步長亦須與自動關掣同步提示');
assert.equal(tones, 6);
console.log('通過：線寬固定刻度、儲能增長、到時單次提示、提早關掣、重設及再次操作。');
