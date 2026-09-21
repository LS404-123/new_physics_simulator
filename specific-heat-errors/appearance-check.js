'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const model = require('./model.js');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

for (const reducedMotion of [false, true]) {
  const elements = new Map();
  for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) {
    assert.ok(!elements.has(id), `重複 ID：${id}`);
    elements.set(id, {
      textContent: '', attrs: {}, listeners: {},
      setAttribute(name, value) { this.attrs[name] = String(value); },
      toggleAttribute(name, value) { if (value) this.attrs[name] = ''; else delete this.attrs[name]; },
      addEventListener(name, callback) { this.listeners[name] = callback; }
    });
  }
  const element = id => { assert.ok(elements.has(id), `找不到元素：${id}`); return elements.get(id); };
  const context = vm.createContext({
    SpecificHeat: model,
    document: { getElementById: element, querySelectorAll: () => [], addEventListener() {} },
    matchMedia: () => ({ matches: reducedMotion }),
    requestAnimationFrame: () => 1, cancelAnimationFrame() {}
  });
  const run = code => vm.runInContext(code, context);
  run(script);
  const position = () => element('stirrer').attrs.transform;
  const disc = () => element('meter-disc-mark').attrs.d;
  const atRest = position(), initialDisc = disc();
  element('play').listeners.click();
  run('frame(1000); frame(1100);');
  assert.equal(element('energy-reading').textContent, '00060');
  assert.equal(element('heater').attrs.transform, 'translate(0,0)', '散熱情境不可抬高電熱器');
  const barWidth = id => Number.parseFloat(element(id).attrs.style.slice(6));
  assert.ok(barWidth('input-energy-bar') > 0 && barWidth('input-energy-bar') < 100, '總供能棒須由零逐步升至滿格');
  assert.ok(barWidth('sample-energy-bar') < barWidth('input-energy-bar'), '樣品吸能須以同一比例顯示為較短');
  assert.equal('hidden' in element('stir-motion').attrs, false, '水加熱時應顯示攪拌');
  assert.equal(position() === atRest, reducedMotion, '減少動態效果時保留靜態攪拌提示');
  assert.match(position(), /^translate\(0,[-\d.]+\)$/, '攪拌棒只可上下移動，不可旋轉或左右移動');
  const firstOffset = Number(position().slice(12, -1));
  run('M.advance(state, 13); render();');
  const laterOffset = Number(position().slice(12, -1));
  if (!reducedMotion) assert.ok(firstOffset > 0 && laterOffset < 0, '攪拌棒須往返上下移動');
  assert.equal(disc() === initialDisc, reducedMotion, '轉碟須跟隨累積供能');
  element('play').listeners.click();
  const paused = [position(), disc(), element('energy-reading').textContent];
  run('frame(2000); render();');
  assert.deepEqual([position(), disc(), element('energy-reading').textContent], paused, '暫停不可繼續移動');
  element('reset').listeners.click();
  assert.equal(position(), atRest);
  assert.equal(element('energy-reading').textContent, '00000');
  run('M.advance(state, 1000); render();');
  assert.equal(elements.has('input-energy-value'), false, '能量比較不應顯示實數');
  assert.equal(elements.has('sample-energy-value'), false, '能量比較不應顯示實數');
  assert.equal(elements.has('energy-gap'), false, '不應顯示兩者差額行');
  assert.equal(element('input-energy-bar').attrs.style, 'width:100%');
  assert.match(element('sample-energy-bar').attrs.style, /^width:94\.9/);
  assert.equal(element('measured-capacity').textContent, '4425');
  assert.equal(element('true-capacity').textContent, '4200');
  assert.equal(element('capacity-gap').textContent, '實驗值高出 5.4%');

  run("error = 'uneven'; reset(); M.advance(state, 10); render();");
  assert.ok('hidden' in element('stir-motion').attrs, '未處理的溫度不均情境不應顯示攪拌');
  run('corrected = true; reset(); M.advance(state, state.config.duration + 1); render();');
  assert.equal('hidden' in element('stir-motion').attrs, false, '關掣後須繼續攪拌均溫');
  const energyAfterSwitchOff = element('energy-reading').textContent, discAfterSwitchOff = disc();
  run('M.advance(state, 1); render();');
  assert.equal(element('energy-reading').textContent, energyAfterSwitchOff);
  assert.equal(disc(), discAfterSwitchOff, '關掣後轉碟不可繼續累積供能');
  run('M.advance(state, 1000); render();');
  assert.ok('hidden' in element('stir-motion').attrs, '完成後停止攪拌');
  run("material = 'metal'; reset(); M.advance(state, 10); render();");
  assert.ok('hidden' in element('water-stirrer').attrs, '金屬塊不應顯示攪拌棒或標示');
}
console.log('通過：焦耳計讀數及轉碟、加熱攪拌、暫停與重設、關掣後均溫、金屬模式及減少動態效果。');
