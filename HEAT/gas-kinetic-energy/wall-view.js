"use strict";

function createWallView(svgNode) {
  const { wallReading, observationPs, mass } = GasEnergy;
  const $ = id => document.getElementById(id);
  const dots = Array.from({ length: GasEnergy.defaults.count }, () => svgNode("circle", { r: 3.8 }));
  $("flat-dots").append(...dots);

  // 每次實際撞擊產生一級。兩箱的座標軸固定，切換時可直接比較斜率。
  const x = ps => (32 + 484 * ps / observationPs).toFixed(2);
  const y = total => (83 - 75 * total / 1.5e-22).toFixed(2);
  function trace(box) {
    let path = "M32 83";
    for (const hit of box.wallTransfers) path += "H" + x(hit.ps) + "V" + y(hit.total);
    return path + "H" + x(wallReading(box).ps);
  }

  return function draw(box, samples, seenMixed) {
    const mixed = box === samples.b;
    box.particles.forEach((p, i) => {
      dots[i].setAttribute("cx", 48 + 224 * p.x / box.width);
      dots[i].setAttribute("cy", 244 - 224 * p.z / box.width);
      dots[i].setAttribute("fill", mixed && i < box.speedGroups[0].count ? "#c6a3ff" : "#ffca82");
    });
    const reading = wallReading(box);
    const arrows = [];
    for (let i = box.wallTransfers.length - 1; i >= 0; i--) {
      const hit = box.wallTransfers[i], age = reading.ps - hit.ps;
      if (age >= 3) break;
      const length = 65 * hit.impulse / (2 * mass * 600);
      const head = Math.min(5, length / 2);
      const y = 244 - 224 * hit.height;
      arrows.push(svgNode("path", { d: "M0 0H" + length + "m-" + head + " -" + head + "l" + head + " " + head + "l-" + head + " " + head,
        transform: "translate(272 " + y + ")", opacity: Math.min(1, 2 * (1 - age / 3)), class: "normal-impulse" }));
    }
    $("flat-impacts").replaceChildren(...arrows);
    $("trace-a").setAttribute("d", trace(samples.a));
    $("trace-b").setAttribute("d", seenMixed ? trace(samples.b) : "");
    $("wall-secant").setAttribute("x2", x(reading.ps));
    $("wall-secant").setAttribute("y2", y(reading.total));
    $("chart-key-b").hidden = !seenMixed;
    $("wall-time").textContent = reading.ps.toFixed(1);
    $("wall-count").textContent = String(box.wallTransfers.length);
    $("wall-pressure").textContent = reading.pressure === null ? "—" : (reading.pressure / 1000).toFixed(2);
  };
}
