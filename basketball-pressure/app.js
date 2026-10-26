(() => {
  'use strict';
  const { solve, STROKE_VOLUME, TARGET, MAX_STROKES } = BasketballPressure;
  const { create, advance, BASE_WIDTH } = GasParticles;
  const $ = id => document.getElementById(id);
  const svgNS = 'http://www.w3.org/2000/svg';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let strokes = 0, cycle = 0, running = false, automatic = false;
  let motion = !reducedMotion.matches, frame = 0, lastTime = 0, elapsedMotion = 0;
  let lastCompleted = -1, previousWidth = BASE_WIDTH, state = solve(0);
  const flashes = [];
  const format = n => Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1);
  const particles = Array.from({ length: 50 + MAX_STROKES }, (_, i) => ({
    left: create(i, 'box'), ball: create(i, 'ball'), opacity: 0,
    elements: ['equivalentParticles', 'ballParticles'].map(id => {
      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('r', '3.3');
      circle.setAttribute('fill', i < 50 ? '#247b9d' : '#a95530');
      $(id).append(circle);
      return circle;
    })
  }));

  function drawParticles() {
    for (const p of particles) {
      p.elements[0].setAttribute('cx', 33.3 + p.left.x);
      p.elements[0].setAttribute('cy', 71.3 + p.left.y);
      p.elements[1].setAttribute('cx', 154 + p.ball.x);
      p.elements[1].setAttribute('cy', 148 + p.ball.y);
    }
  }

  function render() {
    state = solve(strokes, cycle);
    const added = state.addedVolume / STROKE_VOLUME;
    const width = 240 * state.gasRatio - 6.6;
    const extraWidth = 240 * (state.gasRatio - 1);
    $('gasBoundary').setAttribute('width', width + 6.6);
    $('addedVolumeFill').setAttribute('width', extraWidth);
    $('addedBracket').setAttribute('d', `M270 239v8h${extraWidth}v-8`);
    $('addedBracket').setAttribute('opacity', extraWidth > 0 ? 1 : 0);
    $('addedLabel').setAttribute('x', 270 + Math.max(extraWidth / 2, 50));
    $('addedLabel').textContent = added > 0 ? `+ ${format(state.addedVolume)} cm³` : '';
    particles.forEach((p, i) => {
      const opacity = i < 50 ? 1 : Math.max(0, Math.min(1, added - (i - 50)));
      // 左圖是當刻的等效狀態；調整位置而不加速粒子，保持恆溫的速率示意。
      p.left.x *= width / previousWidth;
      if (opacity > 0 && p.opacity === 0) {
        p.left = create(i, 'box', width); p.ball = create(i, 'ball');
      }
      p.opacity = opacity;
      p.elements.forEach(circle => circle.setAttribute('opacity', opacity));
    });
    previousWidth = width;
    drawParticles();
    $('equivalentVolume').textContent = format(state.equivalentVolume);
    $('pressure').textContent = format(state.pressure);
    $('count').textContent = state.completed;
    $('piston').setAttribute('transform', `translate(${-120 * state.displacement} 0)`);
    $('pumpGas').setAttribute('width', Math.max(0, 122 - 120 * state.displacement));
    $('flow').setAttribute('opacity', state.valveOpen ? 1 : 0);
    $('pumpLabel').textContent = cycle === 0 ? '吸入 120 cm³' : `氣筒：${format(state.pumpVolume)} cm³`;
    $('phaseLabel').textContent = !running ? (cycle > 0 ? '打氣已暫停' : '準備推進')
      : cycle >= 0.7 ? '抽回吸氣 · 止回閥關閉' : state.valveOpen ? '推進 · 空氣進入籃球' : '先壓縮氣筒內空氣';
    $('push').disabled = running || strokes >= MAX_STROKES;
    $('push').lastChild.textContent = cycle > 0 && !running ? '繼續這一推' : '推活塞一次';
    $('auto').textContent = running ? '暫停打氣' : '連續打氣';
    $('auto').setAttribute('aria-pressed', String(running));
    $('auto').disabled = !running && (state.reached || strokes >= MAX_STROKES);
    $('motion').textContent = motion ? '暫停粒子' : '播放粒子';
    $('motion').setAttribute('aria-pressed', String(motion));
    if (state.completed !== lastCompleted) {
      const points = Array.from({ length: state.completed + 1 }, (_, n) => [45 + 17.625 * n, 146 - 1.5 * (solve(n).pressure - 100)]);
      $('recordLine').setAttribute('d', points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(''));
      $('recordPoints').replaceChildren(...points.map(([x, y]) => {
        const dot = document.createElementNS(svgNS, 'circle');
        dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('r', 2.6);
        return dot;
      }));
      lastCompleted = state.completed;
    }
    $('feedback').setAttribute('aria-live', running ? 'off' : 'polite');
    $('feedback').innerHTML = state.reached
      ? `<strong>${Math.abs(state.pressure - TARGET) < 1e-7 ? '剛好達標' : '已超過目標'} · ${format(state.pressure)} kPa</strong><span>加入 ${format(state.addedVolume)} cm³ 大氣壓空氣</span>`
      : `距離目標 <strong>${format(TARGET - state.pressure)} kPa</strong><span>連續打氣會在達標時停止</span>`;
    $('equivalentDesc').textContent = `同溫下粒子運動，100 kPa 等效體積 ${format(state.equivalentVolume)} 立方厘米，粒子疏密不變。`;
    $('ballDesc').textContent = `籃球保持 6000 立方厘米，壓強 ${format(state.pressure)} kPa；加入更多同速率粒子，壁面撞擊更頻密。`;
  }

  function showHits(hits, shape, opacity) {
    for (const hit of hits) {
      const mark = document.createElementNS(svgNS, 'circle');
      mark.setAttribute('cx', (shape === 'ball' ? 154 : 33.3) + hit.x + hit.nx * 3.3);
      mark.setAttribute('cy', (shape === 'ball' ? 148 : 71.3) + hit.y + hit.ny * 3.3);
      mark.setAttribute('r', '6'); mark.setAttribute('fill', 'none');
      mark.setAttribute('stroke', '#a95530'); mark.setAttribute('stroke-width', '2.5');
      $(shape === 'ball' ? 'ballHits' : 'equivalentHits').append(mark);
      flashes.push({ mark, born: elapsedMotion, opacity });
    }
  }

  function queueFrame() {
    if (!frame && (running || motion) && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function tick(time) {
    frame = 0;
    const dt = lastTime ? Math.min(time - lastTime, 50) / 1000 : 0;
    lastTime = time;
    if (running) {
      cycle += dt / (reducedMotion.matches ? 0.65 : 1.05);
      if (cycle >= 1) {
        strokes++; cycle = 0;
        if (!automatic || solve(strokes).reached || strokes >= MAX_STROKES) running = automatic = false;
      }
      // 減少動態效果時，僅在每一完整推進後更新幾何位置。
      if (!reducedMotion.matches || cycle === 0) render();
    }
    if (motion) {
      elapsedMotion += dt;
      for (const p of particles) if (p.opacity > 0) {
        showHits(advance(p.left, 'box', dt, previousWidth), 'box', p.opacity);
        showHits(advance(p.ball, 'ball', dt), 'ball', p.opacity);
      }
      for (let i = flashes.length - 1; i >= 0; i--) {
        const age = (elapsedMotion - flashes[i].born) / 0.45;
        if (age >= 1) { flashes[i].mark.remove(); flashes.splice(i, 1); }
        else flashes[i].mark.setAttribute('opacity', (1 - age) * flashes[i].opacity);
      }
      drawParticles();
    }
    queueFrame();
  }

  function start(continuous) {
    if (running || strokes >= MAX_STROKES) return;
    if (reducedMotion.matches && !continuous) { strokes++; cycle = 0; render(); return; }
    automatic = continuous; running = true; lastTime = 0;
    render(); queueFrame();
  }

  $('push').addEventListener('click', () => start(false));
  $('auto').addEventListener('click', () => {
    if (running) { running = automatic = false; render(); }
    else start(true);
  });
  $('motion').addEventListener('click', () => { motion = !motion; lastTime = 0; render(); queueFrame(); });
  $('reset').addEventListener('click', () => {
    strokes = cycle = 0; running = automatic = false; lastTime = 0;
    particles.forEach((p, i) => { p.left = create(i, 'box'); p.ball = create(i, 'ball'); p.opacity = 0; });
    previousWidth = BASE_WIDTH;
    flashes.forEach(f => f.mark.remove()); flashes.length = 0;
    render(); queueFrame();
  });
  reducedMotion.addEventListener('change', () => { motion = !reducedMotion.matches; render(); queueFrame(); });
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(frame); frame = 0; lastTime = 0; queueFrame();
  });
  render(); queueFrame();
})();
