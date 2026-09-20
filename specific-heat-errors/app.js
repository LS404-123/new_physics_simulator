'use strict';
const $ = id => document.getElementById(id);
const M = SpecificHeat;
const titles = { ideal: '理想情況', loss: '散熱到周圍', apparatus: '器材吸熱', uneven: '溫度不均' };
let material = 'water', error = 'loss', corrected = false;
let state = M.create(material, error), running = false, previousFrame = 0, animationFrame = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const text = (id, value) => { if ($(id).textContent !== value) $(id).textContent = value; };
const visible = (id, show) => $(id).toggleAttribute('hidden', !show);

function reset() {
  cancelAnimationFrame(animationFrame);
  running = false;
  state = M.create(material, error, corrected, 'far');
  $('timeline').max = state.config.duration + state.config.settleTime;
  render();
}

function descriptions() {
  const water = material === 'water';
  if (error === 'ideal') return [
    '能量都用來使樣品升溫，溫度均勻。這是比較誤差的基準。',
    water ? '發熱部分完全浸沒；用隔熱杯，並使水溫均勻。' : '發熱段完全插入孔內；包棉絮、墊隔熱墊，並等候均溫。'
  ];
  if (error === 'loss') return [
    corrected ? '發熱部分放好了，隔熱也加好了，所需總供能回到理想基準。此處忽略剩餘散熱。' : '部分能量散到周圍。要達到相同溫升，須加熱更久、供應更多能量；樣品實際吸能相同。',
    water ? '把發熱部分完全浸沒在水中；使用聚苯乙烯杯並加蓋。' : '把直棒的發熱段完全插入孔內；用棉絮包裹金屬塊，並墊隔熱墊。'
  ];
  if (error === 'apparatus') return [
    corrected ? '換杯後，所需總供能減少，但仍略多於理想情況，比熱容量仍稍偏大。' : (water ? '水達到同樣溫升，實際吸能相同；杯和電熱器也吸熱，所以總供能較多。' : '金屬塊達到同樣溫升，實際吸能相同；電熱器也吸熱，所以總供能較多。'),
    water ? '使用熱容量較小的聚苯乙烯杯，減少杯吸熱。' : '包棉絮只能減少散熱，不能消除電熱器本身吸熱。'
  ];
  return [
    corrected ? '先關掣再等候均溫，讀數繼續升至目標；總供能接近理想情況。' : '溫度計固定在遠端。遠端較冷，要加熱更久才達到目標讀數，總供能較多；此時平均溫升已過高。',
    water ? '關掣後繼續輕輕攪拌，水溫均勻後記錄最高穩定溫度。' : '關掣後先等候，讓熱傳至溫度計所在位置，再記錄最高溫度。'
  ];
}

function draw(r) {
  const water = material === 'water', hasLoss = error === 'loss' && !corrected;
  const active = state.time > 0;
  const stirring = water && active && !r.done && (error !== 'uneven' || (corrected && !r.heating));
  const lift = hasLoss ? 75 : 0;
  visible('water-vessel', water); visible('metal-vessel', !water);
  visible('water-heater', water); visible('metal-heater', !water);
  visible('metal-insulation', !water && !hasLoss);
  visible('lid', !hasLoss); visible('water-stirrer', water);
  visible('stir-motion', stirring);
  text('stir-status', stirring ? (running ? '輕輕攪拌中' : '攪拌已暫停') : !active ? '未攪拌' : r.done ? '已停止攪拌' : '尚未攪勻');
  visible('loss-flow', hasLoss && active);
  visible('apparatus-flow', error === 'apparatus' && active);
  visible('transfer', active && (r.heating || (error === 'uneven' && !r.done)));
  $('heater').setAttribute('transform', `translate(0,${-lift})`);
  $('wire-a').setAttribute('d', `M282 353C324 349 325 ${143-lift} 399 ${110-lift}Q441 ${85-lift} 441 ${127-lift}`);
  $('wire-b').setAttribute('d', `M308 348C350 337 346 ${158-lift} 415 ${127-lift}Q459 ${106-lift} 459 ${127-lift}`);
  $('heater-lead').setAttribute('d', `M416 ${151-lift}L454 60H511`);
  text('heater-label', water ? '浸沒式電熱器' : '直棒式電熱器');
  text('vessel-label', water ? (error === 'apparatus' && !corrected ? '較厚的杯' : '聚苯乙烯杯') : (hasLoss ? '金屬塊 · 剖面' : '金屬塊剖面 · 棉絮與隔熱墊'));
  text('apparatus-label', water ? '杯和電熱器也吸熱' : '電熱器本身也吸熱');
  const color = temperature => {
    const amount = Math.min(1, Math.max(0, (temperature - M.ROOM) / 16));
    return `rgb(${Math.round(152+98*amount)} ${Math.round(213-88*amount)} ${Math.round(231-141*amount)})`;
  };
  $('temp-near').setAttribute('stop-color', color(state.mean + state.spread));
  $('temp-far').setAttribute('stop-color', color(state.mean - state.spread));
  $('cup-wall').setAttribute('fill', error === 'apparatus' ? color(state.mean) : 'url(#foam)');
  $('cup-wall').setAttribute('stroke-width', error === 'apparatus' && !corrected ? '7' : '2');
  $('water-coil').setAttribute('stroke', active && r.heating ? '#dd8a43' : '#c4d8e1');
  $('metal-hot-zone').setAttribute('fill', active && r.heating ? '#dd8a43' : '#aabfc8');
  $('power-light').setAttribute('fill', active && r.heating ? '#10a58e' : '#9db2b8');
  $('mercury').setAttribute('d', `M499 348V${320-(r.temperature-M.ROOM)*10}`);
  $('target-line').setAttribute('d', `M488 ${320-M.TARGET_RISE*10}H557`);
  $('target-label').setAttribute('y', 312-M.TARGET_RISE*10);
  text('energy-reading', Math.round(state.input).toString().padStart(5, '0'));
  const supplyStatus = !active ? '未供能' : r.heating ? '持續供能' : '已停止供能';
  const uniform = state.spread < 0.01;
  text('temperature-status', !active ? '未升溫' : !uniform ? '遠端較冷' : '溫度均勻');
  text('probe-label', '溫度計固定在遠端');
  text('setup-note', hasLoss ? (water ? '發熱部分未完全浸沒' : '發熱段未完全插入孔內') : error === 'uneven' ? (corrected && !r.heating ? (water ? '關掣後繼續攪拌' : '關掣後等候均溫') : '溫度計固定在遠端') : error === 'apparatus' ? (water ? (corrected ? '換上低熱容量的杯' : '杯和電熱器也會升溫') : '電熱器也會吸熱') : (water ? '發熱部分完全浸沒' : '發熱段完全在孔內'));
  text('setup-detail', hasLoss ? '留意外露的發熱部分' : error === 'uneven' ? (corrected ? (water ? '攪拌使溫度均勻' : '等候熱傳至溫度計位置') : '遠端讀數低於平均溫度') : !water ? '直棒沿同一孔洞插入，底端留在孔內' : '杯身剖開，方便觀察內部');
  text('diagram-desc', `電源以兩條電線接到焦耳計輸入端，另外兩條電線從輸出端接到電熱器。${$('setup-note').textContent}。焦耳計讀數 ${Math.round(state.input)} J，${supplyStatus}，${$('temperature-status').textContent}。${water ? $('stir-status').textContent + '。' : ''}顏色表示溫度，箭頭表示能量流向。`);
  // 位移只由實驗時間決定；暫停後熱流及攪拌一併停止。
  const phase = reducedMotion ? 0.5 : (state.time % 2) / 2;
  $('energy-dot').setAttribute('cx', 419 + 36 * phase);
  $('loss-path').setAttribute('stroke-dasharray', '8 6');
  $('loss-path').setAttribute('stroke-dashoffset', -phase * 28);
  const stirOffset = stirring && !reducedMotion ? Math.sin(state.time * 0.35) * 10 : 0;
  $('stirrer').setAttribute('transform', `translate(0,${stirOffset})`);
  $('stir-motion').setAttribute('transform', `translate(0,${stirOffset})`);
  const discPhase = reducedMotion ? 0 : state.input / 1000 * Math.PI * 2;
  const discX = 253 + 24 * Math.cos(discPhase), discY = 303 + 4 * Math.sin(discPhase);
  $('meter-disc-mark').setAttribute('d', `M${discX} ${discY}v3`);
}

function render() {
  const r = M.reading(state), active = state.time > 0;
  document.querySelectorAll('[data-material]').forEach(button => button.setAttribute('aria-pressed', button.dataset.material === material));
  document.querySelectorAll('[data-error]').forEach(button => button.setAttribute('aria-pressed', button.dataset.error === error));
  $('corrected').disabled = error === 'ideal' || (error === 'apparatus' && material === 'metal');
  $('corrected').checked = corrected;
  text('play', running ? '暫停' : r.done ? '重播' : active ? '繼續' : '開始加熱');
  text('scene-title', `${titles[error]}${corrected ? ' · 已採取預防措施' : ''}`);
  const stage = !active ? '可以開始加熱' : r.done ? '已達目標溫升' : !r.heating ? '已關掣 · 等待均溫' : running ? '加熱中' : '已暫停';
  text('stage', stage);
  $('timeline').value = state.time;
  $('timeline').setAttribute('aria-valuetext', stage);
  const trueCapacity = M.MATERIALS[material].c;
  const energyScale = M.POWER * state.config.duration;
  $('input-energy-bar').setAttribute('style', `width:${Math.min(100, state.input / energyScale * 100)}%`);
  $('sample-energy-bar').setAttribute('style', `width:${Math.min(100, state.sampleEnergy / energyScale * 100)}%`);
  text('sample-energy-label', material === 'water' ? '水實際吸能' : '金屬塊實際吸能');
  text('true-capacity', String(trueCapacity));
  text('measured-capacity', r.done ? String(Math.round(r.cMeasured)) : '—');
  const capacityError = r.done ? (r.cMeasured - trueCapacity) / trueCapacity * 100 : null;
  text('capacity-gap', capacityError === null ? '量度完成後顯示差距'
    : Math.abs(capacityError) < 0.05 ? '相差 0.0%（接近真值）'
    : `實驗值${capacityError > 0 ? '高出' : '低於'} ${Math.abs(capacityError).toFixed(1)}%`);
  text('energy-note', error === 'uneven' && corrected ? '以均溫後達到目標為準。焦耳計記錄總供能。' : '以溫度計達到同一目標讀數為準。');
  const [explanation, precaution] = descriptions();
  text('explanation', explanation);
  text('precaution', precaution);
  draw(r);
}

document.querySelectorAll('[data-material]').forEach(button => button.addEventListener('click', () => {
  material = button.dataset.material;
  if (material === 'metal' && error === 'apparatus') corrected = false;
  reset();
}));
document.querySelectorAll('[data-error]').forEach(button => button.addEventListener('click', () => {
  error = button.dataset.error; corrected = false; reset();
}));
$('corrected').addEventListener('change', () => { corrected = $('corrected').checked; reset(); });
$('reset').addEventListener('click', reset);
$('play').addEventListener('click', () => {
  cancelAnimationFrame(animationFrame);
  if (M.reading(state).done) reset();
  running = !running; previousFrame = 0; render();
  if (running) animationFrame = requestAnimationFrame(frame);
});
$('timeline').addEventListener('input', () => {
  cancelAnimationFrame(animationFrame); running = false;
  state = M.advance(M.create(material, error, corrected, 'far'), Number($('timeline').value));
  render();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAnimationFrame(animationFrame); running = false; render(); }
});
function frame(timestamp) {
  if (!running) return;
  if (previousFrame) M.advance(state, Math.min(0.1, (timestamp-previousFrame)/1000)*10);
  previousFrame = timestamp;
  if (M.reading(state).done) running = false;
  render();
  if (running) animationFrame = requestAnimationFrame(frame);
}
reset();
