import assert from 'node:assert/strict';
import {createState,step,pressures,netFlow,FLOW_WINDOW,PARTICLE_COUNT,SPEED,RADIUS,CENTRE_X,CENTRE_Z,PIPE_HALF,PORT} from './model.mjs';
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`${a} ≠ ${b}`);
const energy=s=>s.particles.reduce((n,p)=>n+p.vx*p.vx+p.vz*p.vz,0);
const closed=createState(),initialEnergy=energy(closed);
assert.deepEqual(pressures(closed),{left:300,right:100});
step(closed,8);
assert.equal(closed.crossedRight+closed.crossedLeft,0);
assert.deepEqual(pressures(closed),{left:300,right:100});
near(energy(closed),initialEnergy,.001);
const open=createState();open.valveOpen=true;
let average=0;
for(let t=1;t<=240;t++) {
  step(open,1);
  assert.equal(open.particles.length,PARTICLE_COUNT);
  near(open.pLeft+open.pRight,400);
  near(pressures(open).left,400*(180-open.crossedRight+open.crossedLeft)/PARTICLE_COUNT);
  assert.ok(open.crossings.every(event=>event.time>open.time-FLOW_WINDOW&&event.time<=open.time+1e-8));
  if(t===8)assert.equal(netFlow(open).direction,1,'初始高壓側應有向右的淨移動');
  for(const p of open.particles){
    if(p.region===0) {
      assert.ok(Math.abs(p.x)<=PORT+1e-7);
      assert.ok(Math.abs(p.z-CENTRE_Z)<=PIPE_HALF+1e-7);
    } else {
      assert.ok(Math.abs(p.x)>=PORT-1e-7);
      assert.ok(Math.hypot(p.x-p.region*CENTRE_X,p.z-CENTRE_Z)<=RADIUS+1e-7);
    }
    near(p.vx*p.vx+p.vz*p.vz,SPEED*SPEED,.001);
  }
  if(t>120)average+=open.pLeft/120;
}
assert.ok(Math.abs(average-200)<15,`長時間平均左壓力 ${average}`);
assert.ok(open.crossedRight>50&&open.crossedLeft>50,'平衡後仍有雙向交換');
open.valveOpen=false;step(open,1);
const stopped=open.crossedRight+open.crossedLeft;step(open,5);
assert.equal(open.crossedRight+open.crossedLeft,stopped);
const a=createState(),b=createState();a.valveOpen=b.valveOpen=true;
step(a,2);for(let i=0;i<200;i++)step(b,.01);
near(a.pLeft,b.pLeft,.001);
assert.throws(()=>step(a,NaN),RangeError);
assert.throws(()=>step(a,-1),RangeError);
const bounce=createState();
Object.assign(bounce.particles[0],{x:-.1,z:CENTRE_Z,vx:SPEED,vz:0,region:0,trailTime:.055});
step(bounce,.01);
assert.ok(bounce.particles[0].x<0&&bounce.particles[0].vx<0);
assert.equal(bounce.particles[0].trailTime,0,'碰撞後的短尾不可穿過關閉的閥門');
const radial=createState(),p=radial.particles[0],angle=Math.PI/4;
Object.assign(p,{x:-CENTRE_X+(RADIUS-.1)*Math.cos(angle),z:CENTRE_Z+(RADIUS-.1)*Math.sin(angle),vx:SPEED*Math.cos(angle),vz:SPEED*Math.sin(angle)});
step(radial,.01);
near(p.vx,-SPEED*Math.cos(angle),1e-5);near(p.vz,-SPEED*Math.sin(angle),1e-5);
const crossing=createState();crossing.valveOpen=true;crossing.opening=1;
Object.assign(crossing.particles[0],{x:-.1,z:CENTRE_Z,vx:SPEED,vz:0,region:0});
step(crossing,.01);
assert.equal(crossing.crossedRight,1);assert.equal(crossing.crossedLeft,0);
assert.deepEqual(netFlow(crossing),{right:1,left:0,net:1,direction:0});
crossing.valveOpen=false;step(crossing,FLOW_WINDOW+1);
assert.equal(crossing.crossings.length,0,'過期通過紀錄必須清除');
const flow=directions=>netFlow({crossings:directions.map(direction=>({direction}))});
assert.deepEqual(flow([...Array(10).fill(1),-1,-1]),{right:10,left:2,net:8,direction:1});
assert.equal(flow([...Array(10).fill(-1),1,1]).direction,-1);
assert.equal(flow([1,-1]).direction,0);
assert.equal(flow([...Array(35).fill(-1),...Array(27).fill(1)]).direction,0,'細小計數起伏應顯示大致相抵');
console.log(`通過：閥門與圓形邊界、守恆、步長一致、實際穿越紀錄及淨移動視窗；平衡左壓力平均 ${average.toFixed(1)} kPa。`);
