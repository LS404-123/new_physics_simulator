(function (root, factory) {
  const model = factory();
  if (typeof module === "object" && module.exports) module.exports = model;
  else root.Lantern = model;
})(globalThis, function () {
  "use strict";
  const V = 0.25, M = 0.080, P = 100000, RHO = 1.16;
  const T0 = 300, R = 8.31, NA = 6.02e23, G = 9.81;
  const MIN = 27, MAX = 220, INITIAL_MASS = RHO * V;
  const CRITICAL = INITIAL_MASS * T0 / (INITIAL_MASS - M) - 273;
  const INITIAL_N = P * V * NA / (R * T0);
  const surfaces = {
    light: { name: "淺色・光亮", emissivity: 0.15, fill: "#f7f4df" },
    dark: { name: "深色・暗啞", emissivity: 0.9, fill: "#35434b" }
  };

  function solve(celsius, surface = "light") {
    if (!Number.isFinite(celsius) || celsius < MIN || celsius > MAX || !surfaces[surface]) {
      throw new RangeError("溫度須介乎 27–220°C，並選擇有效表面。");
    }
    const temperature = celsius + 273;
    const fraction = T0 / temperature;
    const airMass = INITIAL_MASS * fraction;
    const totalMass = M + airMass;
    const buoyancy = INITIAL_MASS * G;
    const weight = totalMass * G;
    const netForce = buoyancy - weight;
    const molecules = INITIAL_N * fraction;
    const status = Math.abs(netForce) < 1e-10 ? "neutral" : netForce > 0 ? "rise" : "rest";
    // 等溫表面比較；放射率為教學設定，並非特定紙張的量度值。
    const radiation = surfaces[surface].emissivity * 5.670374419e-8 * (temperature ** 4 - T0 ** 4);
    return { celsius, temperature, surface, fraction, airMass, totalMass,
      airDensity: airMass / V, totalDensity: totalMass / V,
      buoyancy, weight, netForce, status, molecules,
      outMolecules: INITIAL_N - molecules, outMass: INITIAL_MASS - airMass, radiation };
  }

  function portions(state, count = 100) {
    return Array.from({ length: count }, (_, i) => Math.max(0, Math.min(1, state.fraction * count - i)));
  }

  function heat(celsius, seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError("時間不可為負數。");
    return solve(Math.min(MAX, celsius + seconds * 12)).celsius;
  }

  return { V, M, P, RHO, T0, R, NA, G, MIN, MAX, INITIAL_MASS, INITIAL_N, CRITICAL, surfaces, solve, portions, heat };
});
