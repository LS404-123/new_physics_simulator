'use strict';
const $ = id => document.getElementById(id);
const M = SpecificHeat;
const titles = { ideal: '理想情況', loss: '散熱到周圍', apparatus: '器材吸熱', uneven: '溫度不均' };
let material = 'water', error = 'loss', corrected = false, probe = 'far', prediction = '';
let state = M.create(material, error), running = false, previousFrame = 0, animationFrame = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const text = (id, value) => { if ($(id).textContent !== value) $(id).textContent = value; };
const visible = (id, show) => $(id).toggleAttribute('hidden', !show);

function reset(clearPrediction = false) {
  cancelAnimationFrame(animationFrame);
  running = false;
  if (error !== 'uneven' || corrected) probe = 'far';
  state = M.create(material, error, corrected, probe);
  if (clearPrediction) prediction = '';
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
    corrected ? '先關掣再等候均溫，讀數繼續升至目標；總供能接近理想情況。' : (probe === 'near' ? '近端較熱，讀數較早達標便關掣，總供能較少；此時平均溫升仍不足。' : '遠端較冷，要加熱更久才達到目標讀數，總供能較多；此時平均溫升已過高。'),
    water ? '關掣後繼續輕輕攪拌，水溫均勻後記錄最高穩定溫度。' : '關掣後先等候，讓熱傳至溫度計所在位置，再記錄最高溫度。'
  ];
}

function draw(r) {
  const water = material === 'water', hasLoss = error === 'loss' && !corrected;
  const active = state.time > 0;
  const lift = hasLoss ? 75 : 0;
  visible('water-vessel', water); visible('metal-vessel', !water);
  visible('water-heater', water); visible('metal-heater', !water);
  visible('metal-insulation', !water && !hasLoss);
  visible('lid', !hasLoss); visible('stirrer', water);
  visible('stir-motion', water && error === 'uneven' && corrected && !r.heating && !r.done);
  visible('loss-flow', hasLoss && active);
  visible('apparatus-flow', error === 'apparatus' && active);
  visible('region-labels', error === 'uneven' && active);
  visible('transfer', active && (r.heating || (error === 'uneven' && !r.done)));
  $('heater').setAttribute('transform', `translate(0,${-lift})`);
  $('wire-a').setAttribute('d', `M174 340C273 400 262 ${102-lift} 357 ${105-lift}Q380 ${105-lift} 381 ${130-lift}`);
  $('wire-b').setAttribute('d', `M195 340C285 389 279 ${118-lift} 370 ${118-lift}Q396 ${118-lift} 399 ${130-lift}`);
  $('heater-lead').setAttribute('d', `M409 ${146-lift}L454 60H511`);
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
  const probeX = probe === 'near' ? -55 : 0;
  $('thermometer').setAttribute('transform', `translate(${probeX},0)`);
  $('probe-hole').setAttribute('cx', 499 + probeX);
  $('water-probe-hole').setAttribute('cx', 499 + probeX);
  $('thermometer-lead').setAttribute('d', `M${506+probeX} 148L565 124H609`);
  $('mercury').setAttribute('d', `M499 348V${320-(r.temperature-M.ROOM)*10}`);
  $('target-line').setAttribute('d', `M488 ${320-M.TARGET_RISE*10}H557`);
  $('target-label').setAttribute('y', 312-M.TARGET_RISE*10);
  $('supply-fill').setAttribute('width', 112 * state.input / (2.1 * state.config.referenceEnergy));
  text('supply-status', !active ? '未供能' : r.heating ? '持續供能' : '已停止供能');
  const uniform = state.spread < 0.01;
  text('temperature-status', !active ? '未升溫' : !uniform ? (probe === 'near' ? '這裏較熱' : '這裏較冷') : '溫度均勻');
  text('probe-label', probe === 'near' ? '靠近電熱器' : '遠離電熱器');
  text('near-status', uniform ? '兩邊溫度相同' : '近端較熱');
  text('far-status', uniform ? '' : '遠端較冷');
  text('setup-note', hasLoss ? (water ? '發熱部分未完全浸沒' : '發熱段未完全插入孔內') : error === 'uneven' ? (corrected && !r.heating ? (water ? '關掣後繼續攪拌' : '關掣後等候均溫') : '觀察不同位置的溫度') : error === 'apparatus' ? (water ? (corrected ? '換上低熱容量的杯' : '杯和電熱器也會升溫') : '電熱器也會吸熱') : (water ? '發熱部分完全浸沒' : '發熱段完全在孔內'));
  text('setup-detail', hasLoss ? '留意外露的發熱部分' : !water ? '直棒沿同一孔洞插入，底端留在孔內' : corrected && error === 'uneven' ? '攪拌使溫度均勻' : '杯身剖開，方便觀察內部');
  text('diagram-desc', `${$('setup-note').textContent}。${$('supply-status').textContent}，${$('temperature-status').textContent}。顏色表示溫度，箭頭表示能量流向。`);
  // 位移只由實驗時間決定；暫停後熱流及攪拌一併停止。
  const phase = reducedMotion ? 0.5 : (state.time % 2) / 2;
  $('energy-dot').setAttribute('cx', 419 + 36 * phase);
  $('loss-path').setAttribute('stroke-dasharray', '8 6');
  $('loss-path').setAttribute('stroke-dashoffset', -phase * 28);
  $('stirrer').setAttribute('transform', `translate(${18 + (water && corrected && error === 'uneven' && !r.heating && !r.done && !reducedMotion ? Math.sin(state.time*2)*6 : 0)},0)`);
}

function render() {
  const r = M.reading(state, probe), active = state.time > 0;
  document.querySelectorAll('[data-material]').forEach(button => button.setAttribute('aria-pressed', button.dataset.material === material));
  document.querySelectorAll('[data-error]').forEach(button => button.setAttribute('aria-pressed', button.dataset.error === error));
  document.querySelectorAll('[data-energy]').forEach(button => {
    button.setAttribute('aria-pressed', button.dataset.energy === prediction);
    button.disabled = active;
  });
  $('corrected').disabled = error === 'ideal' || (error === 'apparatus' && material === 'metal');
  $('corrected').checked = corrected;
  $('play').disabled = !prediction;
  $('timeline').disabled = !prediction;
  visible('probe', error === 'uneven' && !corrected);
  text('probe', probe === 'far' ? '改量近端並重設' : '改量遠端並重設');
  text('play', running ? '暫停' : r.done ? '重播' : active ? '繼續' : '開始加熱');
  text('scene-title', `${titles[error]}${corrected ? ' · 已採取預防措施' : ''}`);
  const stage = !prediction ? '先預測總供能' : !active ? '可以開始加熱' : r.done ? '已達目標溫升' : !r.heating ? '已關掣 · 等待均溫' : running ? '加熱中' : '已暫停';
  text('stage', stage);
  $('timeline').value = state.time;
  $('timeline').setAttribute('aria-valuetext', stage);
  const waiting = active ? '觀察中' : '等待觀察';
  text('input-change', r.done ? {same:'相同',more:'較多',less:'較少'}[r.inputTrend] : waiting);
  text('heat-change', r.done ? {same:'相同',more:'較多',less:'較少'}[r.heatTrend] : waiting);
  text('capacity-change', r.done ? {same:'接近正確值',more:'偏大',less:'偏小'}[r.capacityTrend] : waiting);
  text('energy-result', r.done ? (prediction === r.inputTrend ? '預測吻合' : '預測需修正') : waiting);
  text('sample-energy-label', material === 'water' ? '水實際吸收的能量' : '金屬塊實際吸收的能量');
  text('energy-note', error === 'uneven' && corrected ? '以均溫後達到目標為準。焦耳計記錄總供能。' : '以溫度計達到同一目標讀數為準。');
  const [explanation, precaution] = descriptions();
  text('explanation', explanation);
  text('precaution', precaution);
  text('prediction-feedback', r.done ? `與理想情況相比，所需總供能${{same:'相同',more:'較多',less:'較少'}[r.inputTrend]}。` : '');
  draw(r);
}

document.querySelectorAll('[data-material]').forEach(button => button.addEventListener('click', () => {
  material = button.dataset.material;
  if (material === 'metal' && error === 'apparatus') corrected = false;
  reset(true);
}));
document.querySelectorAll('[data-error]').forEach(button => button.addEventListener('click', () => {
  error = button.dataset.error; corrected = false; probe = 'far'; reset(true);
}));
document.querySelectorAll('[data-energy]').forEach(button => button.addEventListener('click', () => { prediction = button.dataset.energy; render(); }));
$('corrected').addEventListener('change', () => { corrected = $('corrected').checked; reset(true); });
$('reset').addEventListener('click', () => reset(true));
$('probe').addEventListener('click', () => { probe = probe === 'far' ? 'near' : 'far'; reset(true); });
$('play').addEventListener('click', () => {
  cancelAnimationFrame(animationFrame);
  if (M.reading(state).done) reset();
  running = !running; previousFrame = 0; render();
  if (running) animationFrame = requestAnimationFrame(frame);
});
$('timeline').addEventListener('input', () => {
  cancelAnimationFrame(animationFrame); running = false;
  state = M.advance(M.create(material, error, corrected, probe), Number($('timeline').value));
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
