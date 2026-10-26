'use strict';
const M = WaterVaporization, $ = id => document.getElementById(id);
const settings = ['immersed', 'noSpill', 'noLid', 'lateInitial', 'waitCalm'];
const joules = value => (Math.abs(value) < 0.05 ? 0 : value).toLocaleString('en', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
let state, running = false, previous = 0, frameId = 0, view, signalAudio, pendingReading = null;
try { view = WaterVaporization3D.mount($('apparatus-3d')); } catch (error) { $('render-error').hidden = false; console.error(error); }
function math(element, tex) {
  if (element.dataset.renderedTex === tex) return;
  element.dataset.renderedTex = tex;
  if (globalThis.katex) katex.render(tex, element, { throwOnError: false });
  else element.textContent = tex;
}
document.querySelectorAll('[data-tex]').forEach(element => math(element, element.dataset.tex));
function prepareSignalAudio() {
  const Audio = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!Audio) return;
  try { signalAudio ??= new Audio(); signalAudio.resume().catch(() => {}); } catch { /* 畫面提示仍可使用。 */ }
}
function signalTimeUp() {
  if (!signalAudio || signalAudio.state !== 'running') return;
  for (let i = 0; i < 2; i++) {
    const start = signalAudio.currentTime + i * 0.22, tone = signalAudio.createOscillator(), volume = signalAudio.createGain();
    tone.frequency.setValueAtTime(880, start); volume.gain.setValueAtTime(0, start);
    volume.gain.linearRampToValueAtTime(0.12, start + 0.01); volume.gain.linearRampToValueAtTime(0, start + 0.16);
    tone.connect(volume); volume.connect(signalAudio.destination); tone.start(start); tone.stop(start + 0.17);
  }
}
function reset() {
  cancelAnimationFrame(frameId); running = false; pendingReading = null;
  if ($('reading-dialog').open) $('reading-dialog').close();
  state = M.create({ ...Object.fromEntries(settings.map(id => [id, $(id).checked])), duration: Number($('duration').value) }); render();
}
function pauseForRecord(kind) {
  running = false; cancelAnimationFrame(frameId); pendingReading = kind;
  const record = state[kind], initial = kind === 'initial';
  $('reading-title').textContent = initial ? '記錄初讀數' : '記錄末讀數';
  $('reading-hint').textContent = initial
    ? state.config.lateInitial ? '水已穩定沸騰。記低讀數，再繼續量度。' : '水未沸騰。這次初讀數包括預熱。'
    : state.phase === 'complete' ? record.boiled ? '水已止沸。記低讀數，再查看比較。' : '水未曾沸騰，未能取得汽化讀數。'
    : record.boiled ? '已關掣，水仍會因餘熱汽化。' : '已關掣；水尚未沸騰，繼續觀察餘熱。';
  $('reading-mass').textContent = record.grams.toFixed(3) + ' g';
  $('reading-meter').textContent = record.kwh.toFixed(8) + ' kWh';
  $('reading-continue').textContent = initial ? '繼續量度' : state.phase === 'complete' ? '查看比較' : '繼續等止沸';
  render(); $('reading-dialog').showModal();
}
function renderRecord(record, suffix) {
  $('mass-' + suffix).textContent = record ? record.grams.toFixed(3) : '—';
  $('meter-' + suffix).textContent = record ? record.kwh.toFixed(8) + ' kWh' : '待記錄';
}
function render() {
  const r = M.reading(state), ready = state.phase === 'ready', complete = state.phase === 'complete', warming = state.phase === 'warming', cooling = state.phase === 'cooling';
  settings.forEach(id => $(id).disabled = !ready); $('duration').disabled = !ready;
  $('meter').textContent = r.current.kwh.toFixed(8); $('mass').textContent = r.current.grams.toFixed(3);
  $('temperature').textContent = '水溫 ' + state.temperature.toFixed(1) + ' °C';
  $('clock').textContent = '量度 ' + state.heatingTime.toFixed(1) + ' s · 全程 ' + state.time.toFixed(1) + ' s';
  $('q-reading').textContent = state.initial ? '量度供能 ' + joules(r.q) + ' J' : '量度供能：待初讀數';
  $('timer-signal').hidden = state.heatingTime < state.config.duration;
  $('stage').textContent = pendingReading ? (pendingReading === 'initial' ? '初讀數' : '末讀數') + ' · 已暫停' : ready ? '等待開始' : complete ? state.boiled ? '止沸 · 記錄完成' : '已結束 · 未沸騰' : !running ? '已暫停' : warming ? state.boiled ? '等待穩定沸騰' : '預熱中' : cooling ? '關掣後觀察' : '量度中';
  $('play').textContent = ready ? '開始加熱' : complete ? '實驗完成' : running ? '暫停' : cooling ? '繼續等待' : '繼續加熱';
  $('play').disabled = complete; $('stop').disabled = !['warming', 'heating'].includes(state.phase);
  renderRecord(r.initial, 'a'); renderRecord(r.final, 'b');
  const e = r.energy, scale = 1 / 1800, width = e.available * scale, electricWidth = e.input * scale;
  const releasedWidth = (e.heaterRelease + e.waterRelease) * scale, join = 68 - width / 2 + electricWidth;
  $('energy-title').textContent = state.initial ? '能量去向 · 量度時段' : '能量去向 · 預熱';
  $('energy-note').textContent = !state.initial ? '初讀數前的能量，量度時扣除。' : state.final ? '初 → 末：與比較值採用同一時段。' : '初 → 目前：包含儲熱的增減。';
  $('energy-guide').toggleAttribute('hidden', e.available > 0);
  $('energy-trunk').setAttribute('y', 68 - width / 2); $('energy-trunk').setAttribute('height', electricWidth);
  $('energy-released').setAttribute('d', releasedWidth < 1e-6 ? '' : `M8 ${112 - releasedWidth / 2}H65C105 ${112 - releasedWidth / 2} 110 ${join} 140 ${join}V${join + releasedWidth}C110 ${join + releasedWidth} 105 ${112 + releasedWidth / 2} 65 ${112 + releasedWidth / 2}H8Z`);
  $('energy-input').textContent = (state.initial ? '電表差 ' : '電能 ') + joules(e.input) + ' J';
  $('energy-release-label').textContent = '釋熱：電熱器 ' + joules(e.heaterRelease) + ' J · 水 ' + joules(e.waterRelease) + ' J';
  const flows = [['vapor', e.vaporization, 30, '汽化逸出'], ['warming', Math.max(0, e.warming), 60, '水升溫'], ['heater', Math.max(0, e.heater), 90, '儲熱增加'], ['loss', e.loss, 120, '散熱／冷凝']];
  let top = 68 - width / 2;
  for (const [name, energy, target, label] of flows) {
    const thickness = Math.max(0, energy) * scale, bottom = top + thickness;
    $('energy-' + name).setAttribute('d', thickness < 1e-6 ? '' : 'M140 ' + top + 'C190 ' + top + ' 215 ' + (target - thickness / 2) + ' 275 ' + (target - thickness / 2) + 'V' + (target + thickness / 2) + 'C215 ' + (target + thickness / 2) + ' 190 ' + bottom + ' 140 ' + bottom + 'Z');
    $('energy-' + name + '-label').textContent = label + ' ' + joules(energy) + ' J'; top = bottom;
  }
  $('energy-flow').setAttribute('aria-label', $('energy-input').textContent + '；' + $('energy-release-label').textContent + '；' + flows.map(([, energy, , label]) => label + ' ' + joules(energy) + ' J').join('；') + '。線寬按焦耳數，使用固定刻度。');
  $('experimental-label').textContent = state.final ? '實驗值（已記錄）' : ready ? '實驗值' : '實驗值（即時）';
  $('experimental-value').classList.toggle('pending', r.measured === null);
  if (r.measured !== null) {
    const [mantissa, exponent] = r.measured.toExponential(2).split('e');
    math($('experimental-value'), mantissa + '\\times10^{' + Number(exponent) + '}\\,\\mathrm{J\\,kg^{-1}}');
    const deviation = r.deviation.toFixed(1); math($('deviation'), (Number(deviation) > 0 ? '+' : '') + (Number(deviation) === 0 ? '0.0' : deviation) + '\\%');
  } else {
    $('experimental-value').textContent = ready ? '未開始' : complete ? '未能比較' : state.initial ? '待質量減少' : '待沸騰'; delete $('experimental-value').dataset.renderedTex; math($('deviation'), '\\text{—}');
  }
  $('comparison-status').textContent = ready ? (state.config.lateInitial ? '穩定沸騰後，再記初讀數。' : '初讀數將在預熱前記錄。') + '\n按「開始加熱」觀察。'
    : complete ? r.measured === null ? '未能取得有效讀數。\n按「重設」再試。' : '已記錄末讀數。\n比較實驗值與真確值。'
    : !running ? '已暫停。\n按「' + (cooling ? '繼續等待' : '繼續加熱') + '」觀察。'
    : warming ? state.boiled ? '等待沸騰穩定，再記初讀數。' : '加熱至 100 °C，再等沸騰穩定。'
    : cooling ? state.final ? '末讀數及能量圖已固定。\n繼續觀察餘熱。' : '關掣後仍有餘熱。\n觀察水升溫或繼續汽化。'
    : state.temperature < 100 - 1e-8 ? '初讀數已記錄；水仍未沸騰。\n觀察升溫所用的能量。' : '初讀數已記錄。\n觀察質量減少及量度供能。';
  view?.update(state, r, { running, reducedMotion: matchMedia('(prefers-reduced-motion:reduce)').matches });
}
function frame(timestamp) {
  if (!running) return;
  const hadInitial = !!state.initial, hadFinal = !!state.final;
  const wasHeating = state.phase === 'heating', elapsed = previous ? Math.min(0.1, (timestamp - previous) / 1000) * 10 : 0;
  previous = timestamp; M.advance(state, elapsed, true);
  if (wasHeating && state.heatingTime >= state.config.duration - 1e-8) signalTimeUp();
  if (!hadInitial && state.initial) { pauseForRecord('initial'); return; }
  if (!hadFinal && state.final) { pauseForRecord('final'); return; }
  if (state.phase === 'complete') running = false;
  render(); if (running) frameId = requestAnimationFrame(frame);
}
function run() { if (!running) { running = true; previous = 0; frameId = requestAnimationFrame(frame); } }
settings.forEach(id => $(id).addEventListener('change', reset)); $('duration').addEventListener('change', reset);
$('play').addEventListener('click', () => {
  if (running) { running = false; cancelAnimationFrame(frameId); }
  else { prepareSignalAudio(); const hadInitial = !!state.initial; M.start(state); if (!hadInitial && state.initial) pauseForRecord('initial'); else run(); }
  render();
});
$('stop').addEventListener('click', () => { const hadFinal = !!state.final; M.stop(state); if (!hadFinal && state.final) pauseForRecord('final'); else render(); });
$('reading-continue').addEventListener('click', () => { pendingReading = null; $('reading-dialog').close(); if (state.phase !== 'complete') run(); render(); });
$('reading-dialog').addEventListener('close', () => { pendingReading = null; render(); });
$('model-info').addEventListener('click', () => { running = false; cancelAnimationFrame(frameId); render(); $('model-dialog').showModal(); });
$('model-close').addEventListener('click', () => $('model-dialog').close());
$('reset').addEventListener('click', reset); $('reset-view').addEventListener('click', () => view?.resetView());
reset();
