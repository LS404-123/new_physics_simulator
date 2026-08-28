(function (root, factory) {
  const model = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = model;
  else root.RadiationModel = model;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STEFAN_BOLTZMANN = 5.670374419e-8;
  const EMISSIVITY = 0.9;
  const SPHERE_RADIUS = 0.05;
  const AREA = 4 * Math.PI * SPHERE_RADIUS ** 2;
  const HEAT_CAPACITY = 55;
  const TIME_SCALE = 12;
  const MIN_TEMPERATURE = -20;
  const MAX_TEMPERATURE = 250;

  const toKelvin = (celsius) => celsius + 273.15;

  function emittedPower(celsius) {
    return EMISSIVITY * STEFAN_BOLTZMANN * AREA * toKelvin(celsius) ** 4;
  }

  function powers(objectTemperature, environmentTemperature) {
    const emitted = emittedPower(objectTemperature);
    const absorbed = emittedPower(environmentTemperature);
    return { emitted, absorbed, net: emitted - absorbed };
  }

  function role(objectTemperature, environmentTemperature, tolerance = 0.05) {
    const difference = objectTemperature - environmentTemperature;
    if (Math.abs(difference) <= tolerance) return "equilibrium";
    return difference > 0 ? "emitter" : "absorber";
  }

  function stepTemperature(objectTemperature, environmentTemperature, dt) {
    if (role(objectTemperature, environmentTemperature) === "equilibrium") return environmentTemperature;
    const { net } = powers(objectTemperature, environmentTemperature);
    const next = objectTemperature - (net / HEAT_CAPACITY) * Math.max(0, dt) * TIME_SCALE;
    return objectTemperature < environmentTemperature
      ? Math.min(next, environmentTemperature)
      : Math.max(next, environmentTemperature);
  }

  return {
    STEFAN_BOLTZMANN,
    EMISSIVITY,
    SPHERE_RADIUS,
    AREA,
    HEAT_CAPACITY,
    TIME_SCALE,
    MIN_TEMPERATURE,
    MAX_TEMPERATURE,
    POWER_SCALE: emittedPower(MAX_TEMPERATURE),
    toKelvin,
    emittedPower,
    powers,
    role,
    stepTemperature
  };
});
