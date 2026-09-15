(function (root) {
  "use strict";
  // ponytail: 地面與植物共用等效溫度；實際設施預測需分開物件並加入幾何與濕度。
  const constants = Object.freeze({ sigma: 5.670374419e-8, outside: 20, solarTransmission: 0.8,
    infraredAbsorption: 0.98, groundCapacity: 18000, glassCapacity: 3000, airCapacity: 3600 });
  const emitted = t => constants.sigma * (t + 273.15) ** 4;
  const initial = () => ({ ground: 20, glass: 20, air: 20, time: 0 });

  function flows(state, sunlight) {
    const e = constants.infraredAbsorption, tau = 1 - e;
    const groundIR = emitted(state.ground), ambientIR = emitted(constants.outside);
    const glassIR = e * emitted(state.glass);
    const solar = constants.solarTransmission * sunlight;
    const reflected = sunlight - solar;
    const groundToAir = 6 * (state.ground - state.air);
    const airToGlass = 4 * (state.air - state.glass);
    const glassToOutside = 8 * (state.glass - constants.outside);
    const airToOutside = 2 * (state.air - constants.outside);
    const groundNet = solar + glassIR + tau * ambientIR - groundIR - groundToAir;
    const glassNet = e * (groundIR + ambientIR) - 2 * glassIR + airToGlass - glassToOutside;
    const airNet = groundToAir - airToGlass - airToOutside;
    // 對外淨散熱已扣除環境送入的紅外線；玻璃向內再輻射屬內部交換，不可再當成外來供能。
    const lost = tau * groundIR + glassIR - ambientIR + glassToOutside + airToOutside;
    return { incident: sunlight, reflected, solar, lost, net: solar - lost, groundIR, absorbedIR: e * groundIR,
      glassIR, groundNet, glassNet, airNet };
  }

  function advance(state, sunlight, seconds) {
    if (!Number.isFinite(sunlight) || sunlight < 0 || sunlight > 600 || !Number.isFinite(seconds) || seconds < 0) {
      throw new RangeError("日照必須為 0–600 W/m²，時間必須為非負有限數。");
    }
    let next = { ...state };
    // 每步最多一秒，快進與播放沿用同一積分，避免大時間步造成不穩定。
    for (let remaining = seconds; remaining > 0;) {
      const dt = Math.min(1, remaining), f = flows(next, sunlight);
      next.ground += f.groundNet * dt / constants.groundCapacity;
      next.glass += f.glassNet * dt / constants.glassCapacity;
      next.air += f.airNet * dt / constants.airCapacity;
      next.time += dt;
      remaining -= dt;
    }
    return next;
  }
  // 光點是慢速的能量路徑示例，不是光子計數或真實光速；吸收與重新發出分成兩個階段。
  function lightTrace(time, hasSun) {
    const cycle = hasSun ? 2760 : 1560;
    const age = time % cycle, infraredStart = hasSun ? 1200 : 0;
    const progress = (start, duration) => age >= start && age < start + duration ? (age - start) / duration : null;
    const flash = start => { const p = progress(start, 120); return p === null ? 0 : 1 - p; };
    const glassStart = infraredStart + 600, emissionStart = glassStart + 120;
    const stage = hasSun && age < 360 ? "sun" : hasSun && age < 1080 ? "split" :
      hasSun && age < 1200 ? "surfaceAbsorption" : age < glassStart ? "surfaceEmission" :
      age < emissionStart ? "glassAbsorption" : age < emissionStart + 600 ? "glassEmission" : "returnAbsorption";
    return {
      source: Math.floor(time / cycle) % 2 ? "plant" : "ground", stage,
      incoming: hasSun ? progress(0, 360) : null,
      transmitted: hasSun ? progress(360, 720) : null,
      reflected: hasSun ? progress(360, 300) : null,
      surfaceIR: progress(infraredStart, 600),
      returned: progress(emissionStart, 600), outside: progress(emissionStart, 480),
      surfaceAbsorption: hasSun ? flash(1080) : 0,
      glassAbsorption: flash(glassStart), returnAbsorption: flash(emissionStart + 600)
    };
  }
  const model = { constants, emitted, initial, flows, advance, lightTrace };
  if (typeof module !== "undefined" && module.exports) module.exports = model;
  else root.GreenhouseModel = model;
})(typeof globalThis !== "undefined" ? globalThis : this);
