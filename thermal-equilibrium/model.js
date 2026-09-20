(function (root) {
  'use strict';
  const CONTACT_SECONDS = 1.2, PLAYBACK_SECONDS = 30, ALUMINIUM_SPECIFIC = 900;
  // 比熱容量單位 J/(kg·K)；茶以水近似，檸檬採常數值。
  // https://poggiolab.unibas.ch/full/PhysikIBGP_HS17/solutions12.pdf
  // https://patents.google.com/patent/JP6082889B2/en
  const TEA_SPECIFIC = 4200, LEMON_SPECIFIC = 3850;

  function create({ massA, specificA, initialA, massB, specificB, initialB }) {
    const positive = [massA, specificA, massB, specificB];
    if (!positive.every(value => Number.isFinite(value) && value > 0) ||
        ![initialA, initialB].every(value => Number.isFinite(value) && value >= 0 && value <= 100)) {
      throw new RangeError('質量及比熱容量須為正數；初溫須介乎 0 至 100 °C。');
    }
    const capacityA = massA * specificA, capacityB = massB * specificB;
    const equilibrium = (capacityA * initialA + capacityB * initialB) / (capacityA + capacityB);
    const difference = initialA - initialB;
    const equilibriumEnergy = Math.abs(capacityA * capacityB / (capacityA + capacityB) * difference);
    const transferDuration = equilibriumEnergy === 0 ? 0 : PLAYBACK_SECONDS;
    const duration = CONTACT_SECONDS + transferDuration;
    return { massA, specificA, initialA, massB, specificB, initialB,
      capacityA, capacityB, equilibrium, equilibriumEnergy, difference, transferDuration, duration };
  }

  // time 只表示播放秒數；每輪等速轉移熱量，並非真實傳熱所需時間。
  function at(config, time) {
    if (!Number.isFinite(time) || time < 0) throw new RangeError('時間須為非負有限值。');
    const contactFraction = Math.min(time / CONTACT_SECONDS, 1);
    const transferFraction = config.transferDuration === 0 ? 1 : Math.min(Math.max(time - CONTACT_SECONDS, 0) / config.transferDuration, 1);
    const transferred = Math.sign(config.difference) * config.equilibriumEnergy * transferFraction;
    const temperatureA = transferFraction === 1 ? config.equilibrium : config.initialA - transferred / config.capacityA;
    const temperatureB = transferFraction === 1 ? config.equilibrium : config.initialB + transferred / config.capacityB;
    return { time, temperatureA, temperatureB, difference: temperatureA - temperatureB, contactFraction, transferFraction,
      energyA: -transferred, energyB: transferred };
  }

  const model = { create, at, CONTACT_SECONDS, PLAYBACK_SECONDS, ALUMINIUM_SPECIFIC, TEA_SPECIFIC, LEMON_SPECIFIC };
  if (typeof module !== 'undefined' && module.exports) module.exports = model;
  else root.ThermalEquilibrium = model;
})(globalThis);
