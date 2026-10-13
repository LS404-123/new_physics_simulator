(function () {
  'use strict';
  const M = GasLaws;
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const bounds = { left: 66, right: 630, top: 42, bottom: 344 };
  let mode = 'boyle', reciprocal = false, celsius = false;
  let state = M.solve(mode, M.modes[mode].initial), spec;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reducedMotion.matches;
  let motion, graphMotion, extensionAnimation, plot, pendingMode, previous, frame;
  const format = (value, digits = 1) => String(Number(value.toFixed(digits)));
  const particles = Array.from({ length: 24 }, (_, i) => {
    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('r', 3.5); $('particles').append(circle);
    return { circle, x: ((i * 37) % 97) / 100, y: ((i * 53) % 89) / 100,
      vx: Math.cos(i * 2.4), vy: Math.sin(i * 2.4) };
  });
  function math(element, latex) {
    if (window.katex) katex.render(latex, element, { throwOnError: false });
    else element.textContent = latex;
  }
  document.querySelectorAll('[data-math]').forEach(el => math(el, el.dataset.math));
  function setAttrs(el, values) {
    for (const [name, value] of Object.entries(values)) el.setAttribute(name, value);
  }
  function sceneElement(parent, tag, attributes, text) {
    const el = document.createElementNS(NS, tag); setAttrs(el, attributes);
    if (text !== undefined) el.textContent = text;
    $(parent).append(el);
  }
  for (let i = 0; i <= 40; i++) {
    const angle = (-135 + i * 6.75) * Math.PI / 180;
    const major = i % 10 === 0, inner = major ? 50 : 54;
    sceneElement('bourdonTicks', 'line', { x1: 84 + Math.sin(angle) * inner, y1: 94 - Math.cos(angle) * inner,
      x2: 84 + Math.sin(angle) * 58, y2: 94 - Math.cos(angle) * 58, stroke: '#536d7a', 'stroke-width': major ? 1.5 : 1 });
    if (major) sceneElement('bourdonTicks', 'text', { x: 84 + Math.sin(angle) * 40, y: 98 - Math.cos(angle) * 40,
      'text-anchor': 'middle', style: 'font-size:11px' }, i * 10);
  }
  for (let i = 0; i <= 25; i++) {
    const angle = (-135 + i * 10.8) * Math.PI / 180, major = i % 5 === 0;
    sceneElement('thermalGaugeTicks', 'line', { x1: 322 + Math.sin(angle) * (major ? 31 : 34), y1: 138 - Math.cos(angle) * (major ? 31 : 34),
      x2: 322 + Math.sin(angle) * 38, y2: 138 - Math.cos(angle) * 38, stroke: '#536d7a' });
    if (major) sceneElement('thermalGaugeTicks', 'text', { x: 322 + Math.sin(angle) * 25, y: 141 - Math.cos(angle) * 25,
      'text-anchor': 'middle', style: 'font-size:8px' }, i * 10);
  }
  for (let v = 1; v <= 20; v++) {
    const x = 150 + 6 * v;
    sceneElement('syringeTicks', 'line', { x1: x, x2: x, y1: 173, y2: v % 5 ? 177 : 182, stroke: '#536d7a' });
    if (v % 5 === 0) sceneElement('syringeTicks', 'text', { x, y: 169, 'text-anchor': 'middle', style: 'font-size:10px' }, v);
  }
  function enter(element, shift = 8) {
    element.getAnimations().forEach(animation => animation.cancel());
    if (reducedMotion.matches) return;
    element.animate([{ opacity: .25, transform: `translateY(${shift}px)` }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 240, easing: 'cubic-bezier(.23,1,.32,1)' });
  }
  function X(x) { return bounds.left + (x - spec.xMin) / (spec.xMax - spec.xMin) * (bounds.right - bounds.left); }
  function Y(y) { return bounds.bottom - y / spec.yMax * (bounds.bottom - bounds.top); }
  function path(points) { return points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '); }
  function screenPoint(p) { return { x: X(p.x), y: Y(p.y) }; }
  function gridElement(tag, attributes, text) {
    const el = document.createElementNS(NS, tag); setAttrs(el, attributes);
    if (text !== undefined) el.textContent = text;
    $('grid').append(el);
  }
  function drawGraph(morph = true) {
    extensionAnimation?.cancel();
    $('extrapolation').removeAttribute('mask');
    graphMotion = morph && plot && !reducedMotion.matches ? { from: plot, start: performance.now() } : undefined;
    spec = M.graphSpec(mode, reciprocal, celsius);
    $('grid').replaceChildren();
    for (const x of spec.xTicks) {
      gridElement('line', { 'data-x-tick': '', y1: bounds.top, y2: bounds.bottom, stroke: '#e1eaee' });
      gridElement('text', { 'data-x-label': '', y: 365, 'text-anchor': 'middle' }, mode !== 'boyle' && !celsius && x < 0 ? '' : x);
    }
    for (const y of spec.yTicks) {
      gridElement('line', { 'data-y-tick': '', x1: bounds.left, x2: bounds.right, stroke: '#e1eaee' });
      gridElement('text', { 'data-y-label': '', x: 54, 'text-anchor': 'end' }, y);
    }
    $('intercept').toggleAttribute('hidden', mode === 'boyle');
    $('interceptLabel').textContent = celsius ? '−273.15 °C' : '0 K';
    $('boyleOptions').hidden = mode !== 'boyle';
    $('temperatureOptions').hidden = mode === 'boyle';
    for (const [id, pressed] of [['volumeGraph', !reciprocal], ['reciprocalGraph', reciprocal], ['kelvinGraph', !celsius], ['celsiusGraph', celsius]]) {
      $(id).setAttribute('aria-pressed', pressed);
    }
    $('chartTitle').textContent = mode === 'boyle' ? reciprocal ? '壓強—體積倒數圖' : '壓強—體積圖'
      : mode === 'charles' ? '體積—溫度圖' : '壓強—溫度圖';
    $('xTitle').textContent = mode === 'boyle' ? reciprocal ? '1/V / mL⁻¹' : 'V / mL' : celsius ? 'θ / °C' : 'T / K';
    $('yTitle').textContent = mode === 'charles' ? 'V / mL' : 'p / kPa';
    math($('formula'), mode === 'boyle' ? 'p\\propto\\frac{1}{V}' : mode === 'charles' ? 'V\\propto T' : 'p\\propto T');
    math($('invariant'), mode === 'boyle' ? `pV=${(M.NR * 300).toFixed(0)}\\;\\mathrm{kPa\\cdot mL}`
      : mode === 'charles' ? 'V/T=\\frac{1}{15}\\;\\mathrm{mL/K}' : 'p/T=\\frac{1}{3}\\;\\mathrm{kPa/K}');
    ensureFrame();
  }
  function renderGraph(now = performance.now()) {
    const curve = M.curve(mode, spec).map(screenPoint);
    const zero = screenPoint({ x: mode === 'boyle' || !celsius ? 0 : -273.15, y: 0 });
    const target = { curve, zero: [zero],
      origin: [{ x: X(0), y: bounds.bottom }],
      extension: mode === 'boyle' ? (reciprocal ? [curve.at(-1), zero] : [curve.at(-1), curve.at(-1)]) : [zero, curve[0]],
      xTicks: spec.xTicks.map(x => ({ x: X(x), y: 0 })), yTicks: spec.yTicks.map(y => ({ x: 0, y: Y(y) })) };
    const progress = graphMotion ? (now - graphMotion.start) / 520 : 1;
    // 只變換圖表座標，氣體狀態仍由同一模型計算。
    plot = graphMotion ? Object.fromEntries(Object.entries(target).map(([key, points]) =>
      [key, M.morphPoints(graphMotion.from[key], points, progress)])) : target;
    const completedMorph = Boolean(graphMotion) && progress >= 1;
    if (progress >= 1) graphMotion = undefined;
    $('curve').setAttribute('d', path(plot.curve));
    $('extrapolation').setAttribute('d', path(plot.extension));
    $('extrapolation').toggleAttribute('hidden', mode === 'boyle' && (!reciprocal || Boolean(graphMotion)));
    if (completedMorph && mode === 'boyle' && reciprocal && !reducedMotion.matches) {
      const reveal = $('extensionReveal');
      reveal.setAttribute('d', path(plot.extension));
      const length = reveal.getTotalLength();
      setAttrs(reveal, { 'stroke-dasharray': length, 'stroke-dashoffset': 0 });
      $('extrapolation').setAttribute('mask', 'url(#extensionMask)');
      extensionAnimation = reveal.animate([{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
        { duration: 450, easing: 'cubic-bezier(.23,1,.32,1)' });
    }
    $('axes').setAttribute('d', `M${bounds.left},${bounds.bottom}H${bounds.right} M${plot.origin[0].x},${bounds.bottom}V${bounds.top}`);
    document.querySelectorAll('[data-x-tick]').forEach((el, i) => setAttrs(el, { x1: plot.xTicks[i].x, x2: plot.xTicks[i].x }));
    document.querySelectorAll('[data-x-label]').forEach((el, i) => el.setAttribute('x', plot.xTicks[i].x));
    document.querySelectorAll('[data-y-tick]').forEach((el, i) => setAttrs(el, { y1: plot.yTicks[i].y, y2: plot.yTicks[i].y }));
    document.querySelectorAll('[data-y-label]').forEach((el, i) => setAttrs(el, { x: plot.origin[0].x - 12, y: plot.yTicks[i].y + 4 }));
    $('yTitle').setAttribute('x', plot.origin[0].x);
    setAttrs($('interceptPoint'), { cx: plot.zero[0].x, cy: plot.zero[0].y });
    setAttrs($('interceptLabel'), { x: plot.zero[0].x + 8, y: plot.zero[0].y - 12 });
    const p = M.point(state, spec);
    let position = screenPoint(p);
    if (graphMotion) {
      // 同一個氣體狀態沿變形中的曲線移動，拖動滑桿也不會脫離圖線。
      const { min, max } = M.modes[mode];
      const index = ((mode === 'boyle' ? state.V : state.T) - min) / (max - min) * 100;
      const low = Math.floor(index), high = Math.min(100, low + 1), fraction = index - low;
      position = { x: plot.curve[low].x + (plot.curve[high].x - plot.curve[low].x) * fraction,
        y: plot.curve[low].y + (plot.curve[high].y - plot.curve[low].y) * fraction };
    }
    const { x, y } = position;
    setAttrs($('currentPoint'), { cx: x, cy: y });
    setAttrs($('guideX'), { x1: x, x2: x, y1: y, y2: bounds.bottom });
    setAttrs($('guideY'), { x1: bounds.left, x2: x, y1: y, y2: y });
    setAttrs($('pointLabel'), { x: x + (x > 500 ? -10 : 10), y: y + ((mode !== 'boyle' || reciprocal) && x <= 500 ? 22 : -13),
      'text-anchor': x > 500 ? 'end' : 'start' });
    $('pointLabel').textContent = `(${format(p.x, mode === 'boyle' && reciprocal ? 3 : 1)}, ${format(p.y)})`;
  }
  function renderParticles(dt = 0) {
    const syringe = mode === 'boyle';
    const width = syringe ? 6 * state.V - 8 : 166;
    const height = syringe ? 26 : 4.2 * state.V - 8;
    for (const p of particles) {
      if (!paused) {
        p.x += p.vx * dt * 55 * state.speed / width;
        p.y += p.vy * dt * 55 * state.speed / height;
        if (p.x < 0 || p.x > 1) { p.x = Math.max(0, Math.min(1, p.x)); p.vx *= -1; }
        if (p.y < 0 || p.y > 1) { p.y = Math.max(0, Math.min(1, p.y)); p.vy *= -1; }
      }
      setAttrs(p.circle, { r: syringe ? 2 : 3.5, cx: (syringe ? 154 : 93) + p.x * width,
        cy: (syringe ? 184 : 250 - 4.2 * state.V + 4) + p.y * height });
    }
  }
  function render() {
    $('pValue').textContent = format(state.p);
    $('vValue').textContent = format(state.V);
    $('tValue').textContent = format(state.T, 0);
    for (const [id, label, fixed] of [['pLabel', '壓強', mode === 'charles'], ['vLabel', '體積', mode === 'pressure'], ['tLabel', '溫度', mode === 'boyle']]) {
      $(id).textContent = label + (fixed ? '・固定' : '');
      $(id).parentElement.classList.toggle('fixed', fixed);
    }
    $('secondaryReading').textContent = mode === 'boyle' ? '' : `${format(state.celsius)} °C`;
    $('fixedCondition').textContent = mode === 'boyle' ? '300 K' : mode === 'charles' ? '100 kPa' : '20 mL';
    $('apparatusTitle').textContent = mode === 'boyle' ? '針筒與氣壓計' : mode === 'charles' ? '自由活塞' : '固定容器';
    const top = 250 - 4.2 * state.V;
    setAttrs($('gasFill'), { y: top, height: 4.2 * state.V });
    $('pistonHead').setAttribute('y', top - 12);
    $('externalPressure').setAttribute('transform', `translate(0 ${top - 12})`);
    $('externalPressure').toggleAttribute('hidden', mode !== 'charles');
    $('bolts').toggleAttribute('hidden', mode !== 'pressure');
    $('bath').setAttribute('fill', mode === 'boyle' ? '#c6e7ee' : state.T > 300 ? '#e9c2ae' : '#c6e7ee');
    $('gaugeNeedle').setAttribute('transform', `rotate(${-135 + state.p / 250 * 270} 322 138)`);
    $('syringeGas').setAttribute('width', 6 * state.V - 1);
    $('syringePiston').setAttribute('transform', `translate(${150 + 6 * state.V} 0)`);
    $('bourdonNeedle').setAttribute('transform', `rotate(${-135 + state.p / 400 * 270} 84 94)`);
    renderGraph();
    const description = `${M.modes[mode].name}。壓強 ${format(state.p)} kPa，體積 ${format(state.V)} mL，溫度 ${format(state.T, 0)} K。`;
    $('sceneDescription').textContent = description;
    $('chartDescription').textContent = `${$('chartTitle').textContent}。${description}`;
    renderParticles();
  }
  function selectMode(next) {
    motion = undefined;
    mode = next;
    const config = M.modes[mode];
    setAttrs($('input'), { min: config.min, max: config.max, step: config.step });
    $('input').value = config.initial;
    state = M.solve(mode, config.initial);
    $('sliderLabel').textContent = mode === 'boyle' ? '調整體積' : '調整溫度';
    const unit = mode === 'boyle' ? 'mL' : 'K';
    $('minValue').textContent = `${config.min} ${unit}`; $('maxValue').textContent = `${config.max} ${unit}`;
    document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', button.dataset.mode === mode));
    $('boyleApparatus').toggleAttribute('hidden', mode !== 'boyle');
    $('thermalApparatus').toggleAttribute('hidden', mode === 'boyle');
    $('referenceButton').hidden = mode !== 'boyle';
    drawGraph(false); render(); updateInputLabel();
  }
  async function changeMode(next) {
    if (next === mode && pendingMode === undefined) return;
    pendingMode = next;
    const chart = $('chart').parentElement;
    chart.getAnimations().forEach(animation => animation.cancel());
    if (!reducedMotion.matches) {
      try {
        await chart.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 100, fill: 'forwards' }).finished;
      } catch { return; }
    }
    selectMode(next); pendingMode = undefined;
    chart.getAnimations().forEach(animation => animation.cancel());
    if (!reducedMotion.matches) chart.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
    enter($('scene'));
  }
  function updateInputLabel() {
    const value = Number($('input').value);
    $('input').setAttribute('aria-valuetext', mode === 'boyle' ? `${format(value)} 毫升` : `${value} K，${format(value - 273.15)} 攝氏度`);
  }
  function moveToInput() {
    const to = Number($('input').value);
    updateInputLabel();
    if (reducedMotion.matches) { motion = undefined; state = M.solve(mode, to); render(); }
    else { motion = { from: mode === 'boyle' ? state.V : state.T, to, start: performance.now() }; ensureFrame(); }
  }
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
    changeMode(button.dataset.mode);
  }));
  $('input').addEventListener('input', moveToInput);
  $('reset').addEventListener('click', () => { $('input').value = M.modes[mode].initial; moveToInput(); });
  for (const [id, value] of [['volumeGraph', false], ['reciprocalGraph', true]]) {
    $(id).addEventListener('click', () => { if (reciprocal === value) return; reciprocal = value; drawGraph(); render(); });
  }
  for (const [id, value] of [['kelvinGraph', false], ['celsiusGraph', true]]) {
    $(id).addEventListener('click', () => { if (celsius === value) return; celsius = value; drawGraph(); render(); });
  }
  function updatePause() {
    $('pause').textContent = paused ? '播放粒子' : '暫停粒子';
    $('pause').setAttribute('aria-pressed', paused);
  }
  function ensureFrame() {
    if (frame === undefined && !document.hidden && (!paused || motion || graphMotion)) frame = requestAnimationFrame(animate);
  }
  function animate(now) {
    frame = undefined;
    if (motion) {
      const progress = (now - motion.start) / 280;
      state = M.transitionState(mode, motion.from, motion.to, progress);
      if (progress >= 1) motion = undefined;
      render();
    } else if (graphMotion) renderGraph(now);
    renderParticles(previous === undefined ? 0 : Math.min((now - previous) / 1000, 0.04));
    previous = now;
    ensureFrame();
  }
  $('pause').addEventListener('click', () => {
    paused = !paused; updatePause(); previous = undefined;
    ensureFrame();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = undefined; previous = undefined; }
    else ensureFrame();
  });
  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches) return;
    paused = true; motion = undefined; graphMotion = undefined; state = M.solve(mode, Number($('input').value));
    document.getAnimations().forEach(animation => animation.cancel());
    if (pendingMode !== undefined) { selectMode(pendingMode); pendingMode = undefined; }
    updatePause(); render();
  });
  $('referenceButton').addEventListener('click', () => $('referenceDialog').showModal());
  $('closeReference').addEventListener('click', () => $('referenceDialog').close());
  selectMode(mode); updatePause();
  ensureFrame();
})();
