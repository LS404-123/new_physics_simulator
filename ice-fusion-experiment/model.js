(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.IceFusion = model;
})(globalThis, function () {
  'use strict';
  const L = 334000, ICE_C = 2100, MASS = 0.2, POWER = 60, AMBIENT = 4, DRAIN_TIME = 4;

  function create(options = {}) {
    const config = { crushed: true, melting: true, mesh: true, control: true, fallenInto: 'B', duration: 180, ...options };
    if (![60, 120, 180, 240].includes(config.duration) || !['A', 'B'].includes(config.fallenInto)) throw new RangeError('未知的實驗設定');
    if (!config.control) config.fallenInto = 'B';
    const initialEnergy = config.melting ? 0 : -MASS * ICE_C * 10;
    const funnel = () => ({ energy: initialEnergy, melted: 0, retained: 0, collected: 0, solid: 0 });
    return { config, time: 0, heatingTime: 0, phase: 'ready', input: 0, heater: 0, transferred: 0, lost: 0,
      fusionEnergy: 0, warmingEnergy: 0, a: funnel(), b: funnel() };
  }
  function start(state) { if (state.phase === 'ready') state.phase = 'heating'; return state; }
  function stop(state) { if (state.phase === 'heating') state.phase = 'draining'; return state; }

  // ponytail: 集中參數教學模型，室內供熱固定；真實器材須實測供熱、接觸及排水時間常數。
  function advance(state, elapsed) {
    if (!Number.isFinite(elapsed) || elapsed < 0) throw new RangeError('時間須為非負有限值');
    if (!['heating', 'draining'].includes(state.phase)) return state;
    let remaining = elapsed;
    while (remaining > 1e-9) {
      const heating = state.phase === 'heating';
      const dt = Math.min(0.25, remaining, heating ? state.config.duration - state.heatingTime : Infinity);
      if (dt < 1e-9) { stop(state); continue; }
      const power = heating ? POWER : 0, tau = state.config.crushed ? 12 : 35;
      const efficiency = state.config.crushed ? 1 : 0.72;
      const decay = Math.exp(-dt / tau), previousHeater = state.heater;
      state.heater = previousHeater * decay + power * tau * (1 - decay);
      const release = power * dt - (state.heater - previousHeater);
      state.input += power * dt;
      state.transferred += release * efficiency;
      state.lost += release * (1 - efficiency);
      state.time += dt;
      if (heating) state.heatingTime += dt;
      for (const [key, funnel] of [['A', state.a], ['B', state.b]]) {
        const added = AMBIENT * dt + (key === 'B' ? release * efficiency : 0);
        if (key === 'B') {
          // 冰升至 0°C 前，按同一步內環境及電熱器的供能比例分配升溫能量。
          const warmingFraction = Math.min(1, Math.max(0, -funnel.energy) / added);
          state.warmingEnergy += release * efficiency * warmingFraction;
          state.fusionEnergy += release * efficiency * (1 - warmingFraction);
        }
        funnel.energy += added;
        const melted = Math.min(MASS - funnel.solid, Math.max(0, funnel.energy / L));
        const generated = Math.max(0, melted - funnel.melted);
        const drainDecay = Math.exp(-dt / DRAIN_TIME);
        const retained = funnel.retained * drainDecay + generated * DRAIN_TIME / dt * (1 - drainDecay);
        funnel.collected += funnel.retained + generated - retained;
        funnel.retained = retained;
        funnel.melted = melted;
      }
      if (!state.config.mesh && state.time >= 45 && state.a.solid + state.b.solid === 0) {
        (state.config.fallenInto === 'A' ? state.a : state.b).solid = 0.002;
      }
      if (state.heatingTime >= state.config.duration - 1e-8) stop(state);
      remaining -= dt;
      if (state.phase === 'draining' && reading(state).finished) { state.phase = 'complete'; break; }
    }
    return state;
  }
  function reading(state) {
    const massA = state.config.control ? state.a.collected + state.a.solid : null;
    const massB = state.b.collected + state.b.solid;
    const rateA = state.a.retained / DRAIN_TIME, rateB = state.b.retained / DRAIN_TIME;
    const input = Math.round(state.input);
    const gramsA = massA === null ? null : Number((massA * 1000).toFixed(1));
    const gramsB = Number((massB * 1000).toFixed(1));
    const calculationGrams = Math.round((gramsB - (gramsA ?? 0)) * 10) / 10;
    const measuredLatentHeat = input > 0 && calculationGrams > 0 ? input / (calculationGrams / 1000) : null;
    return { massA, massB, rateA, rateB,
      temperatureA: Math.min(0, state.a.energy / (MASS * ICE_C)),
      temperatureB: Math.min(0, state.b.energy / (MASS * ICE_C)),
      settled: state.phase !== 'heating' && state.heater < 0.5 && Math.abs(rateB - rateA) < 0.0000002,
      finished: state.phase !== 'heating' && state.heater < 0.5 && Math.abs(rateB - (state.b.energy > 0 ? AMBIENT / L : 0)) < 0.0000002,
      input, gramsA, gramsB, calculationGrams,
      measuredLatentHeat, deviationPercent: measuredLatentHeat === null ? null : (measuredLatentHeat / L - 1) * 100 };
  }
  return { L, ICE_C, MASS, POWER, AMBIENT, create, start, stop, advance, reading };
});
