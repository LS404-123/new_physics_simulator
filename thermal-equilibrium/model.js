(function (root) {
  'use strict';
  const CONTACT_SECONDS = 1.2, PLAYBACK_SECONDS = 30, ALUMINIUM_SPECIFIC = 900;
  // 比熱容量單位 J/(kg·K)；茶以水近似，檸檬採常數值。
  // https://poggiolab.unibas.ch/full/PhysikIBGP_HS17/solutions12.pdf
  // https://patents.google.com/patent/JP6082889B2/en
  const TEA_SPECIFIC = 4200, LEMON_SPECIFIC = 3850, WATER_SPECIFIC = 4200, ICE_SPECIFIC = 2100, FUSION_LATENT = 334000;
  // 比熱容量採課堂近似：冰 2100、水 4200 J/(kg·K)；熔化比潛熱 334 kJ/kg。
  // https://openstax.org/books/physics/pages/11-3-phase-change-and-latent-heat

  function create({ massA, specificA, initialA, massB, specificB, initialB, ice = false }) {
    const positive = [massA, specificA, massB, specificB];
    if (!positive.every(value => Number.isFinite(value) && value > 0) ||
        !Number.isFinite(initialA) || initialA < (ice ? -40 : 0) || initialA > (ice ? 0 : 100) ||
        !Number.isFinite(initialB) || initialB < 0 || initialB > 100) {
      throw new RangeError('質量及比熱容量須為正數；冰初溫須介乎 −40 至 0°C，其他物體須介乎 0 至 100°C。');
    }
    const capacityA = massA * specificA, capacityB = massB * specificB;
    if (ice && specificA !== WATER_SPECIFIC) {
      throw new RangeError('融水須使用水的比熱容量。');
    }
    const meltingEnergy = ice ? massA * FUSION_LATENT : 0;
    const warmingEnergy = ice ? -massA * ICE_SPECIFIC * initialA : 0;
    const coolingEnergy = capacityB * initialB;
    // 以 0°C 固態冰為能量零點；總能量亦決定是否有液體結冰。
    const totalEnthalpy = -warmingEnergy + massB * FUSION_LATENT + coolingEnergy;
    const equilibrium = !ice ? (capacityA * initialA + capacityB * initialB) / (capacityA + capacityB) :
      totalEnthalpy < 0 ? totalEnthalpy / ((massA + massB) * ICE_SPECIFIC) :
      Math.max(0, (coolingEnergy - warmingEnergy - meltingEnergy) / (capacityA + capacityB));
    const difference = initialA - initialB;
    const equilibriumEnergy = ice ? equilibrium > 0 ? warmingEnergy + meltingEnergy + capacityA * equilibrium :
      equilibrium < 0 ? warmingEnergy + massA * ICE_SPECIFIC * equilibrium : Math.max(warmingEnergy, coolingEnergy) :
      Math.abs(capacityA * capacityB / (capacityA + capacityB) * difference);
    const transferDuration = equilibriumEnergy === 0 ? 0 : PLAYBACK_SECONDS;
    const duration = CONTACT_SECONDS + transferDuration;
    return { massA, specificA, initialA, massB, specificB, initialB,
      capacityA, capacityB, equilibrium, equilibriumEnergy, difference, transferDuration, duration, ice, meltingEnergy, warmingEnergy, coolingEnergy };
  }

  // time 只表示播放秒數；每輪等速轉移熱量，並非真實傳熱所需時間。
  function at(config, time) {
    if (!Number.isFinite(time) || time < 0) throw new RangeError('時間須為非負有限值。');
    const contactFraction = Math.min(time / CONTACT_SECONDS, 1);
    const transferFraction = config.transferDuration === 0 ? 1 : Math.min(Math.max(time - CONTACT_SECONDS, 0) / config.transferDuration, 1);
    const transferred = Math.sign(config.difference) * config.equilibriumEnergy * transferFraction;
    const absorbed = -transferred;
    const enthalpyA = absorbed - config.warmingEnergy;
    const enthalpyB = config.massB * FUSION_LATENT + config.coolingEnergy - absorbed;
    const temperatureA = config.ice ? enthalpyA < 0 ? enthalpyA / (config.massA * ICE_SPECIFIC) :
      Math.max(0, (enthalpyA - config.meltingEnergy) / config.capacityA) :
      transferFraction === 1 ? config.equilibrium : config.initialA - transferred / config.capacityA;
    const temperatureB = config.ice ? enthalpyB < 0 ? enthalpyB / (config.massB * ICE_SPECIFIC) :
      Math.max(0, (enthalpyB - config.massB * FUSION_LATENT) / config.capacityB) :
      transferFraction === 1 ? config.equilibrium : config.initialB + transferred / config.capacityB;
    const meltedMass = config.ice ? Math.max(0, Math.min(config.massA, enthalpyA / FUSION_LATENT)) : 0;
    const frozenMass = config.ice ? Math.max(0, Math.min(config.massB, config.massB - enthalpyB / FUSION_LATENT)) : 0;
    return { time, temperatureA, temperatureB, difference: temperatureA - temperatureB, contactFraction, transferFraction,
      energyA: absorbed, energyB: transferred,
      meltedMass, frozenMass,
      remainingIce: config.ice ? config.massA - meltedMass : 0 };
  }

  const model = { create, at, CONTACT_SECONDS, PLAYBACK_SECONDS, ALUMINIUM_SPECIFIC, TEA_SPECIFIC, LEMON_SPECIFIC, WATER_SPECIFIC, ICE_SPECIFIC, FUSION_LATENT };
  if (typeof module !== 'undefined' && module.exports) module.exports = model;
  else root.ThermalEquilibrium = model;
})(globalThis);
