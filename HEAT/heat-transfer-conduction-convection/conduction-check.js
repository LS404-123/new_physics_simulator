const assert = require("node:assert/strict");
const model = require("./model.js");

const columns = 17;
const rows = 6;
let lattice = {
  columns,
  rows,
  displacements: Array(columns * rows).fill(0),
  velocities: Array(columns * rows).fill(0),
  temperatures: Array(columns * rows).fill(20)
};
let time = 0;
let peak = 0;

for (let frame = 0; frame < 12000; frame += 1) {
  time += 1 / 120;
  lattice = { ...lattice, ...model.stepConduction(lattice, 0.75, 1 / 120, time) };
  peak = Math.max(peak, Math.abs(lattice.displacements[0]));
}

const columnTemperatures = Array.from({ length: columns }, (_, column) =>
  lattice.temperatures.filter((_, index) => index % columns === column)
    .reduce((sum, temperature) => sum + temperature, 0) / rows
);

assert.equal(lattice.temperatures.length, 102);
assert(peak >= 7, "加熱端震幅不足");
assert(columnTemperatures.at(-1) > 20.1, "熱能未能傳到最右端");
assert(columnTemperatures.every((temperature, index) => index === 0 || columnTemperatures[index - 1] >= temperature - 0.2), "溫度—位置曲線方向錯誤");
console.log("conduction check passed");
