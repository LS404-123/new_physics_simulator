'use strict';
const M = IceFusion, $ = id => document.getElementById(id);
const settings = ['crushed', 'melting', 'mesh', 'control'];
let state, running = false, previous = 0, frameId = 0;
let view, signalAudio;
try { view = IceFusion3D.mount($('apparatus-3d')); } catch (error) { $('render-error').hidden = false; console.error(error); }
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
    tone.frequency.setValueAtTime(880, start);
    volume.gain.setValueAtTime(0, start);
    volume.gain.linearRampToValueAtTime(0.12, start + 0.01);
    volume.gain.linearRampToValueAtTime(0, start + 0.16);
    tone.connect(volume); volume.connect(signalAudio.destination);
    tone.start(start); tone.stop(start + 0.17);
  }
}
function reset() {
  cancelAnimationFrame(frameId); running = false;
  if (!$('control').checked) $('fallen-into').value = 'B';
  state = M.create({ ...Object.fromEntries(settings.map(id => [id, $(id).checked])), duration: Number($('duration').value), fallenInto: $('fallen-into').value });
  render();
}
function render() {
  const r = M.reading(state), ready = state.phase === 'ready', complete = state.phase === 'complete', draining = state.phase === 'draining';
  settings.forEach(id => $(id).disabled = !ready);
  $('duration').disabled = !ready;
  $('fallen-into').disabled = !ready || !state.config.control;
  $('fall-setting').hidden = state.config.mesh;
  $('scene-title').textContent = state.config.control ? 'A 對照 · B 加熱' : 'B 加熱';
  $('mass-a-block').hidden = !state.config.control;
  $('joules').textContent = r.input.toLocaleString('en');
  $('clock').textContent = `加熱 ${state.heatingTime.toFixed(1)} s · 集水 ${state.time.toFixed(1)} s`;
  $('timer-signal').hidden = state.heatingTime < state.config.duration - 1e-8;
  $('stage').textContent = ready ? '等待開始' : complete ? '集水完成' : running ? draining ? '關掣後集水' : '加熱中' : '已暫停';
  $('play').textContent = ready ? '開始加熱' : complete ? '實驗完成' : running ? '暫停' : draining ? '繼續集水' : '繼續加熱';
  $('play').disabled = complete;
  $('stop').disabled = state.phase !== 'heating';
  $('mass-a').textContent = r.gramsA !== null ? r.gramsA.toFixed(1) : '—';
  $('mass-b').textContent = r.gramsB.toFixed(1);
  $('balance-note').hidden = state.config.melting;
  $('balance-note').textContent = `冰溫 ${state.config.control ? `A ${r.temperatureA.toFixed(1)} °C · ` : ''}B ${r.temperatureB.toFixed(1)} °C`;
  // 固定刻度；最大供能 14400 J 對應 48 個 SVG 單位，不隨總供能或加熱時間改刻度。
  const scale = 1 / 300, width = state.input * scale;
  $('energy-guide').toggleAttribute('hidden', state.input > 0);
  $('energy-trunk').setAttribute('y', 68 - width / 2);
  $('energy-trunk').setAttribute('height', width);
  $('energy-input').textContent = `焦耳計 ${r.input} J`;
  const flows = [['fusion', state.fusionEnergy, 30, '熔冰'], ['warming', state.warmingEnergy, 62, '冰升溫'], ['heater', state.heater, 94, '電熱器儲能'], ['loss', state.lost, 126, '散熱']];
  let top = 68 - width / 2;
  for (const [name, energy, target, label] of flows) {
    const thickness = Math.max(0, energy) * scale, bottom = top + thickness;
    $('energy-' + name).setAttribute('d', thickness < 1e-6 ? '' : `M140 ${top}C190 ${top} 215 ${target - thickness / 2} 275 ${target - thickness / 2}V${target + thickness / 2}C215 ${target + thickness / 2} 190 ${bottom} 140 ${bottom}Z`);
    $('energy-' + name + '-label').textContent = `${label} ${Math.round(energy)} J`;
    top = bottom;
  }
  $('energy-flow').setAttribute('aria-label', `焦耳計供能 ${r.input} J。${flows.map(([, energy, , label]) => `${label} ${Math.round(energy)} J`).join('；')}。${state.input > 0 ? '線寬按焦耳數，使用固定刻度。' : '尚未供能，虛線示意分流位置。'}`);
  const ambient = Math.round(M.AMBIENT * state.time);
  $('ambient-energy').textContent = `環境供熱（另計）：${state.config.control ? `A ${ambient} J · ` : ''}B ${ambient} J`;
  $('experimental-label').textContent = complete ? '實驗值（最終）' : ready ? '實驗值' : '實驗值（即時）';
  $('experimental-value').classList.toggle('pending', r.measuredLatentHeat === null);
  if (r.measuredLatentHeat !== null) {
    const [mantissa, exponent] = r.measuredLatentHeat.toExponential(2).split('e');
    math($('experimental-value'), `${mantissa}\\times10^{${Number(exponent)}}\\,\\mathrm{J\\,kg^{-1}}`);
    const deviation = r.deviationPercent.toFixed(1);
    math($('deviation'), `${Number(deviation) > 0 ? '+' : ''}${Number(deviation) === 0 ? '0.0' : deviation}\\%`);
  } else {
    $('experimental-value').textContent = ready ? '未開始' : complete ? '未能比較' : '待集水';
    delete $('experimental-value').dataset.renderedTex;
    math($('deviation'), '\\text{—}');
  }
  math($('reference-value'), `${(M.L / 100000).toFixed(2)}\\times10^5\\,\\mathrm{J\\,kg^{-1}}`);
  $('comparison-status').textContent = ready ? `${state.config.control ? '先預測：只加熱 B，哪杯增重較多？' : '先預測：沒有對照，實驗值會怎樣？'}\n按「開始加熱」觀察。`
    : complete ? r.measuredLatentHeat === null ? '未能取得有效讀數。\n按「重設」再試。' : '集水完成。\n比較實驗值與真確值。'
    : !running ? `已暫停。\n按「${draining ? '繼續集水' : '繼續加熱'}」觀察。`
    : draining ? '關掣後仍會集水。\n等讀數穩定，再比較。'
    : `${state.config.control ? '觀察兩杯' : '觀察 B 杯'}增重及電能去向。\n實驗值隨集水更新。`;
  view?.update(state, r, { running, reducedMotion: matchMedia('(prefers-reduced-motion:reduce)').matches });
}
function frame(timestamp) {
  if (!running) return;
  const wasHeating = state.phase === 'heating';
  const elapsed = previous ? Math.min(0.1, (timestamp - previous) / 1000) * 10 : 0;
  previous = timestamp; M.advance(state, elapsed);
  if (wasHeating && state.heatingTime >= state.config.duration - 1e-8) signalTimeUp();
  if (state.phase === 'complete') running = false;
  render();
  if (running) frameId = requestAnimationFrame(frame);
}
function run() { if (!running) { running = true; previous = 0; frameId = requestAnimationFrame(frame); } }
settings.forEach(id => $(id).addEventListener('change', reset));
$('duration').addEventListener('change', reset); $('fallen-into').addEventListener('change', reset);
$('play').addEventListener('click', () => { if (running) { running = false; cancelAnimationFrame(frameId); } else { prepareSignalAudio(); M.start(state); run(); } render(); });
$('stop').addEventListener('click', () => { M.stop(state); render(); });
$('reset').addEventListener('click', reset); $('reset-view').addEventListener('click', () => view?.resetView());
reset();
