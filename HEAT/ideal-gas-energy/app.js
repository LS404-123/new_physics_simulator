(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const SVG = "http://www.w3.org/2000/svg";
  const bridgeColors = ["#dcb0ff", "#7aead7", "#f6bf86", "#a5c2ff", "#f5a9c9", "#b9e58f", "#f2db89", "#90d5fa", "#d5a8f2", "#f49d9d", "#94e6b8", "#c5d1ff", "#ffbea7", "#a0e4ef", "#e3bd8f"];
  let containerSize = Number($("size").value);
  let particles = IdealGasEnergy.createParticles(2, Number($("kinetic").value), containerSize);
  let idealParticles = particles.map(p => ({ ...p }));
  let dragging = false;
  const scenes = [$("real-scene"), $("ideal-scene")];
  const sceneNodes = new Map();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  function element(name, attrs) {
    const node = document.createElementNS(SVG, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  }
  function createScene(svg, state, real) {
    svg.replaceChildren();
    svg.append(element("rect", { x: 7.5, y: 5, width: 455, height: 290, fill: "none", stroke: "#3a5964", "stroke-width": 1, "pointer-events": "none" }));
    const nodes = { particles: [], bridges: [] };
    if (real) {
      const defs = element("defs", {}); svg.append(defs);
      for (const pair of state.pairs) {
        const colorIndex = pair.j * (pair.j - 1) / 2 + pair.i;
        const color = bridgeColors[colorIndex] || `hsl(${(colorIndex * 137.508) % 360} 70% 78%)`;
        const id = `bridge-${pair.i}-${pair.j}`;
        const gradient = element("linearGradient", { id, x1: "0", y1: "0", x2: "0", y2: "1" });
        for (const [offset, tint, opacity] of [["0%", "#ffffff", 0.85], ["25%", color, 0.75], ["70%", color, 0.65], ["100%", color, 0.95]]) gradient.append(element("stop", { offset, "stop-color": tint, "stop-opacity": opacity }));
        defs.append(gradient);
        const path = element("path", { fill: `url(#${id})`, stroke: color, "stroke-width": 1.2, display: "none", "pointer-events": "none" });
        svg.append(path); nodes.bridges.push({ path, visible: false });
      }
    }
    state.particles.forEach((_, i) => {
      const circle = element("circle", { r: 20, fill: real ? "#d7c1f7" : "#92e7dc", stroke: "#ecffff", "stroke-width": 1.5, "pointer-events": "none" });
      const label = element("text", { fill: "#14313a", "text-anchor": "middle", "font-size": 12, "font-weight": "bold", "pointer-events": "none" });
      label.textContent = i + 1;
      const target = element("circle", { r: 24, fill: "transparent", class: "particle", "data-particle": i, tabindex: 0, role: "button", "aria-label": `分子 ${i + 1}，可用方向鍵移動` });
      svg.append(circle); svg.append(label); svg.append(target);
      nodes.particles.push({ circle, label, target });
    });
    sceneNodes.set(svg, nodes);
    return nodes;
  }
  function draw(svg, state, real) {
    let nodes = sceneNodes.get(svg);
    if (!nodes || nodes.particles.length !== state.particles.length) nodes = createScene(svg, state, real);
    const pixelsPerUnit = 50 / containerSize;
    if (nodes.size !== containerSize) {
      for (const { circle, label } of nodes.particles) {
        circle.setAttribute("r", 20 / containerSize);
        circle.setAttribute("stroke-width", 1.5 / containerSize);
        label.setAttribute("font-size", 12 / containerSize);
        label.setAttribute("display", containerSize > 2 ? "none" : "inline");
      }
      for (const { path } of nodes.bridges) path.setAttribute("stroke-width", 1.2 / containerSize);
      nodes.size = containerSize;
    }
    const coords = state.particles.map(p => ({ x: 235 + p.x * pixelsPerUnit, y: 150 + p.y * pixelsPerUnit }));
    if (real) for (let i = 0; i < state.pairs.length; i++) {
      const pair = state.pairs[i], bridge = nodes.bridges[i];
      // 勢能極小時讓示意帶淡出；物理計算仍保留該勢能。
      const strength = Math.max(0, (-pair.potential - 0.005) / 0.995);
      const visible = strength > 0;
      if (visible !== bridge.visible) {
        bridge.path.setAttribute("display", visible ? "inline" : "none");
        bridge.visible = visible;
      }
      if (!visible) continue;
      const a = coords[pair.i], b = coords[pair.j], dx = b.x - a.x, dy = b.y - a.y;
      const len = pair.distance * pixelsPerUnit;
      const baseWidth = 2 + 32 * Math.sqrt(strength);
      const width = baseWidth / containerSize, neck = width * (0.22 + 0.78 * strength);
      const cap = 24 / containerSize * Math.min(1, Math.max(0, (baseWidth - 18) / 7)), k = 0.552285;
      const path = `M 0 ${-width} C ${len / 6} ${-width}, ${len / 3} ${-neck}, ${len / 2} ${-neck} C ${2 * len / 3} ${-neck}, ${5 * len / 6} ${-width}, ${len} ${-width} C ${len + k * cap} ${-width}, ${len + cap} ${-k * width}, ${len + cap} 0 C ${len + cap} ${k * width}, ${len + k * cap} ${width}, ${len} ${width} C ${5 * len / 6} ${width}, ${2 * len / 3} ${neck}, ${len / 2} ${neck} C ${len / 3} ${neck}, ${len / 6} ${width}, 0 ${width} C ${-k * cap} ${width}, ${-cap} ${k * width}, ${-cap} 0 C ${-cap} ${-k * width}, ${-k * cap} ${-width}, 0 ${-width} Z`;
      bridge.path.setAttribute("d", path);
      bridge.path.setAttribute("transform", `translate(${a.x} ${a.y}) rotate(${Math.atan2(dy, dx) * 180 / Math.PI})`);
      bridge.path.setAttribute("opacity", (0.85 * Math.pow(strength, 0.35)).toFixed(3));
    }
    coords.forEach((p, i) => {
      const { circle, label, target } = nodes.particles[i];
      circle.setAttribute("cx", p.x); circle.setAttribute("cy", p.y);
      label.setAttribute("x", p.x); label.setAttribute("y", p.y + 4 / containerSize);
      target.setAttribute("cx", p.x); target.setAttribute("cy", p.y);
      const hit = state.particles[i].flash > 0;
      if (hit !== nodes.particles[i].hit) {
        circle.setAttribute("fill", hit ? "#fff1a8" : real ? "#d7c1f7" : "#92e7dc");
        circle.setAttribute("stroke", hit ? "#ffffff" : "#ecffff");
        nodes.particles[i].hit = hit;
      }
    });
  }
  function update() {
    const state = IdealGasEnergy.snapshot(particles);
    const idealState = IdealGasEnergy.snapshot(idealParticles, false);
    // 固定共同刻度：動能控制上限，加上每對分子最多可釋出的示意勢能。
    const scale = particles.length * Number($("kinetic").max) + state.pairs.length;
    $("real-kinetic").style.width = `${state.kinetic / scale * 100}%`;
    $("ideal-kinetic").style.width = `${idealState.kinetic / scale * 100}%`;
    $("real-potential").style.width = `${-state.potential / scale * 100}%`;
    draw(scenes[0], state, true); draw(scenes[1], idealState, false);
  }
  function updateCount() {
    $("count-out").textContent = `${particles.length} 粒`;
    $("count").setAttribute("aria-valuetext", `${particles.length} 粒`);
    $("pairs").textContent = `${particles.length * (particles.length - 1) / 2} 對相互作用`;
  }
  function resetParticles() {
    const count = 2 ** (Number($("count").value) + 1);
    particles = IdealGasEnergy.createParticles(count, Number($("kinetic").value), containerSize);
    idealParticles = particles.map(p => ({ ...p }));
    updateCount();
    update();
  }
  $("count").addEventListener("input", resetParticles);
  $("size").addEventListener("input", () => {
    containerSize = Number($("size").value);
    $("size-out").textContent = `邊長 ×${containerSize.toFixed(1)}`;
    $("size").setAttribute("aria-valuetext", `容器邊長為原來的 ${containerSize.toFixed(1)} 倍`);
    resetParticles();
  });
  $("kinetic").addEventListener("input", () => { for (const group of [particles, idealParticles]) IdealGasEnergy.setKinetic(group, Number($("kinetic").value)); update(); });
  for (const svg of scenes) {
    let drag = null;
    const group = () => svg === scenes[0] ? particles : idealParticles;
    function position(event) {
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse());
      return { x: (point.x - 235) / 50 * containerSize, y: (point.y - 150) / 50 * containerSize };
    }
    svg.addEventListener("pointerdown", event => {
      let index = event.target.getAttribute("data-particle");
      if (index === null || !event.isPrimary) return;
      event.preventDefault();
      const p = position(event), current = group();
      // 縮小後仍保留觸控範圍；範圍重疊時選擇最近的分子。
      index = current.reduce((nearest, particle, i) => Math.hypot(particle.x - p.x, particle.y - p.y) < Math.hypot(current[nearest].x - p.x, current[nearest].y - p.y) ? i : nearest, Number(index));
      const particle = current[index];
      drag = { index, group: current, id: event.pointerId, dx: particle.x - p.x, dy: particle.y - p.y };
      dragging = true;
      svg.setPointerCapture(event.pointerId);
    });
    svg.addEventListener("pointermove", event => {
      if (!drag || event.pointerId !== drag.id) return;
      if (drag.group !== group()) { drag = null; dragging = false; return; }
      const p = position(event);
      if (IdealGasEnergy.moveParticle(group(), drag.index, p.x + drag.dx, p.y + drag.dy, containerSize)) update();
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) svg.addEventListener(name, event => {
      if (drag && event.pointerId === drag.id) { drag = null; dragging = false; }
    });
    svg.addEventListener("keydown", event => {
      const index = event.target.getAttribute("data-particle");
      const direction = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }[event.key];
      if (index === null || !direction) return;
      event.preventDefault();
      const p = group()[Number(index)];
      if (IdealGasEnergy.moveParticle(group(), Number(index), p.x + direction[0] * containerSize, p.y + direction[1] * containerSize, containerSize)) {
        update();
        svg.querySelector(`[data-particle="${index}"]`).focus();
      }
    });
  }
  updateCount(); update();
  let lastFrame = null;
  function animate(time) {
    requestAnimationFrame(animate);
    if (lastFrame === null) { lastFrame = time; return; }
    const elapsed = (time - lastFrame) / 1000;
    lastFrame = time;
    if (document.hidden || dragging || scenes.some(svg => svg.contains(document.activeElement)) || reducedMotion.matches) return;
    IdealGasEnergy.step(particles, elapsed, true, containerSize);
    IdealGasEnergy.step(idealParticles, elapsed, false, containerSize);
    update();
  }
  requestAnimationFrame(animate);
})();
