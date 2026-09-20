(() => {
  'use strict';
  const { create, at, CONTACT_SECONDS, ALUMINIUM_SPECIFIC, TEA_SPECIFIC, LEMON_SPECIFIC } = ThermalEquilibrium;
  const $ = id => document.getElementById(id);
  const fields = ['initialA', 'massA', 'initialB', 'massB'];
  const defaults = Object.fromEntries(fields.map(id => [id, $(id).value]));
  const state = { config: null, time: 0, started: false, running: false, previous: null };
  let frame = 0;
  const x = (side, fraction) => side === 'A' ? 64 + 303 * fraction : 670 - 303 * fraction;
  const y = temperature => 530 - 4.65 * temperature;
  const temperatureColor = t => 'rgb(' + (145 + t) + ',' + (194 - .45 * t) + ',' + (230 - .95 * t) + ')';

  function configure(keepEquilibrium = false) {
    cancelAnimationFrame(frame);
    const different = $('materialMode').value === 'different';
    state.config = create({ ...Object.fromEntries(fields.map(id => [id, Number($(id).value)])),
      specificA: different ? TEA_SPECIFIC : ALUMINIUM_SPECIFIC,
      specificB: different ? LEMON_SPECIFIC : ALUMINIUM_SPECIFIC });
    Object.assign(state, { time: keepEquilibrium ? state.config.duration : 0,
      started: keepEquilibrium, running: false, previous: null });
    for (const id of fields) {
      const value = Number($(id).value), mass = id.startsWith('mass');
      const text = (mass ? value.toFixed(1) : value) + (mass ? ' kg' : ' °C');
      $(id + 'Value').textContent = text;
      $(id).setAttribute('aria-valuetext', text);
    }
    for (const side of ['A', 'B']) {
      const name = different ? (side === 'A' ? '茶' : '檸檬') : '鋁塊';
      $('control' + side).textContent = name + ' ' + side;
      $('legend' + side).textContent = side + (different ? ' ' + name : '');
      $('block' + side).toggleAttribute('hidden', different);
      $('blockLabel' + side).toggleAttribute('hidden', different);
      $('capacityBar' + side).style.width = 100 * state.config['capacity' + side] /
        (Number($('mass' + side).max) * (different ? TEA_SPECIFIC : ALUMINIUM_SPECIFIC)) + '%';
    }
    $('tea').toggleAttribute('hidden', !different);
    $('lemon').toggleAttribute('hidden', !different);
    let grid = '<text class="axis-title" x="24" y="28">溫度 / °C</text>' +
      '<path d="M64 65V530H670" fill="none" stroke="#9cacb8"/>' +
      '<text x="64" y="559">吸熱 →</text><text x="670" y="559" text-anchor="end">← 放熱</text>' +
      '<text class="axis-title" x="367" y="590" text-anchor="middle">熱量 Q</text>';
    for (let temperature = 0; temperature <= 100; temperature += 20) {
      grid += '<line x1="64" y1="' + y(temperature) + '" x2="670" y2="' + y(temperature) + '" stroke="#e4ebf0"/><text x="48" y="' + (y(temperature) + 4) + '" text-anchor="end">' + temperature + '</text>';
    }
    $('grid').innerHTML = grid;
    render();
  }

  function render() {
    const config = state.config, sample = at(config, state.time);
    const done = state.started && state.time >= config.duration;
    const contacting = state.started && sample.contactFraction < 1;
    const transferredKJ = Math.abs(sample.energyA) / 1000;
    const equilibriumX = 367, equilibriumY = y(config.equilibrium);
    const fraction = config.equilibriumEnergy === 0 ? 1 : state.started ? sample.transferFraction : 0;
    for (const side of ['A', 'B']) {
      const temperature = sample['temperature' + side];
      $('temperature' + side).textContent = temperature.toFixed(1) + ' °C';
      const width = 72 * Math.cbrt(config['mass' + side]);
      const height = 67 * Math.cbrt(config['mass' + side]);
      const contact = sample.contactFraction * sample.contactFraction * (3 - 2 * sample.contactFraction);
      const startLeft = (side === 'A' ? 88 : 272) - width / 2;
      const contactLeft = side === 'A' ? 180 - width : 180;
      const left = startLeft + (contactLeft - startLeft) * contact;
      for (const [key, value] of Object.entries({ x: left, y: 230 - height, width, height, fill: temperatureColor(temperature) })) $('block' + side).setAttribute(key, value);
      $('blockLabel' + side).setAttribute('x', left + width / 2);
      $(side === 'A' ? 'tea' : 'lemon').setAttribute('transform', 'translate(' + (left + width / 2) + ' 230) scale(' + width / 100 + ' ' + height / 90 + ')');
      const start = 'M' + x(side, 0) + ',' + y(config['initial' + side]);
      $('curve' + side).setAttribute('d', config.equilibriumEnergy === 0 ? '' : start + 'L' + x(side, fraction) + ',' + y(temperature));
      $('point' + side).setAttribute('cx', x(side, fraction));
      $('point' + side).setAttribute('cy', y(temperature));
      for (const key of ['y1', 'y2']) $('initialGuide' + side).setAttribute(key, y(config['initial' + side]));
      $('initialGuideLabel' + side).setAttribute('y', y(config['initial' + side]) + (side === 'A' ? 18 : -10));
    }
    for (const key of ['y1', 'y2']) $('equilibriumGuide').setAttribute(key, equilibriumY);
    $('equilibriumGuide').toggleAttribute('hidden', !done);
    $('meetingPoint').setAttribute('cx', equilibriumX);
    $('meetingPoint').setAttribute('cy', equilibriumY);
    $('meetingPoint').toggleAttribute('hidden', !done);
    $('equilibriumLabel').toggleAttribute('hidden', !done);
    $('equilibriumLabel').setAttribute('x', equilibriumX + 14);
    $('equilibriumLabel').setAttribute('y', Math.max(82, equilibriumY - 16));
    $('chartDescription').textContent = '冷物體 A 從左向右吸熱升溫，熱物體 B 從右向左放熱降溫。已轉移 ' + transferredKJ.toFixed(2) + ' kJ；A 為 ' + sample.temperatureA.toFixed(1) + ' °C，B 為 ' + sample.temperatureB.toFixed(1) + ' °C。' + (done ? '熱平衡溫度為 ' + config.equilibrium.toFixed(1) + ' °C。' : '');
    const flowVisible = state.started && !contacting && !done && config.equilibriumEnergy > 0;
    $('flow').toggleAttribute('hidden', !flowVisible);
    const direction = Math.sign(config.difference);
    $('flowLine').setAttribute('d', direction > 0 ? 'M135 184H225M221 180L225 184L221 188' : 'M225 184H135M139 180L135 184L139 188');
    $('flowDot').setAttribute('cx', 180 + direction * (-39 + ((state.time - CONTACT_SECONDS) / 2 % 1) * 78));
    $('flowDot').setAttribute('cy', 184);
    $('flowLabel').textContent = !state.started || contacting ? '' : done ? '沒有淨熱流' : direction > 0 ? 'A → B' : 'B → A';
    $('sceneDescription').textContent = 'A 為 ' + sample.temperatureA.toFixed(1) + ' °C，B 為 ' + sample.temperatureB.toFixed(1) + ' °C。' + ($('flowLabel').textContent ? $('flowLabel').textContent + '。' : '');
    $('status').textContent = !state.started ? '未接觸' : done ? '熱平衡' : !state.running ? '已暫停' : contacting ? '靠近中' : '傳熱中';
    $('play').textContent = done ? '重播' : state.running ? '暫停' : state.started ? '繼續' : '播放';
  }

  function tick(now) {
    if (!state.running) return;
    if (state.previous !== null) state.time = Math.min(state.config.duration,
      state.time + Math.min((now - state.previous) / 1000, .1) * Number($('speed').value));
    state.previous = now;
    if (state.time >= state.config.duration) state.running = false;
    render();
    if (state.running) frame = requestAnimationFrame(tick);
  }

  $('play').addEventListener('click', () => {
    if (state.started && state.time >= state.config.duration) state.time = 0;
    state.started = true;
    state.running = !state.running;
    state.previous = null;
    cancelAnimationFrame(frame);
    render();
    if (state.running) frame = requestAnimationFrame(tick);
  });
  fields.forEach(id => $(id).addEventListener('input', () => {
    // 固定 A 為冷物體、B 為熱物體；拖曳到另一邊初溫時停止，容許相同初溫。
    if (id === 'initialA') $(id).value = Math.min(Number($(id).value), Number($('initialB').value));
    if (id === 'initialB') $(id).value = Math.max(Number($(id).value), Number($('initialA').value));
    configure(state.started && state.time >= state.config.duration);
  }));
  $('materialMode').addEventListener('change', () => configure(state.started && state.time >= state.config.duration));
  $('speed').addEventListener('input', () => {
    $('speedValue').textContent = $('speed').value + '×';
    $('speed').setAttribute('aria-valuetext', $('speed').value + ' 倍速');
  });
  $('reset').addEventListener('click', () => {
    for (const id of fields) $(id).value = defaults[id];
    configure();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.running) {
      cancelAnimationFrame(frame); state.running = false; state.previous = null; render();
    }
  });
  configure();
})();

