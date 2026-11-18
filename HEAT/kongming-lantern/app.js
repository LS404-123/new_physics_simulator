(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const play = $("play");
  const progress = $("progress");
  progress.max = Lantern.FLIGHT_DURATION;
  let flight = Lantern.flight(0);
  let frameId = null;
  let lastFrame = null;

  $("art-back").innerHTML = lanternArt.back;
  $("art-front").innerHTML = lanternArt.front;
  for (const [id, key] of [["up-flow", "up"], ["left-flow", "left"], ["right-flow", "right"], ["return-flow", "returns"], ["out-left", "outLeft"], ["out-right", "outRight"]]) {
    $(id).setAttribute("d", lanternArt.paths[key]);
  }
  $("flame").setAttribute("transform", `translate(${lanternArt.fuel.join(" ")}) scale(.8)`);
  const dots = Array.from({ length: 100 }, () => {
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("r", 2.8);
    $("air-dots").append(dot);
    return dot;
  });

  function projectAir(h, z) {
    const x = (40 + h) / Math.SQRT2, y = (40 - h) / Math.SQRT2;
    return lanternArt.origin.map((origin, i) =>
      origin + x * lanternArt.basis[0][i] + y * lanternArt.basis[1][i] + z * lanternArt.basis[2][i]);
  }

  function paintAir() {
    const flow = Math.min(1, (flight.celsius - Lantern.MIN) / 35);
    const lost = (1 - flight.fraction) * dots.length;
    const earlier = Lantern.flight(Math.max(0, flight.elapsed - 1));
    const recentlyLost = (earlier.fraction - flight.fraction) * dots.length;
    dots.forEach((dot, i) => {
      // 每點約代表初始空氣的百分之一，越過開口後在一秒內散去。
      const departure = lost - (dots.length - i - 0.5);
      if (departure >= recentlyLost) {
        dot.setAttribute("opacity", 0);
        return;
      }
      const t = flight.elapsed * 1.4 + i * 2.39996, sign = i % 2 ? 1 : -1;
      const initialH = -55 + (i % 10) * 12 + 1.5 * Math.sin(i * 4);
      const initialZ = 58 + Math.floor(i / 10) * 18 + 1.5 * Math.cos(i * 3);
      const h = initialH * (1 - flow) + sign * (26 + 26 * Math.cos(t)) * flow;
      const z = initialZ * (1 - flow) + (143 - 79 * Math.sin(t)) * flow;
      const approach = Math.min(1, Math.max(0, 1 + departure / 4));
      const exit = departure > 0 ? departure / recentlyLost : 0;
      const [x, y] = projectAir(h * (1 - approach) + sign * (42 + 28 * exit) * approach,
        z * (1 - approach) + 31 * approach - 34 * exit);
      dot.setAttribute("cx", x);
      dot.setAttribute("cy", y);
      dot.setAttribute("opacity", 1 - exit);
      dot.setAttribute("fill", exit > 0 || (flow > 0 && Math.cos(t) < -0.2) ? "#a95530" : "#247b9d");
    });
  }

  const narration = [
    ["燃料加熱燈內空氣", "火焰附近的空氣受熱膨脹，密度下降，沿中央上升。較冷的空氣沿兩旁下沉，形成對流。"],
    ["部分空氣從底部流出", "燈罩的體積固定，底部與外界相通。空氣受熱膨脹時，部分空氣由開口流出，燈內壓強維持接近大氣壓。"],
    ["整盞燈逐漸變輕", "流出的空氣帶走了質量，整盞燈的總重量隨之下降。燈排開的外界空氣體積相同，浮力維持不變。"],
    ["浮力超過總重量", "繼續加熱，更多空氣流出。向上的浮力剛超過整盞燈的總重量，燈從靜止開始上升。"],
    ["孔明燈向上加速", "留意燈底與虛線之間的距離。整盞燈比同體積的外界空氣輕，向上的浮力大於總重量。"]
  ];
  const beforeIgnition = [$("moment").textContent, $("explanation").textContent];
  const balanced = ["兩力相等，燈仍在原位", "燈內空氣減至 210 g，加上燈身連燃料共 290 g，剛好等於所排開外界空氣的質量。此刻合力為零，燈仍然靜止。"];
  function text(id, value) {
    const node = $(id);
    if (node.textContent !== value) node.textContent = value;
  }
  function render() {
    const lit = flight.elapsed > 0 || frameId !== null;
    const note = !lit ? beforeIgnition : flight.status === "neutral" ? balanced : narration[flight.stage];
    text("moment", note[0]);
    text("explanation", note[1]);
    text("temperature", flight.celsius.toFixed(flight.status === "neutral" ? 2 : 1) + " °C");
    text("air-mass", (flight.airMass * 1000).toFixed(1) + " g");
    text("total-mass", (flight.totalMass * 1000).toFixed(1) + " g");
    text("buoyancy-label", flight.buoyancy.toFixed(2) + " N");
    text("weight-label", flight.weight.toFixed(2) + " N");
    text("force-comparison", `浮力 ${$("buoyancy-label").textContent}，總重量 ${$("weight-label").textContent}。${note[0]}。`);
    $("buoyancy-arrow").setAttribute("d", `M427 233v${-flight.buoyancy * 38}`);
    $("weight-arrow").setAttribute("d", `M427 239v${flight.weight * 38}`);
    $("lamp").setAttribute("transform", `translate(0 ${-flight.lift})`);
    $("flow-arrows").style.display = flight.elapsed > 0 ? "" : "none";
    $("outflow").style.display = flight.elapsed > 0 && flight.heating ? "" : "none";
    $("flame").style.display = lit ? "" : "none";
    paintAir();
    progress.value = flight.elapsed;
    text("clock", `${Math.floor(flight.elapsed)} / ${Lantern.FLIGHT_DURATION} 秒`);
    progress.setAttribute("aria-valuetext", `${Number(progress.value)} 秒，${note[0]}`);
    text("play", frameId !== null ? "暫停" : flight.complete ? "重新播放" : lit ? "繼續播放" : "點火");
    $("reset").disabled = !lit;
  }

  function stop() {
    cancelAnimationFrame(frameId);
    frameId = null;
    lastFrame = null;
  }
  function frame(now) {
    const dt = lastFrame === null ? 0 : (now - lastFrame) / 1000;
    lastFrame = now;
    flight = Lantern.flight(flight.elapsed + dt);
    if (flight.complete) stop();
    else frameId = requestAnimationFrame(frame);
    render();
  }
  play.addEventListener("click", () => {
    if (frameId !== null) stop();
    else {
      if (flight.complete) flight = Lantern.flight(0);
      frameId = requestAnimationFrame(frame);
    }
    render();
  });
  progress.addEventListener("input", () => {
    stop();
    flight = Lantern.flight(Number(progress.value));
    render();
  });
  $("reset").addEventListener("click", () => {
    stop();
    flight = Lantern.flight(0);
    render();
  });
  function pause() {
    if (frameId !== null) { stop(); render(); }
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", event => { if (event.matches) pause(); });
  render();
})();
