(() => {
  'use strict';
  const { create, at, CONTACT_SECONDS, ALUMINIUM_SPECIFIC, TEA_SPECIFIC, LEMON_SPECIFIC, WATER_SPECIFIC, ICE_SPECIFIC, FUSION_LATENT } = ThermalEquilibrium;
  const $ = id => document.getElementById(id);
  const fields = ['initialA', 'massA', 'initialB', 'massB'];
  const defaults = Object.fromEntries(fields.map(id => [id, $(id).value]));
  const state = { config: null, time: 0, started: false, running: false, previous: null };
  let frame = 0;
  let axisMinimum = 0;
  const x = (side, fraction) => side === 'A' ? 64 + 303 * fraction : 670 - 303 * fraction;
  const y = temperature => 530 - 465 * (temperature - axisMinimum) / (100 - axisMinimum);
  const temperatureColor = t => 'rgb(' + (145 + t) + ',' + (194 - .45 * t) + ',' + (230 - .95 * t) + ')';

  function configure(keepEquilibrium = false) {
    cancelAnimationFrame(frame);
    const different = $('materialMode').value === 'different';
    const ice = $('materialMode').value.startsWith('ice-');
    const initialA = Number($('initialA').value);
    $('initialA').min = ice ? -40 : 0;
    $('initialA').max = ice ? 0 : 100;
    $('initialA').value = ice ? Math.min(0, initialA) : Math.max(0, initialA);
    axisMinimum = Math.min(0, Number($('initialA').value));
    $('scenarioRow').hidden = !ice;
    state.config = create({ ...Object.fromEntries(fields.map(id => [id, Number($(id).value)])),
      ice, specificA: ice ? WATER_SPECIFIC : different ? TEA_SPECIFIC : ALUMINIUM_SPECIFIC,
      specificB: ice ? WATER_SPECIFIC : different ? LEMON_SPECIFIC : ALUMINIUM_SPECIFIC });
    Object.assign(state, { time: keepEquilibrium ? state.config.duration : 0,
      started: keepEquilibrium, running: false, previous: null });
    for (const id of fields) {
      const value = Number($(id).value), mass = id.startsWith('mass');
      const text = (mass ? value.toFixed(2) : value) + (mass ? ' kg' : ' °C');
      $(id + 'Value').textContent = text;
      $(id).setAttribute('aria-valuetext', text);
    }
    for (const side of ['A', 'B']) {
      const name = ice ? (side === 'A' ? '冰／融水' : $('materialMode').value === 'ice-tea' ? '茶' : '水') :
        different ? (side === 'A' ? '茶' : '檸檬') : '鋁塊';
      $('control' + side).textContent = name + ' ' + side;
      $('legend' + side).textContent = side + (different || ice ? ' ' + name : '');
      $('sceneName' + side).textContent = ice ? name + ' ' + side : side;
      $('block' + side).toggleAttribute('hidden', different || ice);
      $('blockLabel' + side).toggleAttribute('hidden', different || ice);
      $('capacityBar' + side).style.width = 100 * state.config['capacity' + side] /
        (Number($('mass' + side).max) * (ice ? WATER_SPECIFIC : different ? TEA_SPECIFIC : ALUMINIUM_SPECIFIC)) + '%';
    }
    $('tea').toggleAttribute('hidden', !different && !ice);
    $('lemon').toggleAttribute('hidden', !different);
    $('iceInLiquid').toggleAttribute('hidden', !ice);
    $('flowLabel').setAttribute('y', ice ? 250 : 103);
    const waterColor = $('materialMode').value === 'ice-water';
    $('tea').querySelector('path[fill="#b17b3c"]').style.fill = waterColor ? '#9dd4ed' : '#b17b3c';
    $('tea').querySelector('ellipse').style.fill = waterColor ? '#b5e5f8' : '#cb9850';
    let grid = '<text class="axis-title" x="24" y="28">溫度 / °C</text>' +
      '<path d="M64 65V530H670" fill="none" stroke="#9cacb8"/>' +
      '<text x="64" y="559">吸熱 →</text><text x="670" y="559" text-anchor="end">← 放熱</text>' +
      '<text class="axis-title" x="367" y="590" text-anchor="middle">熱量</text>';
    const ticks = [axisMinimum];
    for (let temperature = Math.ceil(axisMinimum / 20) * 20; temperature <= 100; temperature += 20) {
      if (temperature !== axisMinimum) ticks.push(temperature);
    }
    for (const temperature of ticks) {
      grid += '<line x1="64" y1="' + y(temperature) + '" x2="670" y2="' + y(temperature) + '" stroke="#e4ebf0"/><text x="48" y="' + (y(temperature) + 4) + '" text-anchor="end">' + temperature + '</text>';
    }
    $('grid').innerHTML = grid;
    for (const key of ['y1', 'y2']) $('zeroAxis').setAttribute(key, y(0));
    render();
  }

  function render() {
    const config = state.config, sample = at(config, state.time);
    const done = state.started && state.time >= config.duration;
    const contacting = state.started && sample.contactFraction < 1;
    const transferredKJ = Math.abs(sample.energyA) / 1000;
    const totalIce = sample.remainingIce + sample.frozenMass;
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
      if (!config.ice) $(side === 'A' ? 'tea' : 'lemon').setAttribute('transform', 'translate(' + (left + width / 2) + ' 230) scale(' + width / 100 + ' ' + height / 90 + ')');
      const start = 'M' + x(side, 0) + ',' + y(config['initial' + side]);
      let kink = '';
      let plateau = '';
      if (config.ice && config.equilibriumEnergy > 0) {
        const breaks = side === 'A' ? [config.warmingEnergy, config.warmingEnergy + config.meltingEnergy] :
          [config.coolingEnergy, config.coolingEnergy + config.massB * FUSION_LATENT];
        const phaseStart = breaks[0] / config.equilibriumEnergy;
        const phaseEnd = Math.min(fraction, breaks[1] / config.equilibriumEnergy);
        if (phaseEnd > phaseStart) {
          plateau = 'M' + x(side, phaseStart) + ',' + y(0) + 'L' + x(side, phaseEnd) + ',' + y(0);
        }
        for (const energy of breaks) {
          const progress = energy / config.equilibriumEnergy;
          if (progress > 0 && progress < fraction) {
            const boundary = at(config, CONTACT_SECONDS + config.transferDuration * progress);
            kink += 'L' + x(side, progress) + ',' + y(boundary['temperature' + side]);
          }
        }
      }
      $('curve' + side).setAttribute('d', config.equilibriumEnergy === 0 ? '' : start + kink + 'L' + x(side, fraction) + ',' + y(temperature));
      $('phaseCurve' + side).setAttribute('d', plateau);
      $('point' + side).setAttribute('cx', x(side, fraction));
      $('point' + side).setAttribute('cy', y(temperature));
      for (const key of ['y1', 'y2']) $('initialGuide' + side).setAttribute(key, y(config['initial' + side]));
      $('initialGuideLabel' + side).setAttribute('y', y(config['initial' + side]) + (side === 'A' ? 18 : -10));
    }
    if (config.ice) {
      $('tea').setAttribute('transform', 'translate(180 230) scale(1.5)');
      $('iceSolid').toggleAttribute('hidden', totalIce < 1e-10);
      const scale = Math.min(1.1, .9 * Math.cbrt(totalIce));
      const drop = sample.contactFraction * sample.contactFraction;
      $('iceInLiquid').setAttribute('transform', 'translate(180 ' + (80 + 69 * drop) + ')');
      $('iceSolid').setAttribute('transform', 'scale(' + scale + ')');
      const phase = sample.frozenMass > 1e-9 ? '液體結冰 ' + sample.frozenMass.toFixed(3) + ' kg' :
        sample.temperatureA < -1e-9 ? '冰低於 0°C，尚未融化' : sample.remainingIce > 1e-9 ? '剩餘冰 ' + sample.remainingIce.toFixed(3) + ' kg' :
        sample.temperatureA > 1e-9 ? '冰全溶，融水升溫' : '冰啱啱全溶，融水仍為 0°C';
      $('phaseLabel').textContent = phase;
      $('phaseLabel').setAttribute('aria-label', phase + '；總冰量 ' + totalIce.toFixed(3) + ' kg；已融冰 ' + sample.meltedMass.toFixed(3) + ' kg');
    } else $('phaseLabel').textContent = '';
    for (const key of ['y1', 'y2']) $('equilibriumGuide').setAttribute(key, equilibriumY);
    $('equilibriumGuide').toggleAttribute('hidden', !done);
    $('meetingPoint').setAttribute('cx', equilibriumX);
    $('meetingPoint').setAttribute('cy', equilibriumY);
    $('meetingPoint').toggleAttribute('hidden', !done);
    $('equilibriumLabel').toggleAttribute('hidden', !done);
    $('equilibriumLabel').setAttribute('x', equilibriumX + 14);
    $('equilibriumLabel').setAttribute('y', Math.max(82, equilibriumY - 16));
    $('equilibriumLabel').textContent = '熱平衡 ' + config.equilibrium.toFixed(1) + ' °C';
    $('chartDescription').textContent = 'A 從左向右吸熱，B 從右向左放熱降溫。已轉移 ' + transferredKJ.toFixed(2) + ' kJ；A 為 ' + sample.temperatureA.toFixed(1) + ' °C，B 為 ' + sample.temperatureB.toFixed(1) + ' °C。' + (config.ice ? $('phaseLabel').textContent + '。' : '') + (done ? '熱平衡溫度為 ' + config.equilibrium.toFixed(1) + ' °C。' : '');
    const flowVisible = state.started && !contacting && !done && config.equilibriumEnergy > 0;
    $('flow').toggleAttribute('hidden', !flowVisible || (config.ice && totalIce < 1e-10));
    const direction = Math.sign(config.difference);
    let flowPath = direction > 0 ? 'M135 184H225M221 180L225 184L221 188' : 'M225 184H135M139 180L135 184L139 188';
    if (config.ice) {
      const scale = Math.min(1.1, .9 * Math.cbrt(totalIce));
      const endX = 180 + 27 * scale + 2, endY = 149 + 12 * scale;
      flowPath = 'M225 196Q230 172 ' + endX + ' ' + endY +
        'M' + (endX + 2) + ' ' + (endY + 8) + 'L' + endX + ' ' + endY + 'L' + (endX + 8) + ' ' + endY;
      const pulse = (sample.transferFraction * 12) % 1, rest = 1 - pulse;
      $('flowDot').setAttribute('cx', rest * rest * 225 + 2 * rest * pulse * 230 + pulse * pulse * endX);
      $('flowDot').setAttribute('cy', rest * rest * 196 + 2 * rest * pulse * 172 + pulse * pulse * endY);
    } else {
      $('flowDot').setAttribute('cx', 180 + direction * (-39 + ((state.time - CONTACT_SECONDS) / 2 % 1) * 78));
      $('flowDot').setAttribute('cy', 184);
    }
    $('flowLine').setAttribute('d', flowPath);
    $('flowLine').setAttribute('stroke', config.ice ? '#b33e24' : '#376f68');
    $('flowHalo').setAttribute('d', flowPath);
    $('flowHalo').toggleAttribute('hidden', !config.ice);
    $('flowDot').setAttribute('r', config.ice ? 3 : 1.5);
    const liquidName = $('materialMode').value === 'ice-tea' ? '茶' : '水';
    $('flowLabel').textContent = !state.started || contacting ? '' : done ? '沒有淨熱流' : config.ice ?
      liquidName + '放熱 → ' + (totalIce > 1e-10 ? '冰吸熱' : '融水吸熱') : direction > 0 ? 'A → B' : 'B → A';
    $('sceneDescription').textContent = (config.ice ? '冰放入同一杯液體，杯內冰量跟隨融化或凝固改變。' : '') + 'A 為 ' + sample.temperatureA.toFixed(1) + ' °C，B 為 ' + sample.temperatureB.toFixed(1) + ' °C。' + ($('flowLabel').textContent ? $('flowLabel').textContent + '。' : '');
    $('status').textContent = !state.started ? config.ice ? '準備放入冰' : '未接觸' : done ? '熱平衡' : !state.running ? '已暫停' : contacting ? config.ice ? '放入冰中' : '靠近中' : '傳熱中';
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
    $('scenario').value = 'free';
    // 固定 A 為冷物體、B 為熱物體；拖曳到另一邊初溫時停止，容許相同初溫。
    if (id === 'initialA') $(id).value = Math.min(Number($(id).value), Number($('initialB').value));
    if (id === 'initialB') $(id).value = Math.max(Number($(id).value), Number($('initialA').value));
    configure(state.started && state.time >= state.config.duration);
  }));
  $('materialMode').addEventListener('change', () => { $('scenario').value = 'free'; configure(); });
  $('scenario').addEventListener('change', () => {
    const boundary = .42 * (FUSION_LATENT - ICE_SPECIFIC * Number($('initialA').value)) / WATER_SPECIFIC;
    const initial = { remaining: 20, boundary, warm: 60 }[$('scenario').value];
    if (initial === undefined) return;
    $('massA').value = .42; $('massB').value = 1; $('initialB').value = initial;
    configure();
  });
  $('speed').addEventListener('input', () => {
    $('speedValue').textContent = $('speed').value + '×';
    $('speed').setAttribute('aria-valuetext', $('speed').value + ' 倍速');
  });
  $('reset').addEventListener('click', () => {
    for (const id of fields) $(id).value = defaults[id];
    $('scenario').value = 'free';
    configure();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.running) {
      cancelAnimationFrame(frame); state.running = false; state.previous = null; render();
    }
  });
  configure();
})();

