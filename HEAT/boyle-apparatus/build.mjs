import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as k from '../../.agents/skills/anatomy/kit/iso-kit.mjs';
import * as G from '../../.agents/skills/anatomy/kit/lathe.mjs';
import * as A from '../../.agents/skills/anatomy/kit/audit.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const W = 1060, H = 520;
const base = { x: -155, y: -62, w: 500, d: 124, r: 11 };
const bounds = [...k.boxCorners(base, -7, 10), ...k.boxCorners({x:-140,y:-7,w:104,d:18,r:0},86,190), ...k.boxCorners({x:324,y:-27,w:5,d:54,r:0},37,91)];
const P = k.fitProjection(bounds, W, H, { pad: 28, azimuth: 70, elevation: 24 });
const R = A.recorder(P, { order: ['piston'] });
const at = point => k.iso(point, P);
const plan = (x, y, w, d, r = 2) => ({ x, y, w, d, r });
const line = (d, tone = 'lo', free = false) => k.lineSvg(d, { tone, free });
const F = G.frameOf([0, 0, 64], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const gauge = G.frameOf([-88, 0, 138], [0, 1, 0], [1, 0, 0], [0, 0, -1]);
let count = 0;
function put(name, centre, paths, shape, { tone = 'mid', detail = '', moving = false, noOutline = false } = {}) {
  const style = { tone, crease: 'faint', inner: detail };
  const solid = noOutline ? { ...paths, fill: '', outline: '', crease: '', seamless: true } : paths;
  const svg = `<g ${moving ? 'data-moving ' : ''}data-part="${name}">${k.solidSvg(solid, style)}</g>`;
  R.put({ name, piece: moving ? 'piston' : 'stand', move: moving ? [-120, 0, 0] : [0, 0, 0], at: centre, svg, shapes: [R.solid(shape)] });
  count++;
}
function slab(name, p, z, h, options = {}) {
  put(name, [p.x + p.w / 2, p.y + p.d / 2, z + h / 2], k.slabOf(p, z, h, P, 6, .6), A.slab(p, z, h, { name, ground: name === 'stand.base' }, 6), options);
}
function round(name, x, y, r, z, h, options = {}) {
  put(name, [x, y, z + h / 2], k.cylinder(x, y, r, z, h, P, 40, .4), A.cylinder(x, y, r, z, h, { name }), options);
}
function disc(name, frame, from, to, radius, options = {}) {
  put(name, G.pointOf(frame, (from + to) / 2, 0, 0), G.disc(from, to, radius, frame, P, { steps: 64, bevel: .35 }), A.disc(frame, from, to, radius, { name }), options);
}
function ring(name, frame, from, to, inner, outer, options = {}) {
  put(name, G.pointOf(frame, (from + to) / 2, 0, 0), G.ringBand(from, to, inner, outer, frame, P, { steps: 72 }), A.ring(frame, from, to, inner, outer, { name }), options);
}
function screws(p, z) {
  return line(k.corners(p, 4).map(([x, y]) => k.ring(x, y, 1.5, z, P, 16)).join(''), 'lo')
    + k.dotsSvg(k.corners(p, 4).map(([x, y]) => at([x, y, z])), { size: .45 });
}
function section(name, from, to, inner, outer, start, end, pieces, options = {}) {
  const frame = options.frame || F;
  for (let i = 0; i < pieces; i++) {
    const a = start + (end - start) * i / pieces, b = start + (end - start) * (i + 1) / pieces;
    const polygon = [[outer * Math.cos(a), outer * Math.sin(a)], [outer * Math.cos(b), outer * Math.sin(b)], [inner * Math.cos(b), inner * Math.sin(b)], [inner * Math.cos(a), inner * Math.sin(a)]];
    const low = [G.pointOf(frame, from, outer, a), G.pointOf(frame, from, outer, b), G.pointOf(frame, from, inner, b), G.pointOf(frame, from, inner, a)];
    const high = [G.pointOf(frame, to, outer, a), G.pointOf(frame, to, outer, b), G.pointOf(frame, to, inner, b), G.pointOf(frame, to, inner, a)];
    const radial = angle => G.add3(G.mul3(frame.u, Math.cos(angle)), G.mul3(frame.v, Math.sin(angle)));
    const faces = [
      [[low[0], low[1], high[1], high[0]], radial((a + b) / 2)],
      [[low[2], low[3], high[3], high[2]], G.mul3(radial((a + b) / 2), -1)],
      [low, G.mul3(frame.a, -1)], [high, frame.a]
    ];
    // Shared sector walls are inside the same metal part; painting them creates false radial seams.
    if (end - start < Math.PI * 2 - .001) {
      if (i === 0) faces.push([[low[3], low[0], high[0], high[3]], radial(a - Math.PI / 2)]);
      if (i === pieces - 1) faces.push([[low[1], low[2], high[2], high[1]], radial(b + Math.PI / 2)]);
    }
    const buckets = ['', '', '', '', ''];
    for (const [points, normal] of faces) if (G.dot3(normal, G.viewOf(P)) > 1e-6) buckets[G.toneOf(normal, P)] += k.pathOf(points.map(at), true);
    const paths = { fill: '', outline: '', crease: '', top: buckets[4], shades: buckets.slice(0, 4) };
    put(`${name}.${i}`, G.pointOf(frame, (from + to) / 2, (inner + outer) / 2, (a + b) / 2), paths, A.prism(frame, polygon, from, to, { name: `${name}.${i}` }), { ...options, noOutline: true });
  }
}

// Each cutaway sector is recorded separately so the moving piston can pass behind its near edge.
for (const [i, [x, y]] of k.corners(base, 21).entries()) {
  round(`stand.pad.${i}`, x, y, 10, -7, 3, { tone: 'lo' });
  round(`stand.foot.${i}`, x, y, 7.5, -4, 4);
}
slab('stand.base', base, 0, 10, { tone: 'lo', detail: line(k.planOutline(k.insetPlan(base, 5), 10, P), 'faint') });
for (const [i, [x, y]] of k.corners(base, 12).entries()) round(`stand.bolt.${i}`, x, y, 2.2, 10, .8, { detail: line(k.lineOnTop([x - 1.4, y], [x + 1.4, y], 10.8, P), 'lo') });
const nameplate = plan(-126, 40, 88, 13, 1.5);
slab('stand.label', nameplate, 10, .8, { tone: 'hi', detail: k.faceTextSvg(k.topMatrix([-82, 49], 10.8, P), '波以耳定律', { anchor: 'middle', size: 5.2, tone: 'mid' }) });
for (const x of [-122, -42]) round(`stand.label-screw.${x}`, x, 46.5, 1.2, 10.8, .4, { tone: 'lo' });

for (const [i, x] of [-6, 171].entries()) {
  const foot = plan(x - 15, -33, 30, 66, 3);
  slab(`cradle.foot.${i}`, foot, 10, 3, { detail: screws(foot, 13) });
  slab(`cradle.post.${i}`, plan(x - 3, -11, 6, 22, 1), 13, 27);
}
for (const y of [-38, 36]) {
  slab(`rail.${y}`, plan(12, y, 301, 2, .8), 10, 3, { tone: 'lo' });
  for (const x of [12, 309]) slab(`rail.stop.${x}.${y}`, plan(x, y - 2, 4, 6, 1), 13, 2, { tone: 'lo' });
}

disc('chamber.head', F, -12, 0, 24, { tone: 'hi', detail: line(G.arcOf(F, -8, 24, P), 'lo') });
ring('chamber.lip', F, 0, 2, 18, 20, { tone: 'hi' });
section('chamber.shell', 2, 168, 18, 20, Math.PI / 2, Math.PI * 2, 24, { tone: 'hi' });
section('chamber.cap', 168, 174, 7, 24, 0, Math.PI * 2, 64, { tone: 'mid' });
section('chamber.gland', 174, 178, 5, 9, 0, Math.PI * 2, 48, { tone: 'mid' });
const strip = plan(0, 20, 168, .7, 0);
const scaleOrigin = at([0,20.7,64]);
const scaleX = at([1,20.7,64]).map((v,i)=>v-scaleOrigin[i]);
const scaleY = at([0,20.7,63]).map((v,i)=>v-scaleOrigin[i]);
const scaleMatrix = `matrix(${scaleX.join(' ')} ${scaleY.join(' ')} ${scaleOrigin.join(' ')})`;
let ticks = '', numbers = '<text x="145" y="12" text-anchor="middle" font-size="5.5">mL</text>';
for (let v = 0; v <= 20; v++) {
  const x = v * 8;
  ticks += `<path d="M${x} 0V${v%5?3:5}" stroke="#555e50" stroke-width="${v%5?.5:.9}"/>`;
  if (v % 5 === 0) numbers += `<text x="${x}" y="12" text-anchor="middle" font-size="6.8">${v}</text>`;
}
slab('chamber.scale', strip, 51, 13, { tone: 'hi', detail: `<g class="scale-face" transform="${scaleMatrix}">${ticks}${numbers}</g>` });
for (const [i, x] of [4, 164].entries()) disc(`chamber.scale-screw.${i}`, G.frameAlong([x,20.7,54],[0,1,0]),0,.3,.7,{tone:'lo'});

disc('piston.face', F, 160, 162, 18, { moving: true, tone: 'hi' });
disc('piston.seal.front', F, 162, 163, 18, { moving: true, tone: 'lo' });
disc('piston.body', F, 163, 166, 17.5, { moving: true, tone: 'mid' });
disc('piston.seal.back', F, 166, 168, 18, { moving: true, tone: 'lo' });
disc('piston.rod', F, 168, 320, 5, { moving: true, tone: 'hi' });
disc('piston.hub', F, 320, 324, 9, { moving: true, tone: 'mid' });
disc('piston.handle', F, 324, 328, 27, { moving: true, tone: 'hi', detail: line(G.arcOf(F, 326, 27, P), 'lo') });
disc('piston.grip', F, 328, 329, 23, { moving: true, tone: 'mid', detail: line(G.spokesOf(F, 329, 18, 22.5, 32, P), 'lo') });

const gaugeFoot = plan(-109, -23, 42, 46, 4);
slab('gauge.foot', gaugeFoot, 10, 3, { detail: screws(gaugeFoot, 13) });
round('gauge.column', -88, 0, 9, 13, 41, { detail: line(k.sideArc(-88, 0, 9, 48, P), 'lo') });
slab('gauge.tee', plan(-98, -10, 20, 20, 2), 54, 20, { tone: 'mid', detail: line(k.sideSeam(plan(-98, -10, 20, 20, 2), 68, P, 6), 'faint') });
disc('pipe.coupling.left', F, -78, -73, 12, { tone: 'mid' });
const tubeRadius = 18 * Math.sqrt(2 / 20 * 160 / 56);
section('pipe.rubber', -73, -17, tubeRadius, 11.2, Math.PI / 2, Math.PI * 2, 24, { tone: 'mid' });
disc('pipe.coupling.right', F, -17, -12, 12, { tone: 'mid' });
round('gauge.neck', -88, 0, 6, 74, 12);
disc('gauge.case', gauge, -7, 7, 52, { tone: 'hi', detail: line(G.arcOf(gauge, -3, 52, P), 'lo') });
section('gauge.bezel', 7, 10, 48.3, 52, 0, Math.PI * 2, 32, { tone: 'mid', frame: gauge });

const origin = at([-88, 8, 138]);
const ux = at([-87, 8, 138]).map((v, i) => v - origin[i]);
const uy = at([-88, 8, 137]).map((v, i) => v - origin[i]);
const faceMatrix = `matrix(${ux.join(' ')} ${uy.join(' ')} ${origin.join(' ')})`;
let marks = '<circle r="44.5" fill="none" stroke="#afb5a6" stroke-width=".3"/>';
for (let p = 0; p <= 500; p += 10) {
  const a = (-135 + p / 500 * 270) * Math.PI / 180, major = p % 100 === 0;
  const r = major ? 38 : 41;
  marks += `<path d="M${Math.sin(a) * r} ${-Math.cos(a) * r}L${Math.sin(a) * 44.5} ${-Math.cos(a) * 44.5}" stroke="#4d5845" stroke-width="${major ? 1 : .6}"/>`;
  if (major) marks += `<text x="${Math.sin(a) * 31.5}" y="${-Math.cos(a) * 31.5 + 2.5}" text-anchor="middle" font-size="7.6">${p}</text>`;
}
marks += '<text y="18" text-anchor="middle" font-size="6.5">kPa</text><text y="26" text-anchor="middle" font-size="5.5">絕對壓強</text><g id="needle" transform="rotate(-81)"><path class="dial-needle" d="M-1.1 7L0 -36L1.1 7Z" data-free="true"/></g><circle r="2.3" fill="#626c57" stroke="#f7f8f2" stroke-width=".5"/>';
disc('gauge.face', gauge, 7, 8, 48.3, { tone: 'hi', detail: `<g class="dial-face" transform="${faceMatrix}">${marks}</g>` });
for (let i = 0; i < 4; i++) {
  const a = (45 + i * 90) * Math.PI / 180;
  const screwFrame = G.frameAlong(G.pointOf(gauge, 10, 50.2, a), [0, 1, 0]);
  disc(`gauge.screw.${i}`, screwFrame, 0, .6, .9, { tone: 'lo' });
}

A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const body = R.items.map(item => item.svg.replace('<g ', `<g data-depth="${item.key}" data-travel-depth="${G.dot3(item.move, G.viewOf(P))}" `)).join('');
const target = at([327, 0, 64]);
const hit = `<circle id="piston-hit" cx="${target[0]}" cy="${target[1]}" r="42" tabindex="0" role="slider" aria-label="推拉活塞；左右箭嘴調整體積" aria-valuemin="5" aria-valuemax="20" aria-valuenow="20"/>`;
// 氣體示意只畫在被移去的四分之一外殼內；它不是參與碰撞審核的硬件。
const gasArc = radius => Array.from({length:25},(_,i)=>at(G.pointOf(F,0,radius,i/24*Math.PI/2)));
const tubeArc = gasArc(tubeRadius);
const axis = at([1, 0, 0]).map((v, i) => v - at([0, 0, 0])[i]);
const tubePath = k.pathOf([...tubeArc.map(p=>p.map((v,i)=>v-73*axis[i])),...tubeArc.toReversed().map(p=>p.map((v,i)=>v-17*axis[i]))],true);
const colouredBody = body.replace('data-part="pipe.coupling.right">',`data-part="pipe.coupling.right"><path id="tube-gas" d="${tubePath}"/>`);
const scene = k.figureSvg({ width: W, height: H, label: '可推拉活塞的密閉氣缸剖視；暖冷色表示氣溫，紫色表示管內額外氣體', body: `<path class="iso-halo" d="${k.haloOf(base, -7, 12, P)}"/><g id="hardware">${colouredBody}</g><path id="gas-fill"/>${hit}` }).replace('role="img"', 'role="group"');
const projected = bounds.map(at);
const left = Math.min(...projected.map(p=>p[0]))-12, top = Math.min(...projected.map(p=>p[1]))-12;
const viewBox = [left,top,Math.max(...projected.map(p=>p[0]))-left+12,Math.max(...projected.map(p=>p[1]))-top+12].join(' ');
let html = readFileSync(here + 'page.html', 'utf8');
const model = readFileSync(here + 'model.mjs', 'utf8').replace(/^import .*;\r?\n/, 'const GasLaws = globalThis.GasLaws;\n').replace(/^export /gm, '');
const app = readFileSync(here + 'app.mjs', 'utf8').replace('__DATA__', JSON.stringify({ axis, gasArc:gasArc(17.8), viewBox }));
for (const [key, value] of Object.entries({ KIT_CSS: k.ISO_CSS, CSS: readFileSync(here + 'style.css', 'utf8'), SCENE: scene, GAS_MODEL: readFileSync(here + '../gas-laws/model.js', 'utf8'), MODEL: model, APP: app })) html = html.replace(`__${key}__`, () => value);
writeFileSync(here + 'index.html', html);
console.log(`已建立波以耳裝置：${count} 個幾何實體，包含剖面分片。`);
A.auditOrExit(R, P);
