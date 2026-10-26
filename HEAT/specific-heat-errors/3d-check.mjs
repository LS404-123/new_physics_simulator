import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Box3 } from 'three';
import { makeApparatus, syncApparatus, apparatusOptions, apparatusLabels } from './apparatus-3d.mjs';
const M = createRequire(import.meta.url)('./model.js');
const bits = ['1111110', '0110000', '1101101', '1111001', '0110011', '1011011', '1011111', '1110000', '1111111', '1111011'];
for (const material of ['water', 'metal']) for (const error of ['ideal', 'loss', 'apparatus', 'uneven']) for (const corrected of [false, true]) {
  const initial = M.create(material, error, corrected);
  const model = makeApparatus(initial.config);
  const options = apparatusOptions(initial.config);
  const labels = apparatusLabels(initial.config);
  assert.ok(labels.every(label => label.anchor.every(Number.isFinite) && label.offset.every(Number.isFinite)));
  const texts = labels.map(label => label.text);
  if (material === 'water') {
    assert.ok(texts.includes(error === 'loss' && !corrected ? '無杯蓋' : '有杯蓋'));
    assert.ok(texts.includes(error === 'apparatus' && !corrected ? '玻璃杯' : '聚苯乙烯杯'));
    if (error === 'uneven') assert.ok(texts.includes(corrected ? '攪拌棒・關掣後攪拌' : '攪拌棒・不攪拌'));
  } else {
    assert.ok(texts.includes(error === 'loss' && !corrected ? '未包棉絮' : '棉絮包裹'));
    assert.ok(texts.includes(error === 'loss' && !corrected ? '無隔熱墊' : '聚苯乙烯墊'));
    if (error === 'apparatus') assert.ok(texts.includes('電熱器也吸熱'));
    if (error === 'uneven') assert.ok(texts.includes('遠端溫度計'));
  }
  assert.equal(options.depth, 'full', '各情境須固定完全浸沒／插入');
  assert.equal(options.cupType, material === 'water' && error === 'apparatus' && !corrected ? 'glass' : 'polystyrene');
  const activeBox = new Box3().setFromObject(model.getObjectByName('電熱器發熱部分'));
  const sampleBox = new Box3().setFromObject(model.getObjectByName(material === 'water' ? '杯中液體' : '金屬塊後半'));
  assert.ok(sampleBox.containsBox(activeBox), '整段發熱部分須在樣品內');
  const neckBox = new Box3().setFromObject(model.getObjectByName('電熱器上段接桿'));
  const connectorBox = new Box3().setFromObject(model.getObjectByName('電熱器接線筒'));
  assert.ok(neckBox.min.y <= activeBox.max.y + 1e-8 && neckBox.max.y >= connectorBox.min.y, '移走杯蓋膠圈後，電熱器亦必須保持連續');
  if (material === 'metal') {
    assert.ok(model.getObjectByName('直棒電熱器芯') && model.getObjectByName('聚苯乙烯墊') && model.getObjectByName('棉絮包層'));
    for (const name of ['杯中液體', '電熱器線圈', '攪拌棒', '杯蓋', '電熱器絕緣底座']) assert.equal(model.getObjectByName(name), undefined, `金屬裝置不應有${name}`);
  }
  assert.ok(model.getObjectByName('熱流箭嘴').children.every(a => a.userData.flow !== 'exposedLossPower'), '不可留下外露電熱器散熱箭嘴');
  for (const time of [0, initial.config.duration / 2, initial.config.duration, initial.config.duration + initial.config.settleTime]) {
    const state = M.advance(M.create(material, error, corrected), time);
    const reading = M.reading(state);
    const before = JSON.stringify(state);
    const stirring = material === 'water' && time > 0 && !reading.done && (error !== 'uneven' || (corrected && !reading.heating));
    const settings = { power: M.POWER, room: M.ROOM, stirring, reducedMotion: false };
    syncApparatus(model, state, reading, settings);
    assert.equal(JSON.stringify(state), before, '3D 顯示不可改寫原有物理數據');
    assert.equal(model.getObjectByName(material === 'water' ? '杯蓋' : '金屬塊隔熱材料').visible, options.lid);
    if (material === 'water') assert.equal(model.getObjectByName('電熱器絕緣底座').visible, options.lid, '移去杯蓋後不可留下懸空膠圈');
    const display = Array.from({ length: 5 }, (_, digit) => bits.indexOf(Array.from({ length: 7 }, (_, segment) => Number(model.getObjectByName(`計數器_${digit}_${segment}`).scale.x > 0.5)).join(''))).join('');
    assert.equal(Number(display), Math.round(state.input), '3D 焦耳計須跟隨原頁時間軸');
    const column = model.getObjectByName('紅色液柱');
    assert.ok(Math.abs(column.position.y + column.scale.y / 2 - (0.64 + reading.temperature * 0.026)) < 1e-8, '3D 溫度計須顯示目前狀態');
    const stirrer = model.getObjectByName('攪拌棒活動部分');
    const pose = [column.position.y, column.scale.y, stirrer?.position.y, model.getObjectByName('焦耳計水平圓盤').rotation.y];
    syncApparatus(model, state, reading, settings);
    assert.deepEqual([column.position.y, column.scale.y, stirrer?.position.y, model.getObjectByName('焦耳計水平圓盤').rotation.y], pose, '暫停／重繪不可自行推進動畫');
    if (time > 0 && reading.heating) {
      const environment = model.getObjectByName('熱流箭嘴').children.filter(a => a.userData.flow === 'lossPower');
      assert.equal(environment.some(a => a.scale.x > 0), error === 'loss' && !corrected, '散熱箭嘴須配合所選情境');
      assert.equal(model.getObjectByName('器材吸熱箭嘴').children.some(a => a.scale.x > 0), error === 'apparatus', '器材吸熱情境須有傳入杯的箭嘴');
    }
    const colors = model.getObjectByName(material === 'water' ? '杯中液體' : '金屬塊後半').geometry.attributes.color.array;
    assert.ok(colors.every(Number.isFinite), '溫度分布顏色不可無效');
    syncApparatus(model, state, reading, { ...settings, reducedMotion: true });
    if (stirrer) assert.equal(stirrer.position.y, 0);
    assert.equal(model.getObjectByName('焦耳計水平圓盤').rotation.y, 0);
  }
}
console.log('通過：水及金屬四種情境的 3D 裝置、固定完全浸沒／插入、隔熱材料、焦耳計、溫度計、熱流、暫停及減少動態效果；顯示不改寫物理數據。');
