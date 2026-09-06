'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(`${__dirname}/index.html`, 'utf8');
const elements = new Map([...html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)].map(([tag, id]) => [id, {
  textContent: '', innerHTML: '', handlers: {}, hidden: /\bhidden\b/.test(tag), attributes: {},
  setAttribute(name, value) { this.attributes[name] = value; },
  focus() {},
  showModal() { this.open = true; },
  addEventListener(event, handler) { this.handlers[event] = handler; }
}]));
const document = { getElementById: id => elements.get(id) };
let reducedMotion = false;
vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], {
  ResistanceModel: require('./model.js'),
  document,
  window: { addEventListener: (_, handler) => handler(), matchMedia: () => ({ matches: reducedMotion }) },
  katex: { render(tex, element) { element.textContent = tex; } },
  requestAnimationFrame() { assert.fail('步驟必須由點擊控制'); },
  setTimeout() { assert.fail('不應自動播放'); },
  setInterval() { assert.fail('不應自動播放'); }
});
const click = id => elements.get(id).handlers.click();
const pathCount = () => (elements.get('paths').innerHTML.match(/<line /g) || []).length;
assert.equal(pathCount(), 0);
assert.ok(elements.get('previous').disabled);
assert.ok(!elements.has('play') && !elements.has('conclusion'));
assert.ok(!elements.has('thermometer-value'), '裝置使用萬用錶，不顯示溫度計示值');
assert.equal(elements.get('known-zero').textContent, '100.00 Ω');
assert.equal(elements.get('known-hundred').textContent, '140.00 Ω');
assert.equal(elements.get('flow-strip').hidden, false, '頂部流程在開場顯示');
assert.ok(!elements.has('temperature-value'), '兩個畫面的裝置框都不顯示外界實際溫度');
const assertView = explaining => {
  for (const id of ['graph-panel', 'step-panel', 'step-buttons', 'observe']) {
    assert.equal(elements.get(id).hidden, !explaining, id);
  }
  assert.equal(elements.get('intro').hidden, explaining);
  assert.equal(elements.get('presets').hidden, false, '校準點按鈕在兩個畫面均可見');
  if (!explaining) assert.equal(elements.get('flow-1').attributes['aria-current'], 'step', '觀察畫面對應量度階段');
};
assertView(false);
assert.ok(!elements.get('math-details').open);
assert.equal(elements.get('multimeter-value').textContent, '128.80 Ω', '萬用錶顯示實際電阻，而非直線預測的 124 Ω');
click('zero');
assert.equal(elements.get('multimeter-value').textContent, '100.00 Ω');
click('hundred');
assert.equal(elements.get('multimeter-value').textContent, '140.00 Ω');
assertView(false);
assert.equal(pathCount(), 0, '開場使用校準點不會進入圖解');
elements.get('temperature').handlers.input({ target: { value: '60' } });
assert.ok(!html.includes('同一溫度') && !html.includes('「假」'), '移除舊的同溫度電阻比較');
click('next');
assert.equal(pathCount(), 0, '未進入圖解時不推進步驟');
click('explain');
assertView(true);
for (let step = 1; step <= 3; step++) {
  if (step > 1) click('next');
  assert.equal(pathCount(), step);
  assert.equal(elements.get('step-count').textContent, `讀圖路徑 · ${step} / 3`);
  for (let i=1;i<=3;i++) assert.equal(elements.get(`flow-${i}`).attributes['aria-current'], i===step?'step':'false');
}
assert.ok(elements.get('labels').innerHTML.includes('推算 72.0 °C'), '溫度屬直線推算結果，不是萬用錶讀數');
const paths = [...elements.get('paths').innerHTML.matchAll(/x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/g)].map(match => match.slice(1).map(Number));
assert.equal(paths[0][0], paths[0][2], '先垂直到實線');
assert.equal(paths[1][1], paths[1][3], '保持電阻不變，水平到虛線');
assert.equal(paths[0][2], paths[1][0]);
assert.equal(paths[0][3], paths[1][1]);
assert.ok(paths[1][2] > paths[1][0], '60 °C 時示值偏高');
assert.equal(paths[2][0], paths[2][2], '向下讀取示值');
assert.equal(paths[1][2], paths[2][0]);
assert.equal(paths[1][3], paths[2][1]);
assert.ok(elements.get('next').disabled);
click('next');
assert.equal(pathCount(), 3);
click('observe');
assertView(false);
click('explain');
assertView(true);
assert.equal(pathCount(), 3, '返回觀察後保留圖解進度');
click('math-open');
assert.ok(elements.get('math-details').open);
assert.equal(elements.get('math-resistance').textContent, '萬用錶量得的電阻：128.80 Ω');
assert.ok(elements.get('math-example').textContent.includes('128.80-100'));
assert.ok(elements.get('math-example').textContent.includes('72.0'));
elements.get('math-details').open = false;
click('zero');
assert.equal(elements.get('multimeter-value').textContent, '100.00 Ω');
assert.equal(pathCount(), 2, '校準點的水平段長度為零');
const coordinates = markup => [...markup.matchAll(/x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/g)].map(match => match.slice(1).map(Number));
const [resistanceAxis, temperatureAxis] = coordinates(elements.get('axes').innerHTML).slice(-2);
const zeroPath = coordinates(elements.get('paths').innerHTML)[0];
assert.equal(zeroPath[0], resistanceAxis[0], '0 °C 路徑必須位於縱軸');
assert.equal(zeroPath[1], temperatureAxis[1], '溫度軸必須位於 0 Ω');
assert.equal(resistanceAxis[3], temperatureAxis[1], '兩軸在 (0, 0) 相交');
const highestGridY = Math.min(...coordinates(elements.get('axes').innerHTML).filter(p => p[1]===p[3]).map(p => p[1]));
assert.equal((zeroPath[1]-zeroPath[3])/(zeroPath[1]-highestGridY), 100/160, '0 °C 的 100 Ω 必須按完整零基準刻度定位');
click('hundred');
assert.equal(elements.get('multimeter-value').textContent, '140.00 Ω');
elements.get('temperature').handlers.input({ target: { value: '60' } });
assert.equal(pathCount(), 3, '改變溫度時保留當前步驟以供探究');
for (let step = 2; step >= 1; step--) {
  click('previous');
  assert.equal(pathCount(), step);
}
click('previous');
assert.equal(pathCount(), 1);
assert.ok(elements.get('previous').disabled);
elements.get('temperature').handlers.input({ target: { value: '100' } });
assert.equal(pathCount(), 1);
assert.equal(Number(elements.get('temperature').value), 100);
click('reset');
assertView(false);
assert.equal(pathCount(), 0);
assert.equal(Number(elements.get('temperature').value), 60);
elements.get('temperature').handlers.input({ target: { value: '-20' } });
click('explain');
const negativePath = coordinates(elements.get('paths').innerHTML)[0];
const resistanceGuide = coordinates(elements.get('guides').innerHTML)[0];
assert.equal(resistanceGuide[1], negativePath[3], '輔助線與金屬點的電阻相同');
assert.equal(resistanceGuide[1], resistanceGuide[3]);
for (const position of [negativePath[2], resistanceAxis[0]]) {
  assert.ok(resistanceGuide[0] <= position && position <= resistanceGuide[2], '負溫度輔助線須同時經過金屬點與電阻軸');
}
let transitions = 0, skipped = 0;
document.startViewTransition = update => {
  transitions++;
  update();
  return { skipTransition() { skipped++; } };
};
click('observe');
assertView(false);
click('explain');
assertView(true);
assert.equal(transitions, 2, '兩個方向均使用畫面過渡');
assert.equal(skipped, 1, '再次切換先結束上一個過渡');
assert.equal(pathCount(), 1, '過渡不會推進讀圖步驟');
assert.equal(Number(elements.get('temperature').value), -20, '過渡保留溫度');
reducedMotion = true;
click('observe');
assertView(false);
assert.equal(transitions, 2, '減少動態效果時直接切換');
console.log('通過：觀察與圖解過渡、減少動態效果與無 API 後備、手動路徑、零原點、校準點、保留狀態及重設。');
