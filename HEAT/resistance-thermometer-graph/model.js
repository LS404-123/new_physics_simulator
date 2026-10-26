(function (root) {
  'use strict';
  // 教學示意曲線：固定點重合，0–100 °C 之間實線較高；不擬合題目數據。
  const calibration = temperature => 100 + 0.4 * temperature;
  const actual = temperature => calibration(temperature) + 0.002 * temperature * (100 - temperature);
  function reading(temperature) {
    if (!Number.isFinite(temperature) || temperature < -20 || temperature > 120) {
      throw new RangeError('溫度須在 −20 至 120 °C 之間。');
    }
    const resistance = actual(temperature);
    const indicatedTemperature = (resistance - 100) / 0.4;
    return { temperature, resistance, indicatedTemperature };
  }
  const model = { calibration, actual, reading };
  if (typeof module !== 'undefined' && module.exports) module.exports = model;
  else root.ResistanceModel = model;
})(globalThis);
