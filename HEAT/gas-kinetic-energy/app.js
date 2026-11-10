(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const { create, setControls, readings, advance, defaults, impactWindow } = GasEnergy;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let state = create(), paused = motion.matches, frame = 0, lastTime = null;
  $("chamber").innerHTML = chamberArt.svg;
  function svgNode(name, attrs) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
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
  function render(previous = null) {
    const data = readings(state);
    $("speed-out").textContent = state.speed.toFixed(2) + " ×";
    $("count-out").textContent = data.count + " 粒";
    for (const id of ["speed", "count"]) {
      const input = $(id);
      input.setAttribute("aria-valuetext", id === "speed" ? "初始速率的 " + state.speed.toFixed(2) + " 倍" : data.count + " 粒");
      input.style.setProperty("--pct", (input.value - input.min) / (input.max - input.min) * 100 + "%");
    }
    $("mean-square").textContent = (data.meanSquare / 1e6).toFixed(2);
    $("pressure").textContent = (data.pressure / 1000).toFixed(1);
    for (const key of ["pressure", "meanSquare", "count"]) {
      const term = document.querySelector(".term." + key);
      const ratio = previous ? data[key] / previous[key] : 1;
      if (Math.abs(ratio - 1) < 1e-9) term.removeAttribute("data-change");
      else term.dataset.change = ratio > 1 ? "up" : "down";
    }
    if (previous) {
      const numberChanged = data.count !== previous.count;
      const up = data.pressure > previous.pressure;
      const direction = up ? "增加" : "減少";
      $("feedback").textContent = numberChanged
        ? "分子數目" + direction + "，速率分布相同。平均壓強" + direction + "。"
        : "分子速率" + (up ? "上升" : "下降") + "，速率平方的平均值及壓強都" + direction + "。";
    } else $("feedback").textContent = "速率不變，增加粒子會怎樣影響撞壁？";
    drawParticles();
  }
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
    if (lastTime !== null) advance(state, Math.min(0.1, (time - lastTime) * 0.00025));
    lastTime = time;
    drawParticles();
    frame = requestAnimationFrame(tick);
  }
  function playback() {
    cancelAnimationFrame(frame);
    lastTime = null;
    document.body.classList.toggle("paused", paused);
    $("play-label").textContent = paused ? "播放" : "暫停";
    $("run-status").textContent = paused ? "已暫停" : "慢鏡播放";
    if (!paused && !document.hidden) frame = requestAnimationFrame(tick);
  }
  $("play").addEventListener("click", () => { paused = !paused; playback(); });
  $("reset").addEventListener("click", () => {
    state = create();
    $("speed").value = defaults.speed;
    $("count").value = defaults.count;
    paused = motion.matches;
    render();
    playback();
  });
  motion.addEventListener("change", () => { paused = motion.matches; playback(); });
  document.addEventListener("visibilitychange", playback);
  render();
  playback();
})();
