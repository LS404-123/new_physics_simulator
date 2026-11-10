import { writeFileSync } from "node:fs";
import * as k from "../../.agents/skills/anatomy/kit/iso-kit.mjs";

// 立方觀察室：隔震腳、雙層底座、玻璃密封條、壓框、角座和固定螺絲。
const size = 116;
const plate = { x: -13, y: -13, w: 142, d: 142, r: 5 };
const P = k.fitProjection(k.boxCorners(plate, -13, 138), 520, 450, { pad: 13 });
const point = p => k.iso(p, P);
const line = (a, b, tone = "lo") => k.lineSvg(k.pathOf([point(a), point(b)]), { tone });
const slab = (x, y, w, d, z, h, r = 1, css = "") =>
  k.solidSvg(k.slabOf({ x, y, w, d, r }, z, h, P, 5, 0.45), { className: css, tone: "mid" });
const cylinder = (x, y, radius, z, h, css = "") =>
  k.solidSvg(k.cylinder(x, y, radius, z, h, P, 20, 0.2), { className: css, tone: "mid" });
const back = [], front = [];
for (const [x, y] of k.corners(plate, 12)) {
  back.push(cylinder(x, y, 6.1, -13, 3, "rubber"), cylinder(x, y, 4.6, -10, 4));
}
back.push(slab(-13, -13, 142, 142, -6, 6, 5), slab(-11.5, -11.5, 139, 139, 0, 1.5, 4, "rubber"),
  slab(-12, -12, 140, 140, 1.5, 3, 4), slab(-3, -3, 122, 122, 4.5, 1.5, 1, "floor"));
for (let i = 0; i <= size; i += size / 8) {
  back.push(line([i, 0, 6], [i, size, 6], "faint"), line([0, i, 6], [size, i, 6], "faint"));
}
function pane(corners, fill) {
  return '<path d="' + k.pathOf(corners.map(point), true) + '" fill="' + fill + '" stroke="#a0c9c5" stroke-opacity=".42" stroke-width=".75"/>';
}
const low = 6, high = low + size;
const panel = (a, b, fill) => pane([[...a, low], [...b, low], [...b, high], [...a, high]], fill);
back.push(panel([0, size], [0, 0], "url(#glass-back)"), panel([0, 0], [size, 0], "url(#glass-back)"));
front.push(panel([0, size], [size, size], "url(#glass-front)"), panel([size, size], [size, 0], "url(#glass-front)"));
for (const [x, y] of [[0, 0], [size, 0], [0, size], [size, size]]) {
  const layer = x + y === 0 ? back : front;
  layer.push(slab(x - 1, y - 1, 2, 2, low, size, .35),
    slab(x - 3.5, y - 3.5, 7, 7, low, 4, .7), slab(x - 3.5, y - 3.5, 7, 7, high - 3, 4, .7));
}
for (const y of [0, size]) front.push(slab(-2, y - 1.5, size + 4, 3, high, 1.8, .6));
for (const x of [0, size]) front.push(slab(x - 1.5, -2, 3, size + 4, high, 1.8, .6));
front.push(pane([[0, 0, high], [size, 0, high], [size, size, high], [0, size, high]], "url(#glass-lid)"));
for (const [x, y] of k.corners(plate, 6)) {
  front.push(cylinder(x, y, 2.1, 4.5, .55), line([x - 1.1, y, 5.05], [x + 1.1, y, 5.05]));
}
for (const [x, y] of [[0, 0], [size, 0], [0, size], [size, size]]) {
  front.push(cylinder(x, y, 2.4, high + 1.8, .7), line([x - 1.2, y, high + 2.5], [x + 1.2, y, high + 2.5]));
}
const origin = point([0, 0, low]);
const basis = [[size, 0, low], [0, size, low], [0, 0, high]].map(p => point(p).map((v, i) => v - origin[i]));
const defs = `<defs>
  <linearGradient id="glass-back" x2=".7" y2="1"><stop stop-color="#a4dcd5" stop-opacity=".20"/><stop offset="1" stop-color="#639a9a" stop-opacity=".04"/></linearGradient>
  <linearGradient id="glass-front" x2="1" y2=".35"><stop stop-color="#b5dfdd" stop-opacity=".09"/><stop offset=".4" stop-color="#b5dfdd" stop-opacity=".015"/><stop offset="1" stop-color="#d6f8f1" stop-opacity=".10"/></linearGradient>
  <linearGradient id="glass-lid" x2="1" y2="1"><stop stop-color="#cdebe4" stop-opacity=".15"/><stop offset="1" stop-color="#79bdb6" stop-opacity=".035"/></linearGradient>
  <radialGradient id="atom" cx=".33" cy=".25" r=".76"><stop stop-color="#fff4c9"/><stop offset=".33" stop-color="#ffce80"/><stop offset=".73" stop-color="#e78d49"/><stop offset="1" stop-color="#9d522b"/></radialGradient>
</defs>`;
const svg = defs + back.join("") + '<g id="particles"></g><g id="impacts"></g>' + front.join("");
writeFileSync(new URL("chamber-art.js", import.meta.url), "// 由 build-chamber.mjs 產生。\nconst chamberArt = " + JSON.stringify({ svg, origin, basis }) + ";\n");
