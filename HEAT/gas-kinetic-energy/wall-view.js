"use strict";

function createWallView(svgNode) {
  const $ = id => document.getElementById(id);
  const dots = Array.from({ length: GasEnergy.defaults.count }, () => svgNode("circle", { r: 3.8 }));
  $("flat-dots").append(...dots);

  return function draw(box, included) {
    box.particles.forEach((p, i) => {
      dots[i].setAttribute("cx", 48 + 224 * p.x / box.width);
      dots[i].setAttribute("cy", 244 - 224 * p.z / box.width);
      const color = !box.thermal && p.group === 0 ? "#c6a3ff" : "#ffca82";
      dots[i].setAttribute("r", box.thermal ? 224 * box.thermal.radius / box.width : 3.8);
      dots[i].setAttribute("stroke", color);
      dots[i].setAttribute("fill", i < included ? color : "none");
    });
    const arrows = [];
    for (const hit of box.hits) {
      if (hit.axis !== "x" || hit.side !== 1) continue;
      const fade = 1 - (box.time - hit.time) / (2 * GasEnergy.impactWindow);
      if (fade <= 0) continue;
      const length = (box.thermal ? 25 : 65) * hit.impulse * KineticGas.SPEED_UNIT / (2 * 600);
      const head = Math.min(5, length / 2);
      const y = 244 - 224 * hit.z / box.width;
      arrows.push(svgNode("path", { d: "M0 0H" + length + "m-" + head + " -" + head + "l" + head + " " + head + "l-" + head + " " + head,
        transform: "translate(272 " + y + ")", opacity: Math.min(1, 2 * fade), class: "normal-impulse" }));
    }
    $("flat-impacts").replaceChildren(...arrows);
  };
}
