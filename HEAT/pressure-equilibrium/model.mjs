export const PARTICLE_COUNT = 240;
export const SPEED = 180;
export const RADIUS = 78, CENTRE_X = 126, CENTRE_Z = 135, PIPE_HALF = 5;
export const PORT = CENTRE_X - Math.sqrt(RADIUS ** 2 - PIPE_HALF ** 2);
export const FLOW_WINDOW = 8;
export function createState() {
  let seed = 20261019;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  const particles = Array.from({length:PARTICLE_COUNT},(_,i)=>{
    const side = i < 180 ? -1 : 1;
    let x,z;
    do {
      const radius=RADIUS*Math.sqrt(random()),angle=random()*Math.PI*2;
      x=side*CENTRE_X+radius*Math.cos(angle);z=CENTRE_Z+radius*Math.sin(angle);
    } while(Math.abs(x)<PORT);
    const angle=random()*Math.PI*2;
    return {x,z,vx:Math.cos(angle)*SPEED,vz:Math.sin(angle)*SPEED,region:side,origin:side,trailTime:0};
  });
  return {particles, opening:0, valveOpen:false, time:0, pLeft:300, pRight:100, crossedRight:0, crossedLeft:0,crossings:[]};
}
export function netFlow(state) {
  const right=state.crossings.filter(event=>event.direction>0).length,left=state.crossings.length-right;
  const net=right-left;
  // 以計數起伏量設顯示死區；這是有限代表粒子的穩定提示，並非精確置信區間。
  const fluctuation=Math.max(3,1.5*Math.sqrt(right+left));
  return {right,left,net,direction:Math.abs(net)<=fluctuation?0:Math.sign(net)};
}
export function pressures(state) {
  // 通道內的代表粒子歸入所在的一側；兩個球形容器等大，忽略幼管的儲氣體積。
  const left = state.particles.filter(p=>p.x<0).length;
  return {left:400*left/PARTICLE_COUNT,right:400*(PARTICLE_COUNT-left)/PARTICLE_COUNT};
}
function moveParticle(p,dt,state) {
  let remaining=dt,bounced=false;
  while(remaining>1e-10) {
    let time=remaining,event='none';
    const choose=(candidate,kind)=>{if(candidate>=-1e-10&&candidate<=time){time=Math.max(0,candidate);event=kind;}};
    if(p.region===0) {
      if(p.vz!==0)choose((CENTRE_Z+Math.sign(p.vz)*PIPE_HALF-p.z)/p.vz,'pipe');
      if(p.vx!==0) {
        choose((Math.sign(p.vx)*PORT-p.x)/p.vx,'port');
        if(p.x*p.vx<0)choose(-p.x/p.vx,'gate');
      }
    } else {
      const x=p.x-p.region*CENTRE_X,z=p.z-CENTRE_Z;
      const speed2=p.vx*p.vx+p.vz*p.vz,dot=x*p.vx+z*p.vz;
      choose((-dot+Math.sqrt(Math.max(0,dot*dot+speed2*(RADIUS*RADIUS-x*x-z*z))))/speed2,'sphere');
      if(p.vx*p.region<0) {
        const t=(p.region*PORT-p.x)/p.vx;
        if(Math.abs(p.z+p.vz*t-CENTRE_Z)<=PIPE_HALF)choose(t,'port');
      }
    }
    p.x+=p.vx*time;p.z+=p.vz*time;remaining-=time;
    if(event==='none')break;
    if(event==='port') {
      p.region=p.region===0?Math.sign(p.vx):0;
      p.x+=Math.sign(p.vx)*1e-8;
    } else if(event==='gate') {
      if(p.z>=CENTRE_Z-PIPE_HALF+2*PIPE_HALF*state.opening) {p.vx=-p.vx;bounced=true;}
      else {
        if(p.vx>0)state.crossedRight++;else state.crossedLeft++;
        state.crossings.push({time:state.time+dt-remaining,direction:Math.sign(p.vx)});
      }
      p.x=Math.sign(p.vx)*1e-8;
    } else if(event==='pipe') {
      p.vz=-p.vz;p.z+=Math.sign(p.vz)*1e-8;bounced=true;
    } else {
      const nx=(p.x-p.region*CENTRE_X)/RADIUS,nz=(p.z-CENTRE_Z)/RADIUS;
      const dot=p.vx*nx+p.vz*nz;
      p.vx-=2*dot*nx;p.vz-=2*dot*nz;
      p.x-=nx*1e-8;p.z-=nz*1e-8;bounced=true;
    }
  }
  p.trailTime=bounced?0:Math.min(.055,p.trailTime+dt);
}
// shortcut: 二維代表粒子、彈性壁碰撞及密度壓強近似；研究真實閥流或溫度過渡時須換模型。
export function step(state, elapsed) {
  if (!Number.isFinite(elapsed) || elapsed < 0) throw new RangeError('時間間隔須為非負值');
  const steps = Math.max(1,Math.ceil(elapsed/.01)), dt=elapsed/steps;
  for(let i=0;i<steps;i++) {
    const goal=state.valveOpen?1:0;
    state.opening += Math.sign(goal-state.opening)*Math.min(Math.abs(goal-state.opening),dt/0.45);
    for(const p of state.particles)moveParticle(p,dt,state);
    const p=pressures(state), follow=1-Math.exp(-dt/1.5);
    state.pLeft+=(p.left-state.pLeft)*follow;
    state.pRight+=(p.right-state.pRight)*follow;
    state.time+=dt;
  }
  state.crossings=state.crossings.filter(event=>event.time>state.time-FLOW_WINDOW);
  return state;
}
