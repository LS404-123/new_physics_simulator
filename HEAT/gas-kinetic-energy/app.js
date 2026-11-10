(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const { create, createMixedBox, countedSquares, setControls, readings, advance, defaults, impactWindow } = GasEnergy;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let freeBox = create(), mixedBox, state = freeBox, returnHash = "#mean-square";
  let studyPaused = motion.matches;
  let paused = motion.matches, frame = 0, lastTime = null;
  $("chamber").innerHTML = chamberArt.svg;
  function svgNode(name, attrs) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  }
  const drawWall = createWallView(svgNode);
  const bars = Array.from({ length: 16 }, (_, i) => svgNode("rect", { x: 29 + 17 * i, width: 15 }));
  $("speed-bars").append(...bars);
  let plottedCounts, lastThermalReadout = -1;
  function drawDistribution(force = false) {
    const t = state.thermal;
    if (plottedCounts !== t.counts) {
      plottedCounts = t.counts;
      const top = Math.max(state.particles.length / 2, 2 * Math.ceil(Math.max(...t.counts, ...t.expected) / 2));
      const y = count => 145 - 110 * count / top;
      bars.forEach((bar, i) => {
        bar.setAttribute("y", y(t.counts[i]));
        bar.setAttribute("height", 145 - y(t.counts[i]));
      });
      $("chart-max").textContent = top;
      $("chart-mid").textContent = top / 2;
      $("equilibrium-line").setAttribute("d", t.expected.map((count, i) => (i ? "L" : "M") + (36.5 + i * 17) + " " + y(count)).join(" "));
      $("sampling-note").textContent = (t.samples.length ? "柱高為最近 " + t.samples.length + " 次全箱取樣的平均粒子數。" : "柱高為開始時的粒子數。")
        + "虛線為 Maxwell–Boltzmann 平衡分佈。";
      $("chart-description").textContent = "全箱 " + state.particles.length + " 粒，每欄 80 m/s，最後一欄為 1200 m/s 或以上。各欄粒子數：" + t.counts.map(n => n.toFixed(1)).join("、");
    }
    if (force || state.time - lastThermalReadout >= 0.25) {
      lastThermalReadout = state.time;
      $("collision-count").textContent = t.collisions;
      $("thermal-square").textContent = Math.round(readings(state).meanSquare).toLocaleString("en-GB");
      const pressure = ThermalGas.wallPressure(state);
      $("wall-pressure").textContent = pressure === null ? "—" : (pressure / 1000).toFixed(2);
    }
  }
  // 氣箱和粒子的投影共用 Anatomy 產生的三個基向量。
  const [u, v, w] = chamberArt.basis;
  function project(p) {
    const side = state.width;
    return chamberArt.origin.map((value, i) => value + (p.x * u[i] + p.y * v[i] + p.z * w[i]) / side);
  }
  const dots = state.pool.map(() => svgNode("circle", { r: 4.1, fill: "url(#atom)", stroke: "#ffd99b", "stroke-width": ".45" }));
  const defs = $("chamber").querySelector("defs");
  const wallClip = svgNode("clipPath", { id: "wall-clip" });
  wallClip.append(svgNode("rect", { width: 1, height: 1 }));
  const ripple = svgNode("g", { id: "ripple" });
  ripple.append(svgNode("circle", { r: 1, class: "ripple-edge" }), svgNode("circle", { r: 1, class: "ripple-ring" }),
    svgNode("circle", { r: 0.28, class: "ripple-core" }));
  defs.append(wallClip, ripple);
  const backHits = svgNode("g", {});
  $("particles").before(backHits);
  const basis = { x: u, y: v, z: w };
  const faces = {};
  for (const [axis, a, b] of [["x", "y", "z"], ["y", "x", "z"], ["z", "x", "y"]]) {
    faces[axis] = {};
    for (const side of [-1, 1]) {
      const origin = project({ x: 0, y: 0, z: 0, [axis]: side === 1 ? state.width : 0 });
      const wall = svgNode("g", { transform: "matrix(" + [...basis[a], ...basis[b], ...origin].join(" ") + ")",
        "clip-path": "url(#wall-clip)", "data-face": axis + (side === 1 ? "+" : "−") });
      (side === 1 ? $("impacts") : backHits).append(wall);
      faces[axis][side] = { wall, a, b };
    }
  }
  // 碰撞點用所屬壁面的局部座標繪畫，光圈到達邊框就截斷。
  const activeHits = new Map();
  function drawImpacts() {
    const recent = new Set(state.hits.filter(hit => state.time - hit.time < impactWindow));
    for (const [hit, node] of activeHits) {
      if (!recent.has(hit)) { node.remove(); activeHits.delete(hit); }
    }
    for (const hit of recent) {
      const { wall, a, b } = faces[hit.axis][hit.side];
      let node = activeHits.get(hit);
      if (!node) {
        node = svgNode("use", { href: "#ripple" });
        wall.append(node);
        activeHits.set(hit, node);
      }
      const age = (state.time - hit.time) / impactWindow;
      const x = hit[a] / state.width, y = hit[b] / state.width;
      node.setAttribute("transform", "translate(" + x + " " + y + ") scale(" + (0.025 + 0.068 * age) + ")");
      node.setAttribute("opacity", Math.min(1, 2 * (1 - age)));
    }
    const count = String(recent.size);
    if ($("hit-count").textContent !== count) $("hit-count").textContent = count;
  }
  function drawParticles() {
    if (state.thermal) { drawWall(state, state.particles.length); drawDistribution(); return; }
    if (state.speedGroups) { drawWall(state, Number($("included").value)); return; }
    const layer = $("particles");
    const order = state.particles.map((p, i) => {
      const [x, y] = project(p);
      dots[i].setAttribute("cx", x.toFixed(2));
      dots[i].setAttribute("cy", y.toFixed(2));
      return { node: dots[i], depth: (p.x + p.y) * Math.sqrt(3 / 8) + p.z / 2 };
    }).sort((a, b) => a.depth - b.depth);
    let cursor = layer.firstChild;
    for (const { node } of order) {
      if (node !== cursor) layer.insertBefore(node, cursor);
      cursor = node.nextSibling;
    }
    while (cursor) { const next = cursor.nextSibling; cursor.remove(); cursor = next; }
    drawImpacts();
  }
  const formulas = {
    macro: String.raw`\htmlClass{term pressure}{p}\htmlClass{term volume}{V}`,
    micro: String.raw`\tfrac13\,\htmlClass{term count}{N}\htmlClass{term mass}{m}\,\htmlClass{term meanSquare}{\overline{c^2}}`
  };
  for (const [id, tex] of Object.entries(formulas)) {
    katex.render(tex, $(id), { trust: context => context.command === "\\htmlClass", strict: "ignore" });
  }
  function showFreeReadings(data, previous) {
    $("speed-out").textContent = state.speed.toFixed(2) + " ×";
    $("count-out").textContent = data.count + " 粒";
    for (const id of ["speed", "count"]) {
      const input = $(id);
      input.setAttribute("aria-valuetext", id === "speed" ? "初始速率的 " + state.speed.toFixed(2) + " 倍" : data.count + " 粒");
      input.style.setProperty("--pct", (input.value - input.min) / (input.max - input.min) * 100 + "%");
    }
    $("mean-square").textContent = (data.meanSquare / 1e6).toFixed(2);
    $("pressure").textContent = (data.pressure / 1000).toFixed(1);
    if (previous) {
      const numberChanged = data.count !== previous.count;
      const up = data.pressure > previous.pressure;
      const direction = up ? "增加" : "減少";
      $("feedback").textContent = numberChanged
        ? "分子數目" + direction + "，速率分布相同。平均壓強" + direction + "。"
        : "分子速率" + (up ? "上升" : "下降") + "，速率平方的平均值及壓強都" + direction + "。";
    } else $("feedback").textContent = "速率不變，增加粒子會怎樣影響撞壁？";
  }
  function showCountedParticles(data) {
    const slider = $("included"), count = Number(slider.value);
    const { groups, sum, meanSquare } = countedSquares(state, count);
    const number = n => Math.round(n).toLocaleString("en-GB");
    $("scene-title").textContent = "B 箱 · 24 粒氦原子";
    $("atom-label").textContent = groups[1].speed + " m/s";
    $("slow-key").hidden = false;
    $("slow-label").textContent = groups[0].speed + " m/s";
    $("included-out").textContent = count + " / " + data.count;
    slider.setAttribute("aria-valuetext", "全箱 " + data.count + " 粒中已計入 " + count + " 粒");
    slider.style.setProperty("--pct", 100 * count / data.count + "%");
    groups.forEach((g, i) => {
      const id = i === 0 ? "slow" : "fast";
      $(id + "-speed").textContent = g.speed;
      $(id + "-included").textContent = g.included + " / " + g.count;
      $(id + "-sum").textContent = number(g.sum);
    });
    if (meanSquare === null) {
      $("sample-calculation").textContent = "計入第一粒後即可取平均。";
    } else {
      const numerator = groups.map(g => g.included + "\\times " + g.speed + "^2").join("+");
      const sign = Math.abs(meanSquare - Math.round(meanSquare)) < 1e-6 ? "=" : "\\approx";
      katex.render("\\dfrac{" + numerator + "}{" + count + "}" + sign + number(meanSquare).replaceAll(",", "\\,")
        + "\\;\\mathrm{m^2/s^2}", $("sample-calculation"));
    }
    $("box-pressure").textContent = (data.pressure / 1000).toFixed(2);
    $("sum-note").textContent = count === data.count
      ? "全部計入後，" + data.count + " × " + number(meanSquare) + " = " + number(sum) + "，剛好等於逐粒相加的平方總和。快粒子佔這個總和的 " + Math.round(100 * groups[1].sum / sum) + "%。"
      : "還有 " + (data.count - count) + " 粒未計入。拖動滑桿，看看它們怎樣改變平均值。";
  }
  function render(previous = null) {
    const data = readings(state);
    if (state.thermal) {
      $("scene-title").textContent = "粒子互撞 · " + data.count + " 粒氦原子";
      $("atom-label").textContent = "氦原子";
      $("slow-key").hidden = true;
      drawDistribution(true);
    } else if (state.speedGroups) showCountedParticles(data);
    else {
      $("scene-title").textContent = "分子觀察室";
      $("atom-label").textContent = "氦原子";
      $("slow-key").hidden = true;
      showFreeReadings(data, previous);
    }
    for (const key of ["pressure", "meanSquare", "count"]) {
      const term = document.querySelector(".term." + key);
      const ratio = previous ? data[key] / previous[key] : 1;
      if (Math.abs(ratio - 1) < 1e-9) term.removeAttribute("data-change");
      else term.dataset.change = ratio > 1 ? "up" : "down";
    }
    drawParticles();
  }
  function startMixedBox() {
    mixedBox = state = createMixedBox();
    $("included").max = $("included").value = state.particles.length;
  }
  function syncMode() {
    const thermal = location.hash === "#thermal";
    const comparing = location.hash === "#mean-square", flat = thermal || comparing;
    if (thermal === Boolean(state.thermal) && comparing === Boolean(state.speedGroups)) return;
    if (thermal) {
      studyPaused = paused;
      state = ThermalGas.create();
      paused = true;
    } else if (state.thermal) paused = studyPaused;
    if (comparing && !mixedBox) startMixedBox();
    else if (comparing) state = mixedBox;
    else if (!thermal) state = freeBox;
    $("thermal-mode").checked = thermal;
    $("compare").hidden = thermal;
    $("distribution").hidden = $("thermal-mean").hidden = !thermal;
    $("compare").setAttribute("aria-expanded", String(comparing));
    $("compare").textContent = comparing ? "返回自由調整" : "逐粒計算平均值";
    $("free-settings").hidden = $("free-readings").hidden = flat;
    $("count-settings").hidden = $("average-step").hidden = $("study-pressure").hidden = !comparing;
    $("count-key").hidden = !comparing;
    $("wall-study").hidden = $("wall-arrow-key").hidden = !flat;
    document.querySelector(".relation .legend").hidden = $("feedback").hidden = flat;
    $("chamber").toggleAttribute("hidden", flat);
    $("all-hits").hidden = $("hit-key").hidden = flat;
    lastTime = null;
    render();
    playback();
  }
  $("compare").addEventListener("click", () => { location.hash = state.speedGroups ? "" : "mean-square"; });
  $("thermal-mode").addEventListener("change", event => {
    if (event.target.checked) { returnHash = location.hash; location.hash = "thermal"; }
    else location.hash = returnHash;
  });
  window.addEventListener("hashchange", syncMode);
  $("included").addEventListener("input", () => render());
  for (const id of ["speed", "count"]) {
    $(id).addEventListener("input", () => {
      const count = Number($("count").value), speed = Number($("speed").value);
      if (count === state.particles.length && speed === state.speed) return;
      const before = readings(state);
      setControls(state, count, speed);
      render(before);
    });
  }
  function tick(time) {
    if (lastTime !== null) {
      const elapsed = time - lastTime;
      if (state.thermal) {
        // 限制慢裝置每幀的工作量；取樣始終按模擬時間進行。
        let dt = Math.min(0.3, elapsed * 0.004);
        while (dt > 0) { const step = Math.min(0.1, dt); ThermalGas.advance(state, step); dt -= step; }
      } else advance(state, Math.min(0.1, elapsed * (state.speedGroups ? 0.00095 : 0.00025)));
    }
    lastTime = time;
    drawParticles();
    frame = requestAnimationFrame(tick);
  }
  function playback() {
    cancelAnimationFrame(frame);
    lastTime = null;
    document.body.classList.toggle("paused", paused);
    $("play-label").textContent = paused ? (state.thermal && !state.time ? "開始碰撞" : "播放") : "暫停";
    $("run-status").textContent = paused ? "已暫停" : "慢鏡播放";
    if (!paused && !document.hidden) frame = requestAnimationFrame(tick);
  }
  $("play").addEventListener("click", () => {
    paused = !paused;
    if (paused && state.thermal) drawDistribution(true);
    playback();
  });
  $("reset").addEventListener("click", () => {
    if (state.thermal) state = ThermalGas.create();
    else if (state.speedGroups) startMixedBox();
    else {
      freeBox = state = create();
      $("speed").value = defaults.speed;
      $("count").value = defaults.count;
    }
    paused = Boolean(state.thermal) || motion.matches;
    render();
    playback();
  });
  motion.addEventListener("change", () => { paused = motion.matches; playback(); });
  document.addEventListener("visibilitychange", playback);
  if (location.hash === "#mean-square" || location.hash === "#thermal") syncMode();
  else render();
  playback();
})();
