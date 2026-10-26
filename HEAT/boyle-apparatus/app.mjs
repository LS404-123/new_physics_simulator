const geometry = __DATA__;
const svg = document.querySelector('.stage svg');
const handle = document.querySelector('#piston-hit');
const movingParts = [...document.querySelectorAll('[data-moving]')];
const hardware = document.querySelector('#hardware');
const parts = [...hardware.children].map(node => ({ node, key: Number(node.dataset.depth), travel: Number(node.dataset.travelDepth) }));
const needle = document.querySelector('#needle');
const gaugeFace = document.querySelector('[data-part="gauge.face"]');
gaugeFace.setAttribute('role','img');
const demoButton = document.querySelector('#demo');
const status = document.querySelector('#status');
const gasFill = document.querySelector('#gas-fill');
const temperatureLabel = document.querySelector('#temperature-state');
const temperatureSwatch = document.querySelector('#temperature-swatch');
const still = matchMedia('(prefers-reduced-motion: reduce)');
let volume = MAX_VOLUME, target = volume, touring = !still.matches;
let state = apparatusState(volume);
let frame = 0, last = 0, tourTime = 0, visible = true, drag = null;

function describe() {
  handle.setAttribute('aria-valuenow', state.V.toFixed(1));
  handle.setAttribute('aria-valuetext', `氣缸 ${state.V.toFixed(1)} 毫升，連管總體積 ${state.totalVolume.toFixed(1)} 毫升；${temperatureLabel.textContent}`);
}
function draw() {
  const dx = state.pistonX - MAX_VOLUME * POSITION_SCALE;
  const transform = `translate(${geometry.axis[0] * dx} ${geometry.axis[1] * dx})`;
  for (const part of movingParts) part.setAttribute('transform', transform);
  const share = (MAX_VOLUME - volume) / (MAX_VOLUME - MIN_VOLUME);
  parts.sort((a, b) => a.key + a.travel * share - b.key - b.travel * share);
  for (const [i, part] of parts.entries()) if (hardware.children[i] !== part.node) hardware.insertBefore(part.node, hardware.children[i]);
  handle.setAttribute('transform', transform);
  needle.setAttribute('transform', `rotate(${state.needleAngle})`);
  gaugeFace.setAttribute('aria-label',`絕對壓強 ${state.p.toFixed(0)} 千帕`);
  const near = geometry.gasArc.map(p => p.map((v,i) => v + geometry.axis[i] * .4));
  const far = geometry.gasArc.toReversed().map(p => p.map((v,i) => v + geometry.axis[i] * (state.pistonX - .4)));
  gasFill.setAttribute('d', [...near,...far].map((p,i) => `${i?'L':'M'}${p.join(' ')}`).join('')+'Z');
  const difference = state.T - AMBIENT_TEMPERATURE;
  const strength = Math.min(1,Math.abs(difference)/65);
  const from = [205,201,176], to = difference >= 0 ? [232,117,54] : [60,153,209];
  const colour = `rgb(${from.map((v,i)=>Math.round(v+(to[i]-v)*strength)).join(',')})`;
  gasFill.style.fill = colour;
  temperatureSwatch.style.backgroundColor = colour;
  temperatureLabel.textContent = difference > .6 ? '高於室溫 · 停低後散熱' : difference < -.6 ? '低於室溫 · 停低後吸熱' : volume === target && !drag ? '氣體接近室溫 · 讀數穩定' : '氣體接近室溫';
  svg.dataset.volume = state.V.toFixed(4);
  svg.dataset.pressure = state.p.toFixed(4);
  svg.dataset.temperature = state.T.toFixed(4);
  svg.dataset.totalVolume = state.totalVolume.toFixed(4);
}
function buttons() {
  demoButton.textContent = still.matches ? '切換位置' : touring ? '停止示範' : '示範';
  demoButton.setAttribute('aria-pressed', String(touring));
}
function tick(now) {
  frame = 0;
  if (!visible || document.hidden) { last = 0; return; }
  const dt = last ? (now - last) / 1000 : 0;
  last = now;
  if (touring) {
    tourTime += dt;
    const phase = tourTime % 30;
    target = phase < 3 || phase >= 17 ? 20 : 10;
  }
  const wasMoving = volume !== target, phaseBefore = temperatureLabel.textContent;
  state = still.matches ? advanceGas(state,target,dt) : followPiston(state,target,dt);
  volume = state.V;
  if (volume === target && Math.abs(state.T - AMBIENT_TEMPERATURE) < .03) state = apparatusState(volume);
  draw();
  if (wasMoving && volume === target || phaseBefore !== temperatureLabel.textContent) describe();
  if (touring || volume !== target || state.T !== AMBIENT_TEMPERATURE) frame = requestAnimationFrame(tick);
  else describe();
}
function run() { if (!frame && visible && !document.hidden) { last = 0; frame = requestAnimationFrame(tick); } }
function steer(next) {
  touring = false;
  target = Math.max(MIN_VOLUME, Math.min(MAX_VOLUME, next));
  buttons();
  if (still.matches) { volume = target; state = advanceGas(state,volume,0); draw(); }
  describe(); run();
}
function pointerPosition(event) {
  return new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse());
}
handle.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  event.preventDefault(); handle.focus();
  steer(volume);
  drag = { id: event.pointerId, start: pointerPosition(event), volume };
  handle.setPointerCapture(event.pointerId);
});
handle.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.id) return;
  const point = pointerPosition(event), [x, y] = geometry.axis;
  const movement = ((point.x - drag.start.x) * x + (point.y - drag.start.y) * y) / (x * x + y * y);
  steer(volumeFromDrag(drag.volume, movement));
});
function release(event) {
  if (!drag || event.pointerId !== drag.id) return;
  if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  drag = null; describe();
}
handle.addEventListener('pointerup', release);
handle.addEventListener('pointercancel', release);
handle.addEventListener('lostpointercapture', () => { drag = null; });
handle.addEventListener('keydown', event => {
  let next = target;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next -= event.shiftKey ? 5 : .5;
  else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next += event.shiftKey ? 5 : .5;
  else if (event.key === 'Home') next = MAX_VOLUME;
  else if (event.key === 'End') next = MIN_VOLUME;
  else return;
  event.preventDefault(); steer(next);
});
handle.addEventListener('focus', () => { if (touring) steer(volume); });
demoButton.addEventListener('click', () => {
  if (still.matches) steer(volume > 15 ? 10 : 20);
  else if (touring) steer(volume);
  else { touring = true; tourTime = 0; buttons(); run(); }
});
document.querySelector('#reset').addEventListener('click', () => {
  touring = false; volume = target = MAX_VOLUME; state = apparatusState(volume);
  draw(); buttons(); describe();
  status.value = '已重設至室溫：氣缸 20 毫升，連管總體積 22 毫升，絕對壓強 100 千帕。';
});
still.addEventListener('change', () => { if (still.matches) steer(volume); buttons(); });
new IntersectionObserver(entries => { visible = entries.at(-1).isIntersecting; if (visible) run(); }).observe(svg);
new ResizeObserver(() => {
  svg.setAttribute('viewBox', geometry.viewBox);
  const matrix = svg.getScreenCTM();
  if (matrix) handle.setAttribute('r', Math.max(42, 24 / Math.hypot(matrix.a, matrix.b)));
}).observe(svg);
document.addEventListener('visibilitychange', () => { last = 0; if (!document.hidden) run(); });
buttons(); draw(); describe(); run();
