(function () {
  'use strict';
  const M = window.MoleModel;
  const $ = id => document.getElementById(id);
  const canvas = $('gas');
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const state = { step: 0, atoms: 6, dozens: 1, moles: 1, arranged: false, paused: reduced.matches, particles: [] };
  const lessons = [
    { title: '先數清楚：有多少粒？', intro: '加入一粒氦原子，看看總數怎樣變。原子一直在動，試試把它們排好。', evidence: '每加入一粒，總數加一', text: '這裏數的是氦原子。每一粒都算一次，不論它在哪裏、怎樣移動。', next: '試試一批一批數' },
    { title: '換一種數法：每打 12 粒', intro: '每 12 粒是一打。加入一打，觀察總數；也可切換分組計數。', evidence: '每一批的數量固定', text: '「打」是計數單位。2 打就是 2 批，每批 12 粒，共 24 粒。', next: '把一批換成 1 mol' },
    { title: '很大的一批，叫做 1 mol', intro: '氣體的原子數極大。科學上用摩爾（mol）表示物質的量，按固定的粒子數計算。', evidence: '1 mol 的定義', text: '1 mol 氦氣，恰好含有這麼多粒氦原子。這是單位的定義，數值是精確的。', next: '改變 mol 數看看' },
    { title: 'mol 數加倍，粒子數呢？', intro: '拖動滑桿，比較 1 至 5 mol。', evidence: '用 mol 數出總粒子數', text: 'mol 數是幾倍，總粒子數就是幾倍。', next: '回到逐粒數' }
  ];
  let current, frame, lastTime, width = 1, height = 1;

  function math(element, latex) {
    if (window.katex) window.katex.render(latex, element, { throwOnError: false });
    else element.textContent = latex;
  }

  function syncParticles() {
    while (state.particles.length < current.dots) {
      const i = state.particles.length;
      const angle = (i * 2.3999632297 + 0.7);
      state.particles.push({ x: (i * .61803398875 + .19) % 1, y: (i * .41421356237 + .37) % 1, vx: Math.cos(angle) * .085, vy: Math.sin(angle) * .085 });
    }
    state.particles.length = current.dots;
  }

  function render() {
    current = M.snapshot(state.step, state.atoms, state.dozens, state.moles);
    syncParticles();
    const lesson = lessons[state.step];
    document.querySelectorAll('.steps [data-step]').forEach(button => {
      const active = Number(button.dataset.step) === state.step;
      button.setAttribute('aria-pressed', String(active));
      if (active) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    $('lesson-title').textContent = lesson.title;
    $('intro').textContent = lesson.intro;
    $('evidence-title').textContent = lesson.evidence;
    $('evidence-text').textContent = lesson.text;
    $('next').textContent = lesson.next;
    $('previous').disabled = state.step === 0;
    $('small-controls').hidden = state.step > 1;
    $('definition').hidden = state.step !== 2;
    $('mole-controls').hidden = state.step !== 3;
    $('graph').toggleAttribute('hidden', state.step !== 3);
    document.querySelector('.lesson').dataset.step = state.step;
    const smallValue = state.step === 0 ? state.atoms : state.dozens;
    $('small-amount').textContent = `${smallValue} ${state.step === 0 ? '粒' : '打'}`;
    $('remove').textContent = state.step === 0 ? '減少 1 粒' : '減少 1 打';
    $('add').textContent = state.step === 0 ? '加入 1 粒' : '加入 1 打';
    $('remove').disabled = smallValue === 1;
    $('add').disabled = smallValue === (state.step === 0 ? 24 : 2);
    $('control-caption').textContent = state.step === 0 ? '可放入 1 至 24 粒原子。' : '每打 12 粒；可放入 1 打或 2 打。';
    $('moles').value = state.moles;
    $('moles').setAttribute('aria-valuetext', `${current.moles} mol`);
    $('mole-amount').textContent = `${current.moles} mol`;
    math($('n-symbol'), 'n');
    math($('definition-count'), `${M.scientific(M.AVOGADRO)}\\text{ 粒}`);
    math($('count'), M.scientific(current.count));
    $('amount').textContent = current.schematic ? `${current.moles} mol` : state.step === 1 ? `${state.dozens} 打` : '';
    $('full-count').textContent = current.schematic ? current.count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' 粒原子' : '改變數法，不會改變每粒原子的身分。';
    const equation = state.step === 0 ? `N = ${current.count}` : state.step === 1 ? `N = ${state.dozens} \\times 12 = ${current.count}` : state.step === 2 ? 'N_{\\mathrm A} = 6.02214076 \\times 10^{23}\\;\\mathrm{mol}^{-1}' : 'N = n N_{\\mathrm A}';
    math($('equation'), equation);
    $('equation').style.fontSize = state.step === 2 ? '17px' : '';
    $('legend').classList.toggle('schematic', current.schematic);
    if (current.schematic) math($('legend-text'), `\\text{1 個空心點代表 }${M.scientific(current.atomsPerDot)}\\text{ 粒}`);
    else $('legend-text').textContent = '1 個實心點 = 1 粒氦原子';
    $('representation-note').textContent = current.schematic ? `畫面有 ${current.dots} 個示意點，並非逐粒畫出原子。` : '原子放大顯示；畫面中的點數就是總粒子數。';
    $('view-label').textContent = current.schematic ? '大量粒子示意 · 已改變表示比例' : '逐粒表示';
    $('scene-note').textContent = state.arranged ? (current.groups ? '虛線框只用來分組計數，不表示氣體聚成一團。' : '排好只為方便計數，不是原子的實際排列。') : current.schematic ? '每個空心點代表大量原子，不是一粒原子。' : '每個實心點是一粒氦原子。';
    $('arrange').textContent = state.arranged ? '返回氣體運動' : state.step === 0 ? '排好數一數' : current.schematic ? '按 mol 分組' : '按打分組';
    $('arrange').setAttribute('aria-pressed', String(state.arranged));
    $('pause').textContent = state.paused ? '播放運動' : '暫停運動';
    $('pause').setAttribute('aria-pressed', String(state.paused));
    $('pause').disabled = state.arranged;
    const groupDescription = current.groups ? `${current.groups} 個框，每框 ${current.schematic ? '1 mol，以 100 個空心點代表大量原子' : '1 打，共 12 粒原子'}。` : '目前排好計數。';
    canvas.setAttribute('aria-label', `氦氣：${current.count} 粒原子。${current.schematic ? `${current.dots} 個空心點按比例代表大量原子。` : '每個實心點代表一粒原子。'}${state.arranged ? groupDescription : '目前為氣體運動視圖。'}`);
    const graphX = n => 45 + 235 * n / 5;
    const graphY = count => 140 - 116 * Number(count) / Number(5n * M.AVOGADRO);
    const x = graphX(current.moles), y = graphY(current.count);
    $('graph-line').setAttribute('d', `M45 140L${graphX(5)} ${graphY(M.snapshot(3, 6, 1, 5).count)}`);
    $('graph-guide').setAttribute('d', `M45 ${y}H${x}V140`);
    $('graph-point').setAttribute('cx', x);
    $('graph-point').setAttribute('cy', y);
    $('graph-title').textContent = `${current.moles} mol 氦氣有 ${current.count} 粒原子；總粒子數與 mol 數成正比。`;
    draw();
    schedule();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    if (width < 1 || height < 1) return;
    if (state.arranged && current.groups) { drawGroups();return; }
    const pad = current.schematic ? 18 : 26;
    const usableW = width - 2 * pad, usableH = height - 2 * pad - 26;
    const columns = current.schematic ? 20 : 6;
    const rows = Math.ceil(current.dots / columns);
    const cellW = usableW / columns, cellH = Math.min(usableH / Math.max(rows, 3), 55);
    const top = pad + (usableH - cellH * rows) / 2;
    const radius = current.schematic ? Math.max(2.5, Math.min(4, cellW * .22)) : Math.max(4, Math.min(8, cellW * .28));
    state.particles.forEach((p, i) => {
      const x = state.arranged ? pad + (i % columns + .5) * cellW : pad + p.x * usableW;
      const y = state.arranged ? top + (Math.floor(i / columns) + .5) * cellH : pad + p.y * usableH;
      drawParticle(x, y, radius);
      if (state.arranged && state.step === 0) {
        ctx.fillStyle = '#bcd5df';ctx.font = '11px "Segoe UI",sans-serif';ctx.textAlign = 'center';ctx.fillText(String(i + 1), x, y + radius + 15);
      }
    });
  }

  function drawParticle(x, y, radius) {
    ctx.beginPath();ctx.arc(x, y, radius, 0, Math.PI * 2);
    if (current.schematic) { ctx.strokeStyle = '#b9e8e7';ctx.lineWidth = 1.5;ctx.stroke(); }
    else { ctx.fillStyle = '#b9e8e7';ctx.fill(); }
  }

  function drawGroups() {
    const gap = 18;
    const groupColumns = Math.min(current.groups, 3);
    const groupRows = Math.ceil(current.groups / groupColumns);
    const slots = Math.max(2, groupColumns);
    const boxW = Math.min(260, (width - 48 - (slots - 1) * gap) / slots);
    const boxH = Math.min(276, (height - 70 - (groupRows - 1) * gap) / groupRows);
    if (boxW <= 36 || boxH <= 64) return;
    const top = (height - 30 - groupRows * boxH - (groupRows - 1) * gap) / 2;
    const columns = current.schematic ? 10 : 4;
    const rows = current.dotsPerGroup / columns;
    const cellW = (boxW - 36) / columns, cellH = (boxH - 64) / rows;
    const radius = Math.min(current.schematic ? 4 : 8, cellW * .28, cellH * .28);
    for (let group = 0; group < current.groups; group++) {
      const row = Math.floor(group / groupColumns);
      const groupsInRow = Math.min(groupColumns, current.groups - row * groupColumns);
      const left = (width - groupsInRow * boxW - (groupsInRow - 1) * gap) / 2;
      const x = left + (group % groupColumns) * (boxW + gap);
      const y = top + row * (boxH + gap);
      ctx.strokeStyle = '#8cabb6';ctx.lineWidth = 1.2;ctx.setLineDash([5, 5]);
      ctx.strokeRect(x, y, boxW, boxH);ctx.setLineDash([]);
      ctx.textAlign = 'center';ctx.fillStyle = '#f3fbfb';ctx.font = '600 18px "Segoe UI","Microsoft JhengHei",sans-serif';
      ctx.fillText(current.schematic ? '1 mol' : '1 打', x + boxW / 2, y + 23);
      ctx.fillStyle = '#bcd5df';ctx.font = '12px "Segoe UI","Microsoft JhengHei",sans-serif';
      ctx.fillText(current.schematic ? '100 個示意點' : '12 粒原子', x + boxW / 2, y + 41);
      for (let i = 0; i < current.dotsPerGroup; i++) {
        drawParticle(x + 18 + (i % columns + .5) * cellW, y + 52 + (Math.floor(i / columns) + .5) * cellH, radius);
      }
    }
  }

  function schedule() {
    const moving = !state.paused && !state.arranged && !document.hidden;
    if (moving && frame === undefined) frame = requestAnimationFrame(animate);
    if (!moving) { cancelAnimationFrame(frame);frame = undefined;lastTime = undefined; }
  }
  function animate(time) {
    frame = undefined;
    M.advance(state.particles, lastTime === undefined ? 0 : Math.min((time - lastTime) / 1000, .05));
    lastTime = time;draw();schedule();
  }

  function changeStep(step) { state.step = step;state.arranged = false;lastTime = undefined;render(); }
  document.querySelectorAll('.steps [data-step]').forEach(button => button.addEventListener('click', () => changeStep(Number(button.dataset.step))));
  $('previous').addEventListener('click', () => changeStep(state.step - 1));
  $('next').addEventListener('click', () => changeStep((state.step + 1) % 4));
  for (const [id, delta] of [['add', 1], ['remove', -1]]) $(id).addEventListener('click', () => { if (state.step === 0) state.atoms += delta;else state.dozens += delta;render(); });
  $('moles').addEventListener('input', event => { state.moles = Number(event.target.value);render(); });
  $('arrange').addEventListener('click', () => { state.arranged = !state.arranged;render(); });
  $('pause').addEventListener('click', () => { state.paused = !state.paused;render(); });
  $('reset').addEventListener('click', () => { Object.assign(state, { step: 0, atoms: 6, dozens: 1, moles: 1, arranged: false, paused: reduced.matches, particles: [] });lastTime = undefined;render(); });
  reduced.addEventListener('change', event => { if (event.matches) { state.paused = true;render(); } });
  document.addEventListener('visibilitychange', () => { lastTime = undefined;schedule(); });
  new ResizeObserver(() => {
    const bounds = canvas.getBoundingClientRect();width = bounds.width;height = bounds.height;
    const dpr = window.devicePixelRatio || 1;canvas.width = Math.round(width * dpr);canvas.height = Math.round(height * dpr);ctx.setTransform(dpr, 0, 0, dpr, 0, 0);draw();
  }).observe(canvas);
  render();
})();
