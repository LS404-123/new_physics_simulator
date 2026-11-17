(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const steps = {
    a: ["畫出燈內氣流方向", "燃料加熱附近的空氣。觀察圓點怎樣移動，再嘗試畫出方向。", "點火後，空氣往哪裡流？", 1],
    b: ["這是哪一種傳熱？", "(a) 的空氣流動，把能量由燃料附近帶往其他位置。這個過程叫甚麼？", "流動的空氣帶著能量", 1],
    c: ["最低要加熱至多少度？", "整盞燈比外界空氣稀，才可升起。調溫找界線：計算時有沒有包括 80 g 燈身？", "比較浮力與總重量", 4],
    d: ["多少個分子淨流出？", "把空氣由 27°C 加熱至 (c) 的臨界溫度。比較初末分子數，找出它們的差。", "體積不變，空氣份量減少", 3],
    e: ["哪種表面較節省燃料？", "保持溫度相同，切換燈面，比較向外輻射的熱。哪一種能減少熱損失？", "同溫下比較輻射散熱", 1]
  };
  const letters = Object.keys(steps);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let step = "a", state = Lantern.solve(27), running = !reducedMotion.matches;
  let heating = false, showArrows = false, phase = 0, lastTime;
  let weights = Lantern.portions(state);
  const svgNS = "http://www.w3.org/2000/svg";
  $("art-back").innerHTML = lanternArt.back;
  $("art-front").innerHTML = lanternArt.front;
  for (const [id, key] of [["up-flow", "up"], ["left-flow", "left"], ["right-flow", "right"], ["return-flow", "returns"], ["out-left", "outLeft"], ["out-right", "outRight"]]) {
    $(id).setAttribute("d", lanternArt.paths[key]);
  }
  for (const [id, position] of [["hot-label", lanternArt.hot], ["cold-label", lanternArt.cold], ["opening-label", lanternArt.opening]]) {
    $(id).setAttribute("x", position[0]); $(id).setAttribute("y", position[1] + (id === "opening-label" ? 23 : 0));
  }
  $("flame").setAttribute("transform", `translate(${lanternArt.fuel.join(" ")}) scale(.8)`);
  function projectAir(h, z, depth = 40) {
    const world = [(depth + h) / Math.SQRT2, (depth - h) / Math.SQRT2, z];
    return lanternArt.origin.map((n, i) => n + world.reduce((sum, value, j) => sum + value * lanternArt.basis[j][i], 0));
  }
  function circle(parent, fill, radius) {
    const dot = document.createElementNS(svgNS, "circle");
    dot.setAttribute("r", radius);
    dot.setAttribute("fill", fill);
    parent.append(dot);
    return dot;
  }
  const dots = Array.from({ length: 100 }, () => circle($("air-dots"), "#247b9d", 3));
  const escaped = Array.from({ length: 100 }, () => circle($("escaped-dots"), "#a95530", 2.5));
  const rays = Array.from({ length: 8 }, (_, i) => {
    const line = document.createElementNS(svgNS, "path");
    const left = i < 4, x = left ? 180 : 430, y = 150 + (i % 4) * 48, sign = left ? -1 : 1;
    line.setAttribute("d", `M${x} ${y}q${sign * 10} -10 ${sign * 20} 0t${sign * 20} 0t${sign * 20} 0`);
    $("radiation-rays").append(line);
    return line;
  });
  document.querySelectorAll("[data-math]").forEach(node => {
    katex.render(node.dataset.math, node, { throwOnError: false, output: "htmlAndMathml" });
  });

  const scientific = value => `${(value / 1e24).toFixed(2)} × 10<sup>24</sup> <small>個</small>`;
  function text(id, value) {
    if ($(id).textContent !== value) $(id).textContent = value;
  }
  const wave = n => 1 - Math.abs(((n % 2) + 2) % 2 - 1);
  function paint() {
    const flow = Math.min(1, (state.celsius - 27) / 35);
    const microscopic = step === "d";
    const lift = ["c", "d"].includes(step) ? Math.min(62, Math.max(0, state.netForce) * 130) : 0;
    $("lamp").setAttribute("transform", `translate(0 ${-lift})`);
    for (let i = 0; i < 100; i++) {
      const t = phase + i * 2.39996, sign = i % 2 ? 1 : -1;
      const initialH = -55 + (i % 10) * 12 + 1.5 * Math.sin(i * 4);
      const initialZ = 58 + Math.floor(i / 10) * 18 + 1.5 * Math.cos(i * 3);
      const h = microscopic ? -55 + 110 * wave(i * 0.618 + phase * 0.21)
        : initialH * (1 - flow) + sign * (26 + 26 * Math.cos(t)) * flow;
      const z = microscopic ? 58 + 166 * wave(i * 0.414 + phase * 0.29)
        : initialZ * (1 - flow) + (143 - 79 * Math.sin(t)) * flow;
      const [x, y] = projectAir(h, z);
      dots[i].setAttribute("cx", x);
      dots[i].setAttribute("cy", y);
      dots[i].setAttribute("opacity", weights[i]);
      dots[i].setAttribute("fill", !microscopic && flow > 0 && Math.cos(t) < -0.2 ? "#a95530" : "#247b9d");
      const outside = projectAir(-60 + (i % 10) * 13, 7 - (Math.floor((99 - i) / 10) % 4) * 7);
      escaped[i].setAttribute("cx", outside[0]);
      escaped[i].setAttribute("cy", outside[1]);
      escaped[i].setAttribute("opacity", microscopic ? 1 - weights[i] : 0);
    }
    const arrows = (showArrows && step === "a") || step === "b";
    $("flow-arrows").style.display = arrows && flow > 0 ? "" : "none";
    $("flow-labels").style.display = arrows && flow > 0 ? "" : "none";
    $("forces").style.display = step === "c" ? "" : "none";
    $("outflow").style.display = microscopic && state.celsius > 27 ? "" : "none";
    $("opening-label").style.display = microscopic ? "none" : "";
    $("flame").style.display = state.celsius > 27 || heating ? "" : "none";
    $("radiation-rays").style.display = step === "e" ? "" : "none";
    const rayStrength = state.radiation / Lantern.solve(Lantern.MAX, "dark").radiation;
    rays.forEach((ray, i) => ray.setAttribute("opacity", state.celsius === 27 ? 0 : Math.min(1, 0.15 + rayStrength) * (running ? 0.75 + 0.25 * Math.sin(phase * 2 + i) : 1)));
  }

  function render() {
    weights = Lantern.portions(state);
    const precision = state.status === "neutral" ? 2 : 1;
    $("temperature").value = state.celsius;
    $("temperature").setAttribute("aria-valuetext", `${state.celsius.toFixed(precision)} 攝氏度，${state.temperature.toFixed(precision)} K`);
    $("temperature-out").innerHTML = `${state.celsius.toFixed(precision)}°C <small>${state.temperature.toFixed(precision)} K</small>`;
    $("temperature-out").setAttribute("aria-live", "off");
    $("scene").dataset.surface = state.surface;
    text("flight-state", { rest: "尚未升起", neutral: "臨界：合力為零", rise: "可向上升起" }[state.status]);
    $("flight-state").dataset.status = state.status;
    text("buoyancy-label", `${state.buoyancy.toFixed(2)} N`);
    text("weight-label", `${state.weight.toFixed(2)} N`);
    $("buoyancy-arrow").setAttribute("d", `M453 235V${235 - state.buoyancy * 38}`);
    $("weight-arrow").setAttribute("d", `M453 240V${240 + state.weight * 38}`);
    text("air-mass", `${(state.airMass * 1000).toFixed(1)} g`);
    text("total-mass", `${(state.totalMass * 1000).toFixed(1)} g`);
    text("whole-density", `${state.totalDensity.toFixed(3)} kg/m³`);
    const barWidth = state.airDensity / 1.6 * 300;
    $("air-bar").setAttribute("width", barWidth);
    $("shell-bar").setAttribute("x", 15 + barWidth);
    $("shell-bar").setAttribute("width", Lantern.M / Lantern.V / 1.6 * 300);
    text("density-feedback", state.status === "neutral" ? "浮力等於總重量。再稍為加熱，才可由靜止上升。"
      : state.status === "rise" ? "整盞燈的平均密度低於 1.16 kg/m³，浮力大於總重量。"
      : "仍未達到上升條件；燈身的 80 g 也要計入總質量。");
    $("initial-n").innerHTML = scientific(Lantern.INITIAL_N);
    $("inside-n").innerHTML = scientific(state.molecules);
    $("outside-n").innerHTML = state.outMolecules === 0 ? "0 <small>個</small>" : scientific(state.outMolecules);
    $("retained-bar").style.width = state.fraction * 100 + "%";
    text("retained-label", `保留 ${(state.fraction * 100).toFixed(1)}%；淨流出 ${(100 - state.fraction * 100).toFixed(1)}%。`);
    const reference = Lantern.solve(Lantern.MAX, "dark").radiation;
    $("light-loss").style.width = Lantern.solve(state.celsius, "light").radiation / reference * 100 + "%";
    $("dark-loss").style.width = Lantern.solve(state.celsius, "dark").radiation / reference * 100 + "%";
    text("surface-feedback", state.celsius === 27 ? "目前與外界同溫，沒有淨輻射散熱。先加熱，再比較兩種表面。"
      : state.surface === "light" ? "淺色光亮表面在此模型中較少輻射散熱，需要補回的熱較少。" : "深色暗啞表面在此模型中較多輻射散熱，需要補回的熱較多。");
    const captions = {
      a: state.celsius === 27 ? "前方剖開供觀察，並非實際開孔。先加熱觀察氣流。" : "中央受熱上升，較冷空氣沿兩旁回流。",
      b: "整體氣流攜帶能量；讀數使用燈內平均溫度。",
      c: "升降位置只表示能否升起，並非飛行軌跡。",
      d: "100 點代表初始空氣的等份量；下方橙點為淨流出份量。",
      e: "波線表示輻射散熱；兩種表面以相同溫度比較。"
    };
    text("scene-caption", captions[step]);
    text("motion", running ? "暫停動畫" : "播放動畫");
    $("motion").setAttribute("aria-pressed", String(running));
    text("heat", heating ? "停止加熱" : "逐步加熱");
    $("heat").setAttribute("aria-pressed", String(heating));
    text("scene-description", `${steps[step][2]}。燈內 ${state.celsius.toFixed(1)} 攝氏度，總密度 ${state.totalDensity.toFixed(3)} kg/m³。${captions[step]}`);
    paint();
  }

  function selectStep(next) {
    if (!steps[next]) return;
    step = next;
    const index = letters.indexOf(step);
    document.querySelectorAll("[data-step]").forEach(button => {
      if (button.dataset.step === step) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
    for (const letter of letters) $("part-" + letter).hidden = letter !== step;
    text("part-number", `(${step})`);
    text("part-title", steps[step][0]);
    text("question-prompt", steps[step][1]);
    text("scene-title", steps[step][2]);
    text("marks", steps[step][3] + " 分");
    text("part-position", `${index + 1} / 5`);
    $("previous").disabled = index === 0;
    $("next").disabled = index === 4;
    render();
  }
  function setTemperature(value) {
    state = Lantern.solve(value, state.surface);
    render();
  }
  document.querySelectorAll("[data-step]").forEach(button => button.addEventListener("click", () => selectStep(button.dataset.step)));
  $("previous").addEventListener("click", () => selectStep(letters[letters.indexOf(step) - 1]));
  $("next").addEventListener("click", () => selectStep(letters[letters.indexOf(step) + 1]));
  $("temperature").addEventListener("input", event => { heating = false; setTemperature(Number(event.target.value)); });
  $("heat").addEventListener("click", () => {
    heating = !heating;
    if (heating) running = true;
    render();
  });
  $("motion").addEventListener("click", () => { running = !running; if (!running) heating = false; render(); });
  $("arrows").addEventListener("click", () => {
    showArrows = !showArrows;
    $("arrows").setAttribute("aria-pressed", String(showArrows));
    text("arrows", showArrows ? "隱藏氣流方向" : "顯示氣流方向");
    $("flow-explanation").hidden = !showArrows;
    paint();
  });
  document.querySelectorAll("[data-transfer]").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll("[data-transfer]").forEach(b => b.setAttribute("aria-pressed", String(b === button)));
    text("transfer-feedback", {
      convection: "對。這是對流：空氣整體流動，把能量帶往其他位置。",
      conduction: "傳導主要靠相鄰粒子傳遞能量。這裡觀察到空氣整體流動，應是對流。",
      radiation: "燃料也會輻射傳熱，但 (a) 指的是空氣整體流動，這個過程是對流。"
    }[button.dataset.transfer]);
  }));
  document.querySelectorAll(".critical").forEach(button => button.addEventListener("click", () => {
    heating = false;
    setTemperature(Lantern.CRITICAL);
  }));
  document.querySelectorAll(".solution-toggle").forEach(button => button.addEventListener("click", () => {
    const expanded = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(expanded));
    button.textContent = expanded ? "返回觀察" : "查看推算";
    button.parentElement.querySelector(".solution").hidden = !expanded;
    button.parentElement.querySelector(".exploration").hidden = expanded;
  }));
  document.querySelectorAll("[data-surface]").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll("[data-surface]").forEach(b => b.setAttribute("aria-pressed", String(b === button)));
    state = Lantern.solve(state.celsius, button.dataset.surface);
    render();
  }));
  $("reset").addEventListener("click", () => {
    heating = false; running = !reducedMotion.matches; showArrows = false; phase = 0;
    state = Lantern.solve(27);
    $("arrows").setAttribute("aria-pressed", "false");
    text("arrows", "顯示氣流方向");
    $("flow-explanation").hidden = true;
    document.querySelectorAll("[data-transfer]").forEach(b => b.setAttribute("aria-pressed", "false"));
    text("transfer-feedback", "選出由空氣流動帶走能量的傳熱方式。");
    document.querySelectorAll("[data-surface]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.surface === "light")));
    document.querySelectorAll(".solution-toggle").forEach(b => {
      b.setAttribute("aria-expanded", "false"); b.textContent = "查看推算";
      b.parentElement.querySelector(".solution").hidden = true;
      b.parentElement.querySelector(".exploration").hidden = false;
    });
    selectStep("a");
  });
  reducedMotion.addEventListener("change", event => {
    if (event.matches) { running = false; heating = false; render(); }
  });
  function frame(now) {
    const dt = lastTime === undefined ? 0 : Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    if (running && !document.hidden) {
      phase += dt * 1.3 * Math.sqrt(state.temperature / Lantern.T0);
      if (heating) {
        const next = Lantern.heat(state.celsius, dt);
        if (next === Lantern.MAX) heating = false;
        setTemperature(next);
      } else paint();
    }
    requestAnimationFrame(frame);
  }
  selectStep("a");
  requestAnimationFrame(frame);
})();
