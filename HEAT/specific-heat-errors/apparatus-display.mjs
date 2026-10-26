import * as T from 'three';

// 七段排列：上、右上、右下、下、左下、左上、中。
export const DIGITS = ['1111110', '0110000', '1101101', '1111001', '0110011', '1011011', '1011111', '1110000', '1111111', '1111011'];

export function heatArrowPose(state, path) {
  const progress = (state.time * 0.65 + path.offset) % 1;
  const flow = state[path.flow];
  // 保留原有箭嘴視覺比例；180 W 只用於大小縮放，不參與物理計算。
  const strength = path.flow === 'heaterPower' ? Math.min(1, Math.pow(Math.abs(flow) / 180, 0.35)) : 1;
  const scale = Math.abs(flow) > 0.001 ? Math.sin(Math.PI * progress) * strength : 0;
  const from = flow < 0 ? path.to : path.from;
  const to = flow < 0 ? path.from : path.to;
  const rotation = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(...to).sub(new T.Vector3(...from)).normalize()).toArray();
  return { position: from.map((v, i) => v + (to[i] - v) * progress), scale, rotation };
}

export function liquidColumnPose(temperature) {
  const bottom = 0.49;
  const top = 0.64 + temperature * 0.026;
  return { height: top - bottom, y: (top + bottom) / 2 };
}
