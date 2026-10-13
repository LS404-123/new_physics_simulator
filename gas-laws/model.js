(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.GasLaws = model;
})(globalThis, function () {
  'use strict';
  // p：絕對壓強 kPa，V：mL，T：K；三個模式使用同一份氣體。
  const ATMOSPHERE = 100;
  const NR = ATMOSPHERE * 20 / 300;
  const modes = {
    boyle: { name: '波以耳定律', min: 5, max: 20, step: 0.1, initial: 20 },
    charles: { name: '查理定律', min: 150, max: 600, step: 1, initial: 300 },
    pressure: { name: '壓力定律', min: 150, max: 600, step: 1, initial: 300 }
  };
  function solve(mode, input) {
    const limits = modes[mode];
    if (!limits || !Number.isFinite(input) || input < limits.min || input > limits.max) {
      throw new RangeError('未知定律或輸入超出模擬範圍');
    }
    const T = mode === 'boyle' ? 300 : input;
    const V = mode === 'boyle' ? input : mode === 'charles' ? NR * T / ATMOSPHERE : 20;
    const p = NR * T / V;
    return { mode, p, gaugePressure: p - ATMOSPHERE, V, T, celsius: T - 273.15, speed: Math.sqrt(T / 300) };
  }
  function transitionState(mode, from, to, progress) {
    const t = Math.max(0, Math.min(1, progress));
    // 只內插自變量，再求平衡狀態；分別內插 p 和 V 會破壞 pV = 常數。
    return solve(mode, from + (to - from) * (1 - (1 - t) ** 3));
  }
  function graphSpec(mode, reciprocal = false, celsius = false) {
    if (!modes[mode]) throw new RangeError('未知定律');
    if (mode === 'boyle') {
      return { xMin: 0, xMax: reciprocal ? 0.22 : 22, yMax: 440,
        xTicks: reciprocal ? [0, 0.05, 0.1, 0.15, 0.2] : [0, 5, 10, 15, 20],
        yTicks: [0, 100, 200, 300, 400], reciprocal, celsius: false };
    }
    return { xMin: -300, xMax: 650,
      yMax: mode === 'charles' ? 44 : 220,
      xTicks: [-300, -150, 0, 150, 300, 450, 600],
      yTicks: mode === 'charles' ? [0, 10, 20, 30, 40] : [0, 50, 100, 150, 200],
      reciprocal: false, celsius };
  }
  function point(state, spec) {
    return { x: state.mode === 'boyle' ? (spec.reciprocal ? 1 / state.V : state.V)
      : spec.celsius ? state.celsius : state.T,
    y: state.mode === 'charles' ? state.V : state.p };
  }
  function graphBounds(spec) {
    const columns = (spec.xMax - spec.xMin) / (spec.xTicks[1] - spec.xTicks[0]);
    const rows = spec.yMax / (spec.yTicks[1] - spec.yTicks[0]);
    const cell = Math.min(564 / columns, 302 / rows);
    return { left: 348 - columns * cell / 2, right: 348 + columns * cell / 2,
      top: 344 - rows * cell, bottom: 344 };
  }
  function curve(mode, spec) {
    const { min, max } = modes[mode];
    return Array.from({ length: 101 }, (_, i) => point(solve(mode, min + (max - min) * i / 100), spec));
  }
  function morphPoints(from, to, progress) {
    const t = Math.max(0, Math.min(1, progress));
    const eased = t * t * (3 - 2 * t);
    return to.map((p, i) => {
      const start = from[Math.min(i, from.length - 1)];
      return { x: start.x + (p.x - start.x) * eased, y: start.y + (p.y - start.y) * eased };
    });
  }
  return { ATMOSPHERE, NR, modes, solve, transitionState, graphSpec, graphBounds, point, curve, morphPoints };
});
