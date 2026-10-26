const geometry=__DATA__;
const svg=document.querySelector('.stage svg'), hardware=document.querySelector('#hardware');
const parts=[...hardware.children].map(node=>({node,key:+node.dataset.depth,travel:+node.dataset.travel}));
const moving=[...document.querySelectorAll('[data-moving]')],hit=document.querySelector('#valve-hit');
const mask=document.querySelector('#gate-mask'),valveButton=document.querySelector('#valve-toggle'),pauseButton=document.querySelector('#pause');
const readLeft=document.querySelector('#pressure-left'),readRight=document.querySelector('#pressure-right');
const flowStatus=document.querySelector('#flow-status'),hint=document.querySelector('#hint'),status=document.querySelector('#status');
const netArrow=document.querySelector('#net-arrow'),netLabel=document.querySelector('#net-label');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let state=createState(),paused=reduced.matches,frame=0,last=0,visible=true,nearBalance=false;
const dots=state.particles.map(p=>{
  const group=document.createElementNS('http://www.w3.org/2000/svg','g');
  const tail=document.createElementNS('http://www.w3.org/2000/svg','path'),dot=document.createElementNS('http://www.w3.org/2000/svg','circle');
  tail.setAttribute('class','trail');dot.setAttribute('class','particle');dot.setAttribute('r','1.6');
  tail.dataset.origin=dot.dataset.origin=p.origin;
  group.append(tail,dot);document.querySelector('#particles').append(group);
  return {tail,dot};
});
function draw() {
  const transform=`translate(${geometry.lift[0]*state.opening} ${geometry.lift[1]*state.opening})`;
  for(const part of moving) part.setAttribute('transform',transform);
  hit.setAttribute('transform',transform);mask.setAttribute('y',CENTRE_Z-PIPE_HALF+2*PIPE_HALF*state.opening);
  parts.sort((a,b)=>a.key+a.travel*state.opening-b.key-b.travel*state.opening);
  for(const [i,p] of parts.entries()) if(hardware.children[i]!==p.node) hardware.insertBefore(p.node,hardware.children[i]);
  state.particles.forEach((p,i)=>{
    const {dot,tail}=dots[i];dot.setAttribute('cx',p.x);dot.setAttribute('cy',p.z);
    tail.setAttribute('d',Math.abs(p.x)<PORT+8?`M${p.x-p.vx*p.trailTime} ${p.z-p.vz*p.trailTime}L${p.x} ${p.z}`:'');
  });
  readLeft.textContent=Math.round(state.pLeft);readRight.textContent=Math.round(state.pRight);
  const difference=state.pLeft-state.pRight;
  if(Math.abs(difference)<20)nearBalance=true;
  else if(Math.abs(difference)>40)nearBalance=false;
  const flow=netFlow(state),exchanging=state.opening>0&&flow.right+flow.left>0;
  const balanced=nearBalance&&flow.direction===0&&flow.right>0&&flow.left>0;
  const direction=balanced?0:Math.sign(flow.net);
  const arrow='M-26 0H26M18 -6L26 0L18 6';
  netArrow.setAttribute('d',!exchanging?'M-12 0H12':direction===0?'M-26 0H26M18 -6L26 0L18 6M-18 -6L-26 0L-18 6':arrow);
  netArrow.setAttribute('transform',direction<0?'scale(-1 1)':'');
  netArrow.setAttribute('opacity',flow.direction===0&&!balanced?.5:1);
  netLabel.textContent=state.opening===0?'閥門關閉':!exchanging?'正在觀察交換':balanced?'兩向大致相抵':direction===0?'兩向通過量相同':`${direction>0?'左 → 右':'右 → 左'}${flow.direction===0?'稍多':'較多'}`;
  flowStatus.textContent=paused?'已暫停 · 可查看粒子位置與流向':state.opening>0&&state.opening<1?'閥門移動中 · 通道大小正在改變':state.opening===0?'閥門關閉 · 兩邊氣體未能交換':nearBalance?'壓力大致平衡 · 粒子仍然雙向交換':difference>0?'左邊壓力較高 · 比較兩個方向的交換量':'右邊壓力較高 · 比較兩個方向的交換量';
  hint.textContent=paused?'按「播放」繼續觀察。':state.opening>0?'個別粒子來回移動；淨移動係兩個方向通過量之差。':'按中央旋鈕開閥，比較兩個方向通過的粒子。';
  svg.dataset.pressureLeft=state.pLeft.toFixed(3);svg.dataset.pressureRight=state.pRight.toFixed(3);
  svg.dataset.opening=state.opening.toFixed(3);svg.dataset.crossedRight=state.crossedRight;svg.dataset.crossedLeft=state.crossedLeft;
  svg.dataset.netFlow=flow.net;svg.dataset.flowRight=flow.right;svg.dataset.flowLeft=flow.left;
}
function buttons() {
  valveButton.textContent=state.valveOpen?'關閉閥門':'開啟閥門';
  valveButton.setAttribute('aria-pressed',String(state.valveOpen));hit.setAttribute('aria-pressed',String(state.valveOpen));hit.setAttribute('aria-label',valveButton.textContent);
  pauseButton.textContent=paused?'播放':'暫停';pauseButton.setAttribute('aria-pressed',String(paused));
}
function tick(now) {
  frame=0;
  if(paused||!visible||document.hidden){last=0;return;}
  const dt=last?(now-last)/1000:0;last=now;
  step(state,dt);draw();frame=requestAnimationFrame(tick);
}
function run(){if(!frame&&!paused&&visible&&!document.hidden){last=0;frame=requestAnimationFrame(tick);}}
function toggleValve(){
  state.valveOpen=!state.valveOpen;
  state.crossings.length=0;
  if(paused) { state.opening=state.valveOpen?1:0; for(const p of state.particles)p.trailTime=0; draw(); }
  buttons();status.value=state.valveOpen?'正在開啟閥門。':'正在關閉閥門。';run();
}
valveButton.addEventListener('click',toggleValve);hit.addEventListener('click',toggleValve);
hit.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleValve();}});
pauseButton.addEventListener('click',()=>{paused=!paused;buttons();draw();run();});
document.querySelector('#reset').addEventListener('click',()=>{state=createState();nearBalance=false;buttons();draw();status.value='已重設：左邊 300 千帕、右邊 100 千帕，閥門關閉。';run();});
reduced.addEventListener('change',()=>{if(reduced.matches)paused=true;buttons();draw();});
new IntersectionObserver(entries=>{visible=entries.at(-1).isIntersecting;last=0;if(visible)run();}).observe(svg);
new ResizeObserver(()=>{svg.setAttribute('viewBox',geometry.viewBox);const m=svg.getScreenCTM();if(m)hit.setAttribute('r',Math.max(22,24/Math.hypot(m.a,m.b)));}).observe(svg);
document.addEventListener('visibilitychange',()=>{last=0;if(!document.hidden)run();});
buttons();draw();run();
