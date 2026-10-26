import assert from 'node:assert/strict';
import { apparatusState, advanceGas, followPiston, volumeFromDrag, DEAD_VOLUME, GAMMA, HEAT_TIME } from './model.mjs';

const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≠ ${expected}`);
for (const V of [5, 7.5, 10, 13.2, 20]) {
  const state = apparatusState(V);
  near(state.p * state.totalVolume, 2200);
  near(state.totalVolume, V + DEAD_VOLUME);
  near(state.T, 300);
  near(state.pistonX / 8, V);
  near((state.needleAngle + 135) / 270 * 500, state.p);
}
const initial = apparatusState(20);
const compressed = advanceGas(initial, 10, 0);
near(initial.p, 100);
near(apparatusState(10).p, 2200/12);
assert.ok(apparatusState(10).p < 200, '氣缸體積減半時，連管總體積未減半');
near(compressed.T, 300*(22/12)**(GAMMA-1));
near(compressed.p, 100*(22/12)**GAMMA);
near(advanceGas(compressed,20,0).T,300);
const cooled = advanceGas(compressed,10,HEAT_TIME);
near(cooled.T,300+(compressed.T-300)/Math.E);
assert.ok(cooled.p < compressed.p && cooled.p > apparatusState(10).p);
near(advanceGas(compressed,10,80).p,apparatusState(10).p,1e-6);
assert.ok(advanceGas(apparatusState(10),20,.1).T < 300, '膨脹後低於室溫');
function compress(seconds, steps) {
  let state=initial;
  for(let i=1;i<=steps;i++) state=advanceGas(state,20-10*i/steps,seconds/steps);
  return state;
}
assert.ok(compress(.2,60).T > compress(20,600).T, '慢壓縮有更多時間散熱');
near(compress(2,60).T,compress(2,240).T,.01);
let frequent = initial;
for(let i=0;i<240;i++) frequent=followPiston(frequent,5,1/60);
const delayed = followPiston(initial,5,4);
near(delayed.V,frequent.V);
near(delayed.T,frequent.T,.03);
near(followPiston(delayed,5,60).T,300,.001);
near(volumeFromDrag(20,-80),10);
near(volumeFromDrag(20,-1000),5);
near(volumeFromDrag(5,1000),20);
assert.throws(()=>apparatusState(0),RangeError);
assert.throws(()=>apparatusState(NaN),RangeError);
assert.throws(()=>apparatusState(10,0),RangeError);
assert.throws(()=>advanceGas(initial,10,-1),RangeError);
assert.throws(()=>followPiston(initial,10,NaN),RangeError);
console.log('通過：管內額外體積、絕熱升降溫、散熱、操作速度、步長一致性、刻度及拖動限位。');
