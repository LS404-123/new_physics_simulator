import { writeFileSync } from "node:fs";
import * as k from "../../.agents/skills/anatomy/kit/iso-kit.mjs";
import * as G from "../../.agents/skills/anatomy/kit/lathe.mjs";
import * as A from "../../.agents/skills/anatomy/kit/audit.mjs";

// Figure：8 片後罩紙、16 處上下折邊、8 條接縫、4 段竹圈、
// 4 根托架、4 處綁紮各分 4 面、1 燃料托盤、1 燃料塊、1 頂蓋，共 59 件。
// 前面約 140° 剖開供觀察；剖面並非真實通風孔。
const P = k.fitProjection(k.boxCorners({ x: -98, y: -98, w: 196, d: 196, r: 0 }, 0, 270), 640, 440,
  { pad: 30, azimuth: 45, elevation: 23 });
P.origin[0] -= 28;
const F = G.frameAlong([0, 0, 0], [0, 0, 1]);
const R = A.recorder(P, { ground: s => s.name.startsWith("rim.") });
const at = point => k.iso(point, P);
const S = (paths, options = {}) => k.solidSvg(paths, { tone: "mid", crease: "faint", ...options });
const group = (className, svg) => `<g class="${className}">${svg}</g>`;
const arcPlan = (a, b, r0, r1) => {
  const sample = (r, reverse) => Array.from({ length: 17 }, (_, i) => {
    const angle = (a + (b - a) * (reverse ? 16 - i : i) / 16) * Math.PI / 180;
    return [r * Math.cos(angle), r * Math.sin(angle)];
  });
  return [...sample(r1, false), ...sample(r0, true)];
};
function arc(name, a, b, r0, r1, z, height, material, layer = "back") {
  const ring = arcPlan(a, b, r0, r1);
  const angle = (a + b) * Math.PI / 360;
  const shape = A.extruded(ring, z, height, { name, owner: "lantern" });
  R.put({ name, piece: "lantern", at: [Math.cos(angle) * r1, Math.sin(angle) * r1, z + height / 2], layer,
    svg: group(material, S(k.extrude(ring, z, height, P, { convex: false }))), shapes: [R.solid(shape)] });
}
function slab(name, plan, z, height, material, layer = "front") {
  R.put({ name, piece: "lantern", at: [plan.x + plan.w / 2, plan.y + plan.d / 2, z + height / 2], layer,
    svg: group(material, S(k.slabOf(plan, z, height, P, 4, 0.35))),
    shapes: [R.solid(A.slab(plan, z, height, { name, owner: "lantern" }, 4))] });
}
for (let i = 0; i < 8; i++) {
  const a = 115 + i * 27.5, b = a + 27.5;
  const layer = i === 0 || i === 7 ? "front" : "back";
  arc(`paper.${i}`, a, b, 78.7, 79.5, 35, 205, "paper-art", layer);
  arc(`hem.bottom.${i}`, a, b, 78.7, 80.3, 31, 4, "paper-art", layer);
  arc(`hem.top.${i}`, a, b, 78.7, 80.3, 240, 4, "paper-art", layer);
  arc(`seam.${i}`, a, a + 0.5, 79.5, 80.1, 35, 205, "seam-art", layer);
}
for (let i = 0; i < 4; i++) {
  const a = 45 + i * 90;
  arc(`rim.${i}`, a, a + 90, 76.7, 78.7, 30, 4, "bamboo-art", i === 0 || i === 3 ? "front" : "back");
}
slab("support.left", { x: -76.7, y: -1.2, w: 62.7, d: 2.4, r: 0.4 }, 30, 2, "frame-art");
slab("support.right", { x: 14, y: -1.2, w: 62.7, d: 2.4, r: 0.4 }, 30, 2, "frame-art");
slab("support.back", { x: -1.2, y: -76.7, w: 2.4, d: 62.7, r: 0.4 }, 30, 2, "frame-art");
slab("support.front", { x: -1.2, y: 14, w: 2.4, d: 62.7, r: 0.4 }, 30, 2, "frame-art");
for (const [i, angle] of [0, 90, 180, 270].entries()) {
  const layer = i < 2 ? "front" : "back";
  arc(`binding.${i}.outer`, angle - 1, angle + 1, 78.7, 79.2, 29.5, 5, "binding-art", layer);
  arc(`binding.${i}.inner`, angle - 1, angle + 1, 76.1, 76.7, 29.5, 5, "binding-art", layer);
  arc(`binding.${i}.bottom`, angle - 1, angle + 1, 76.7, 78.7, 29.5, 0.5, "binding-art", layer);
  arc(`binding.${i}.top`, angle - 1, angle + 1, 76.7, 78.7, 34, 0.5, "binding-art", layer);
}
slab("tray", { x: -14, y: -14, w: 28, d: 28, r: 2 }, 29, 3, "frame-art");
slab("fuel", { x: -11, y: -9, w: 22, d: 18, r: 1 }, 32, 7, "fuel-art");
R.put({ name: "cover", piece: "lantern", at: [0, 0, 244.5], layer: "front",
  svg: group("paper-art", S(G.solidOf([[244, 80.3], [245, 80.3]], F, P))),
  shapes: [R.solid(A.disc(F, 244, 245, 80.3, { name: "cover", owner: "lantern" }))] });
A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
if (process.argv.includes("--audit")) {
  const drawn = [...R.items.filter(i => i.layer === "back"), ...R.items.filter(i => i.layer === "front")]
    .map((item, key) => ({ ...item, key }));
  const order = A.depthOrder(drawn, P);
  if (order.problems.length || order.missing.length) {
    throw new Error(`前後圖層遮擋次序錯誤：${JSON.stringify(order)}`);
  }
}
const plane = (h, z, depth = 40) => at([(depth + h) / Math.SQRT2, (depth - h) / Math.SQRT2, z]);
const point = (h, z, depth = 40) => plane(h, z, depth).map(n => n.toFixed(2)).join(" ");
const paths = {
  up: `M${point(0, 69)}L${point(0, 207)}`,
  left: `M${point(-2, 219)}C${point(-30, 242)} ${point(-59, 214)} ${point(-59, 190)}L${point(-59, 79)}`,
  right: `M${point(2, 219)}C${point(30, 242)} ${point(59, 214)} ${point(59, 190)}L${point(59, 79)}`,
  returns: `M${point(-58, 67)}Q${point(-40, 43)} ${point(-12, 65)}M${point(58, 67)}Q${point(40, 43)} ${point(12, 65)}`,
  outLeft: `M${point(-42, 31)}Q${point(-49, 9)} ${point(-70, 1)}`,
  outRight: `M${point(42, 31)}Q${point(49, 9)} ${point(70, 1)}`
};
const origin = at([0, 0, 0]);
const basis = [[1,0,0],[0,1,0],[0,0,1]].map(p => at(p).map((n,i) => n - origin[i]));
const art = { back: R.items.filter(i => i.layer === "back").map(i => i.svg).join(""),
  front: R.items.filter(i => i.layer === "front").map(i => i.svg).join(""), origin, basis, paths,
  fuel: plane(0, 39, 0), opening: plane(0, 10, 0), hot: plane(12, 150), cold: plane(-68, 155),
  parts: R.items.length };
writeFileSync(new URL("lantern-art.js", import.meta.url), `window.lanternArt=${JSON.stringify(art)};\n`);
console.log(`已建立 Anatomy 孔明燈：${art.parts} 件，剖開前方以觀察內部。`);
A.auditOrExit(R, P);
