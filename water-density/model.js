"use strict";

const WaterDensityModel = (() => {
  const { waterDensityAt } = typeof module !== "undefined" && module.exports
    ? require("../HEAT/heat-transfer-conduction-convection/model.js") : HeatTransferModel;
  const vessel = { x: 218, bottom: 602, width: 544, height: 350 };
  const sample = { x: 452, y: 444, width: 80, height: 60 };
  const total = 1200;
  const magnification = 10;

  function inside(x, y) {
    return x >= sample.x && x < sample.x + sample.width &&
      y >= sample.y && y <= sample.y + sample.height;
  }

  function at(temperature) {
    if (!Number.isFinite(temperature) || temperature < 20 || temperature > 80) {
      throw new RangeError("溫度須介乎 20–80°C。");
    }
    const density = waterDensityAt(temperature);
    // 高／低是相對此模擬範圍的密度中點，並非物態轉變。
    const densityLevel = density >= (waterDensityAt(20) + waterDensityAt(80)) / 2 ? "高" : "低";
    const volumeRatio = 1 + magnification * (waterDensityAt(20) / density - 1);
    const scale = Math.sqrt(volumeRatio);
    const centerX = sample.x + sample.width / 2;
    const centerY = sample.y + sample.height / 2;
    // 固定厚度的二維局部示意：面積代表體積，水平與垂直間距同比例增加。
    // 依使用者要求忽略杯壁約束，以取樣框中心向外膨脹，粒子本身不變大。
    // ponytail: 以靜態均勻取樣隔離熱膨脹；需要研究擴散時才加入分子運動。
    const particles = Array.from({ length: total }, (_, i) => {
      const initialX = vessel.x + vessel.width * ((.5 + i * .618033988749895) % 1);
      const initialY = vessel.bottom - vessel.height * (i + .5) / total;
      const x = centerX + (initialX - centerX) * scale;
      const y = centerY + (initialY - centerY) * scale;
      return { x, y, selected: inside(x, y) };
    });
    return { temperature, density, densityLevel, volumeRatio, scale,
      particles, count: particles.filter(p => p.selected).length };
  }

  return { vessel, sample, total, magnification, inside, at };
})();

if (typeof module !== "undefined" && module.exports) module.exports = WaterDensityModel;
