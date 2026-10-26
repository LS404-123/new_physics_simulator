import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as k from '../../.agents/skills/anatomy/kit/iso-kit.mjs';
import * as G from '../../.agents/skills/anatomy/kit/lathe.mjs';
import * as A from '../../.agents/skills/anatomy/kit/audit.mjs';
import {RADIUS,CENTRE_X,CENTRE_Z,PIPE_HALF,PORT} from './model.mjs';
const here=fileURLToPath(new URL('.',import.meta.url));
const W=1060,H=500;
const base={x:-230,y:-90,w:460,d:130,r:8};
const bounds=[...k.boxCorners(base,-6,8)];
for(const side of [-1,1]) {
  for(let i=0;i<=24;i++)for(let j=0;j<72;j++) {
    const t=i*Math.PI/48,a=j*Math.PI/36,r=RADIUS+4;
    bounds.push([side*CENTRE_X+r*Math.sin(t)*Math.cos(a),-r*Math.cos(t),CENTRE_Z+r*Math.sin(t)*Math.sin(a)]);
  }
  bounds.push(...k.boxCorners({x:side*CENTRE_X-45,y:0,w:90,d:26,r:2},12,42));
}
const P=k.fitProjection(bounds,W,H,{pad:24,azimuth:55,elevation:22});
const at=p=>k.iso(p,P), plan=(x,y,w,d,r=0)=>({x,y,w,d,r});
const R=A.recorder(P,{order:['gate']});
function put(name,centre,paths,shape,{detail='',tone='mid',moving=false,mask=''}={}) {
  R.put({name,piece:moving?'gate':'stand',move:moving?[0,0,2*PIPE_HALF]:[0,0,0],at:centre,
    svg:`<g data-part="${name}" ${moving?'data-moving':''}>${mask?`<g mask="url(#${name}-port)">`:''}${k.solidSvg(paths,{tone,crease:'faint',inner:detail})}${mask?`</g><defs><mask id="${name}-port" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="white"/><path d="${mask}" fill="black"/></mask></defs>`:''}</g>`,shapes:[R.solid(shape)]});
}
function slab(name,p,z,h,options={}) {
  put(name,[p.x+p.w/2,p.y+p.d/2,z+h/2],k.slabOf(p,z,h,P,6,.45),A.slab(p,z,h,{name,ground:name==='stand.base'},6),options);
}
function round(name,x,y,r,z,h,options={}) {
  put(name,[x,y,z+h/2],k.cylinder(x,y,r,z,h,P,40,.25),A.cylinder(x,y,r,z,h,{name}),options);
}
function screw(name,x,y,z) {
  const f=G.frameAlong([x,y,z],[0,1,0]);
  put(name,[x,y+.4,z],G.disc(0,.8,1.3,f,P,{steps:20,bevel:.15}),A.disc(f,0,.8,1.3,{name}),{tone:'lo',detail:k.lineSvg(k.pathOf([at([x-.7,y+.8,z]),at([x+.7,y+.8,z])]),{tone:'mid'})});
}
function face(x,y,z) {
  const o=at([x,y,z]),u=at([x+1,y,z]).map((v,i)=>v-o[i]),v=at([x,y,z-1]).map((n,i)=>n-o[i]);
  return `matrix(${u.join(' ')} ${v.join(' ')} ${o.join(' ')})`;
}
const sectionFrame=G.frameOf([0,0,0],[0,1,0],[1,0,0],[0,0,1]);
function section(name,polygon,options={}) {
  const centre=polygon.reduce((sum,p)=>[sum[0]+p[0]/polygon.length,-3,sum[2]+p[1]/polygon.length],[0,-3,0]);
  const paths=G.prismOf(sectionFrame,polygon,-6,0,P);
  // 剖面是凹多邊形，不可用 prismOf 的凸包填色，否則會把空腔封住。
  paths.fill='';paths.outline=k.pathOf(polygon.map(([x,z])=>at([x,0,z])),true);
  put(name,centre,paths,A.prism(sectionFrame,polygon,-6,0,{name}),options);
}
for(const [i,[x,y]] of k.corners(base,19).entries()) {
  round(`stand.pad.${i}`,x,y,8,-6,3,{tone:'lo'});
  round(`stand.foot.${i}`,x,y,6,-3,3);
}
slab('stand.base',base,0,8,{tone:'lo',detail:k.lineSvg(k.planOutline(k.insetPlan(base,5),8,P),{tone:'faint'})});
for(const [i,[x,y]] of k.corners(base,11).entries()) round(`stand.bolt.${i}`,x,y,2,8,.8,{tone:'lo',detail:k.lineSvg(k.lineOnTop([x-1.2,y],[x+1.2,y],8.8,P),{tone:'mid'})});
for(const side of [-1,1]) {
  const name=side<0?'left':'right',centre=side*CENTRE_X,outer=RADIUS+4;
  slab(`${name}.foot`,plan(centre-52,-22,104,56,3),8,4,{detail:k.lineSvg(k.planOutline(plan(centre-49,-19,98,50,2),12,P),{tone:'faint'})});
  const support=[[centre-16,12],[centre+16,12],...Array.from({length:17},(_,i)=>{const x=16-i*2;return[centre+x,CENTRE_Z-Math.sqrt(outer*outer-x*x)];})];
  section(`${name}.support`,support);
  for(const x of [centre-48,centre+48])for(const y of [-16,28])round(`${name}.foot.bolt.${x}.${y}`,x,y,1.5,12,.7,{tone:'lo'});
  const frame=G.frameOf([centre,0,CENTRE_Z],[0,1,0],[1,0,0],[0,0,-1]);
  const arc=r=>Array.from({length:25},(_,i)=>{const t=i*Math.PI/48;return[-r*Math.cos(t),r*Math.sin(t),i>0&&i<24?1:0];});
  const spherical=r=>({radius:s=>Math.sqrt(Math.max(0,r*r-s*s)),slope:s=>-s/Math.sqrt(Math.max(1e-8,r*r-s*s)),error:.1});
  const portFrame=G.frameAlong([centre,0,CENTRE_Z],[-side,0,0]);
  const aperture=[];
  for(const r of [RADIUS,outer])for(let j=0;j<=24;j++) {
    const t=j*Math.PI/24,z=PIPE_HALF*Math.cos(t),y=-PIPE_HALF*Math.sin(t);
    aperture.push(at([centre-side*Math.sqrt(r*r-PIPE_HALF*PIPE_HALF),y,CENTRE_Z+z]));
    aperture.push(at([centre-side*Math.sqrt(r*r-z*z),0,CENTRE_Z+z]));
  }
  const frontCircle=k.pathOf(Array.from({length:121},(_,i)=>at([centre+RADIUS*Math.cos(i*Math.PI/60),0,CENTRE_Z+RADIUS*Math.sin(i*Math.PI/60)])),true);
  const inside=G.lathe(arc(RADIUS).reverse(),frame,P,{steps:120,smooth:spherical(RADIUS)});
  inside.fill='';inside.outline='';inside.crease='';
  const meridians=[0,1].map(axis=>k.pathOf(Array.from({length:61},(_,i)=>{
    const t=i*Math.PI/60,s=RADIUS*Math.cos(t),y=-RADIUS*Math.sin(t);
    return at([centre+(axis===0?s:0),y,CENTRE_Z+(axis===1?s:0)]);
  }))).join('');
  const cavity=`<defs><clipPath id="${name}-cavity"><path d="${frontCircle}"/></clipPath></defs><g clip-path="url(#${name}-cavity)">${k.solidSvg(inside,{tone:'hi'})}<path class="curvature-guide" d="${meridians}"/></g>${k.lineSvg(frontCircle,{tone:'mid'})}`;
  put(`${name}.shell`,[centre,-outer/2,CENTRE_Z],G.lathe([...arc(outer),[0,0]],frame,P,{steps:120,smooth:spherical(outer)}),A.ball([centre,0,CENTRE_Z],outer,{name:`${name}.shell`,flats:[[0,1,0,0]],cut:[A.ball([centre,0,CENTRE_Z],RADIUS),A.disc(portFrame,0,outer+1,PIPE_HALF)]}),{tone:'hi',mask:k.pathOf(G.hullOf(aperture),true),detail:cavity});
  for(const angle of [Math.PI/2,Math.PI,3*Math.PI/2])screw(`${name}.rim.${angle}`,centre-side*(RADIUS+2)*Math.cos(angle),0,CENTRE_Z+(RADIUS+2)*Math.sin(angle));
  const screen=`<g class="meter" transform="${face(centre,26,28)}"><rect x="-40" y="-11" width="80" height="23" rx="1.5"/><text y="-3" text-anchor="middle" class="meter-label">${side<0?'左':'右'}容器 · kPa</text><text id="pressure-${name}" y="10" text-anchor="middle" class="meter-value">${side<0?'300':'100'}</text></g>`;
  slab(`${name}.meter`,plan(centre-45,0,90,26,2),12,30,{tone:'mid',detail:screen});
  for(const xx of [centre-42,centre+42])for(const zz of [15,39])screw(`${name}.meter.screw.${xx}.${zz}`,xx,26,zz);
}
const tubeEnd=CENTRE_X-Math.sqrt((RADIUS+4)**2-PIPE_HALF**2),bottom=CENTRE_Z-PIPE_HALF,top=CENTRE_Z+PIPE_HALF;
slab('pipe.floor',plan(-tubeEnd,-6,2*tubeEnd,6),bottom-1.5,1.5,{tone:'hi'});
slab('pipe.back',plan(-tubeEnd,-7.5,2*tubeEnd,1.5),bottom,2*PIPE_HALF+1.5,{tone:'hi'});
slab('pipe.roof.left',plan(-tubeEnd,-6,tubeEnd-2,6),top,1.5,{tone:'hi'});
slab('pipe.roof.right',plan(2,-6,tubeEnd-2,6),top,1.5,{tone:'hi'});
for(const x of [-18,14])for(const y of [-6,-2])slab(`valve.guide.${x}.${y}`,plan(x,y,4,2),top+1.5,51.5,{tone:'mid'});
slab('valve.bridge',plan(-18,-6,36,6),193,4,{tone:'mid'});
for(const x of [-16,16])round(`valve.bolt.${x}`,x,-3,1.2,197,.5,{tone:'lo'});
slab('gate.blade',plan(-2,-6,4,6),bottom,2*PIPE_HALF,{tone:'hi',moving:true});
round('gate.stem',0,-3,1.5,top,28,{moving:true,tone:'hi'});
round('gate.hub',0,-3,4,168,2,{moving:true});
round('gate.knob',0,-3,12,170,4,{moving:true,tone:'hi',detail:k.lineSvg(k.ring(0,-3,9,174,P,48),{tone:'mid'})});
A.settle(R,P);R.items.sort((a,b)=>a.key-b.key);
const hardware=R.items.map(item=>item.svg.replace('<g ',`<g data-depth="${item.key}" data-travel="${G.dot3(item.move,G.viewOf(P))}" `)).join('');
const origin=at([0,0,0]),ux=at([1,0,0]).map((v,i)=>v-origin[i]),uz=at([0,0,1]).map((v,i)=>v-origin[i]);
const plane=`matrix(${ux.join(' ')} ${uz.join(' ')} ${origin.join(' ')})`;
const clip=`<circle cx="${-CENTRE_X}" cy="${CENTRE_Z}" r="${RADIUS}"/><circle cx="${CENTRE_X}" cy="${CENTRE_Z}" r="${RADIUS}"/><rect x="${-PORT}" y="${bottom}" width="${2*PORT}" height="${2*PIPE_HALF}"/>`;
const gas=`<g transform="${plane}" pointer-events="none"><defs><clipPath id="gas-domain">${clip}</clipPath><mask id="valve-mask" maskUnits="userSpaceOnUse" x="-210" y="50" width="420" height="170"><rect x="-210" y="50" width="420" height="170" fill="white"/><rect id="gate-mask" x="-2" y="${bottom}" width="4" height="${2*PIPE_HALF}" fill="black"/></mask></defs><g clip-path="url(#gas-domain)" mask="url(#valve-mask)"><g id="particles"></g></g></g>`;
const knob=at([0,-3,172]);
const hit=`<circle id="valve-hit" cx="${knob[0]}" cy="${knob[1]}" r="22" tabindex="0" role="button" aria-label="開啟閥門" aria-pressed="false"/>`;
const netFlowDisplay=`<g id="net-flow" transform="${face(0,0,100)}" pointer-events="none"><text y="-12" text-anchor="middle" class="flow-caption">最近 8 秒的淨移動</text><path id="net-arrow" d="M-12 0H12"/><text id="net-label" y="17" text-anchor="middle">先開閥比較</text></g>`;
const scene=k.figureSvg({width:W,height:H,label:'兩個球形密閉容器切去前半球，露出弧形內壁與粒子；幼管閥門控制兩邊交換',body:`<path class="iso-halo" d="${k.haloOf(base,-6,10,P)}"/><g id="hardware">${hardware}</g>${gas}${netFlowDisplay}${hit}`}).replace('role="img"','role="group"');
let html=readFileSync(here+'page.html','utf8');
const projected=bounds.map(at),left=Math.min(...projected.map(p=>p[0]))-10,viewTop=Math.min(...projected.map(p=>p[1]))-10;
const viewBox=[left,viewTop,Math.max(...projected.map(p=>p[0]))-left+10,Math.max(...projected.map(p=>p[1]))-viewTop+10].join(' ');
const data={lift:at([0,0,2*PIPE_HALF]).map((v,i)=>v-at([0,0,0])[i]),viewBox};
for(const [key,value] of Object.entries({KIT_CSS:k.ISO_CSS,CSS:readFileSync(here+'style.css','utf8'),SCENE:scene,MODEL:readFileSync(here+'model.mjs','utf8').replace(/^export /gm,''),APP:readFileSync(here+'app.mjs','utf8').replace('__DATA__',JSON.stringify(data))})) html=html.replace(`__${key}__`,()=>value);
writeFileSync(here+'index.html',html);
console.log(`已建立壓力平衡裝置：${R.items.length} 個硬件部件。`);
A.auditOrExit(R,P);
