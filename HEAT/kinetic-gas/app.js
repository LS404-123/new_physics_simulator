(function () {
  'use strict';
  const M = KineticGas, $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let state = M.create(), fixedPressure = null;
  let paused = reducedMotion.matches, previous = 0, frame = 0;
  const circles = [];

  function element(tag, attrs, parent) {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    parent.append(node); return node;
  }
  for (let i = 0; i < M.COUNT; i++) {
    circles.push(element('circle', { r: i === 0 ? 6.5 : 5, class: i === 0 ? 'particle tracked' : 'particle' }, $('particles')));
  }

  function drawParticles() {
    const width = state.width * 200;
    $('gas-space').setAttribute('width', width);
    $('fixed-walls').setAttribute('d', `M${84 + width} 50H84V350H${84 + width}`);
    $('piston').setAttribute('transform', `translate(${84 + width} 0)`);
    for (let i = 0; i < state.particles.length; i++) {
      const p = state.particles[i];
      circles[i].setAttribute('cx', 84 + p.x * 200); circles[i].setAttribute('cy', 50 + p.y * 200);
    }
    const collisions = $('collisions'); collisions.replaceChildren();
    for (const hit of state.hits) {
      if (hit.axis === 'z') continue;
      const x = 84 + hit.x * 200, y = 50 + hit.y * 200;
      const opacity = Math.max(0, 1 - (state.time - hit.time) / 0.28);
      if (hit.axis === 'x' && hit.side === -1) {
        element('path', { d: `M${x - 3} ${y}h${-Math.min(78, 12 + hit.impulse * 10)}`, class: 'hit', opacity }, collisions);
      } else {
        element('circle', { cx: x, cy: y, r: 7, class: 'hit', opacity, 'stroke-width': 1.5 }, collisions);
      }
    }
  }

  function relative(value, initial) {
    if (Math.abs(value - initial) < 1e-8) return '與起始相同';
    return value > initial ? '高於起始' : '低於起始';
  }
  function render() {
    const r = M.readings(state);
    for (const [quantity, id, initial] of [['V', 'volume', 20], ['T', 'temperature', 300]]) {
      const limits = M.inputRange(quantity), input = $(`${id}-input`);
      input.min = limits.min; input.max = limits.max;
      input.step = fixedPressure === null ? limits.step : 'any'; input.value = r[quantity];
      input.style.setProperty('--range-position', `${100 * (r[quantity] - limits.min) / (limits.max - limits.min)}%`);
      input.setAttribute('aria-valuetext', relative(r[quantity], initial));
    }
    $('pressure-lock').checked = fixedPressure !== null;
    const width = 36 * r.frequency, height = 80 * r.impulse;
    const pressureRatio = r.frequency * r.impulse;
    $('frequency-bar').setAttribute('width', width);
    $('impulse-bar').setAttribute('height', height);
    $('impulse-bar').setAttribute('y', 158 - height);
    $('product-area').setAttribute('width', width);
    $('product-area').setAttribute('height', height);
    $('product-area').setAttribute('y', 158 - height);
    $('pressure-bar').style.width = `${pressureRatio / 8 * 100}%`;
    for (const [name, label, ratio] of [['pressure', '壓強', pressureRatio], ['frequency', '每秒撞擊次數', r.frequency], ['impulse', '每次平均動量轉變', r.impulse]]) {
      $(`${name}-comparison`).setAttribute('aria-label', `${label}：${relative(ratio, 1)}`);
    }
    drawParticles();
  }

  function tick(now) {
    frame = 0;
    if (paused) return;
    if (previous) M.advance(state, Math.min((now - previous) / 1000, 0.05) * 0.65);
    previous = now; drawParticles(); frame = requestAnimationFrame(tick);
  }
  function playback() {
    $('play').textContent = paused ? '播放分子' : '暫停分子'; $('play').setAttribute('aria-pressed', String(paused));
    previous = 0;
    if (paused) { cancelAnimationFrame(frame); frame = 0; }
    else if (!frame) frame = requestAnimationFrame(tick);
  }
  for (const [id, quantity] of [['volume-input', 'V'], ['temperature-input', 'T']]) {
    $(id).addEventListener('input', event => {
      const limits = M.inputRange(quantity, fixedPressure);
      const value = Math.max(limits.min, Math.min(limits.max, Number(event.target.value)));
      M.setCondition(state, quantity, value, fixedPressure); render();
    });
  }
  $('pressure-lock').addEventListener('change', event => { fixedPressure = event.target.checked ? M.readings(state).p : null; render(); });
  $('play').addEventListener('click', () => { paused = !paused; playback(); });
  $('reset').addEventListener('click', () => { state = M.create(); fixedPressure = null; render(); });
  reducedMotion.addEventListener('change', event => { if (event.matches) { paused = true; playback(); } });
  document.addEventListener('visibilitychange', () => { previous = 0; });
  render(); playback();
})();
