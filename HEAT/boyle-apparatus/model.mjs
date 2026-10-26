import GasLaws from '../gas-laws/model.js';

export const MIN_VOLUME = GasLaws.modes.boyle.min;
export const MAX_VOLUME = GasLaws.modes.boyle.max;
export const POSITION_SCALE = 8;
export const AMBIENT_TEMPERATURE = 300;
export const DEAD_VOLUME = 2;
export const HEAT_TIME = 4;
export const GAMMA = 1.4;
// shortcut: 均勻氣溫、固定管容積及示意散熱時間；定量分析真實器材時須另行校準。
export function apparatusState(volume, temperature = AMBIENT_TEMPERATURE) {
  const state = GasLaws.solve('boyle', volume);
  if (!Number.isFinite(temperature) || temperature <= 0) throw new RangeError('氣體溫度須為正值');
  const totalVolume = volume + DEAD_VOLUME;
  const p = GasLaws.ATMOSPHERE * (MAX_VOLUME + DEAD_VOLUME) / totalVolume * temperature / AMBIENT_TEMPERATURE;
  return { ...state, T: temperature, p, totalVolume, celsius: temperature - 273.15,
    gaugePressure: p - GasLaws.ATMOSPHERE, speed: Math.sqrt(temperature / AMBIENT_TEMPERATURE),
    pistonX: volume * POSITION_SCALE, needleAngle: -135 + p / 500 * 270 };
}
export function advanceGas(state, volume, dt) {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('時間間隔須為非負值');
  const next = apparatusState(volume);
  const steps = Math.max(1, Math.ceil(dt / .02));
  const cooling = Math.exp(-dt / steps / HEAT_TIME / 2);
  let T = state.T;
  for (let i = 0; i < steps; i++) {
    const from = state.totalVolume + (next.totalVolume - state.totalVolume) * i / steps;
    const to = state.totalVolume + (next.totalVolume - state.totalVolume) * (i + 1) / steps;
    T = AMBIENT_TEMPERATURE + (T - AMBIENT_TEMPERATURE) * cooling;
    T *= (from / to) ** (GAMMA - 1);
    T = AMBIENT_TEMPERATURE + (T - AMBIENT_TEMPERATURE) * cooling;
  }
  return apparatusState(volume, T);
}
export function volumeFromDrag(start, movement) {
  return Math.max(MIN_VOLUME, Math.min(MAX_VOLUME, start + movement / POSITION_SCALE));
}
export function followPiston(state, target, dt) {
  apparatusState(target);
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('時間間隔須為非負值');
  const steps = Math.max(1, Math.ceil(dt / .02)), step = dt / steps;
  for (let i = 0; i < steps; i++) {
    let V = state.V + (target - state.V) * (1 - Math.exp(-step / .12));
    if (Math.abs(V - target) < .002) V = target;
    state = advanceGas(state,V,step);
  }
  return state;
}
