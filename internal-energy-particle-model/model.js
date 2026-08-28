(function (root) {
  "use strict";

  const PHASES = Object.freeze({
    ice: Object.freeze({ minTemperature: -20, maxTemperature: 0, potentialPerGram: 180 }),
    water: Object.freeze({ minTemperature: 0, maxTemperature: 100, potentialPerGram: 514 })
  });

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeObject(object) {
    const phase = PHASES[object.phase] ? object.phase : "water";
    const limits = PHASES[phase];
    return {
      mass: clamp(Number(object.mass) || 100, 100, 500),
      temperature: clamp(Number(object.temperature) || 0, limits.minTemperature, limits.maxTemperature),
      phase
    };
  }

  function energyFor(object) {
    const normalized = normalizeObject(object);
    const meanKinetic = normalized.temperature + 273.15;
    const kinetic = normalized.mass * meanKinetic;
    const potential = normalized.mass * PHASES[normalized.phase].potentialPerGram;
    return {
      ...normalized,
      meanKinetic,
      kinetic,
      potential,
      internal: kinetic + potential
    };
  }

  function predictionsAreCorrect(internalAnswer, kineticAnswer) {
    return internalAnswer === "B" && kineticAnswer === "B";
  }

  const model = Object.freeze({ PHASES, normalizeObject, energyFor, predictionsAreCorrect });
  root.InternalEnergyModel = model;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = model;
  }
})(globalThis);
