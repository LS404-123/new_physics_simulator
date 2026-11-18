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
  const wallForces = [], referenceForces = [];
  for (let i = 0; i < 8; i++) {
    referenceForces.push(element('path', {}, $('wall-force-reference')));
    wallForces.push(element('path', {}, $('wall-force')));
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
      const dx = hit.axis === 'x' ? hit.side : 0, dy = hit.axis === 'y' ? hit.side : 0;
      const x = 84 + hit.x * 200 + (dx > 0 ? 16 : dx * 3), y = 50 + hit.y * 200 + dy * 4;
      const opacity = Math.max(0, 1 - (state.time - hit.time) / 0.28);
      const length = Math.min(78, 12 + hit.impulse * 10);
      element('path', { d: `M${x} ${y}l${dx * length} ${dy * length}`, class: 'hit', opacity }, collisions);
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
    // 壓強範圍很闊；以有界長度比較大小，避免箭嘴超出畫布。
    const strength = pressureRatio / (1 + pressureRatio);
    const forceLength = 70 * strength, wallWidth = state.width * 200, band = 24 * strength;
    const right = 98 + wallWidth;
    $('pressure-band').setAttribute('d', `M${84 - band} ${50 - band}H${right + band}V${350 + band}H${84 - band}Z M84 50H${right}V350H84Z`);
    $('pressure-band').setAttribute('fill-opacity', 0.12 + 0.4 * strength);
    $('wall-force').style.strokeWidth = 2 + 3 * strength;
    const forcePositions = [
      [80, 125, -1, 0], [80, 275, -1, 0],
      [100 + wallWidth, 125, 1, 0], [100 + wallWidth, 275, 1, 0],
      [84 + wallWidth / 3, 46, 0, -1], [84 + wallWidth * 2 / 3, 46, 0, -1],
      [84 + wallWidth / 3, 354, 0, 1], [84 + wallWidth * 2 / 3, 354, 0, 1]
    ];
    forcePositions.forEach(([x, y, dx, dy], i) => {
      wallForces[i].setAttribute('d', `M${x} ${y}l${dx * forceLength} ${dy * forceLength}`);
      referenceForces[i].setAttribute('d', `M${x} ${y}l${dx * 35} ${dy * 35}`);
    });
    $('wall-force').setAttribute('aria-label', `同樣小面積壁面的平均受力：${relative(pressureRatio, 1)}`);
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
