"use strict";
const assert = require("node:assert/strict");
const { applyCardOrder, moveCardOrder } = require("./simulations.js");
const items = [
  { href: "a", topic: "熱" }, { href: "b", topic: "熱" },
  { href: "c", topic: "熱" }, { href: "d", topic: "力" }
];
const ids = list => list.map(item => item.href);
assert.deepEqual(ids(applyCardOrder(items, ["c", "a"])), ["c", "a", "b", "d"]);
assert.deepEqual(ids(applyCardOrder(items, ["missing", "b", "b", {}, 1])), ["b", "a", "c", "d"]);
assert.deepEqual(ids(applyCardOrder(items, null)), ["a", "b", "c", "d"]);
assert.deepEqual(moveCardOrder(items, [], "a", "c"), ["b", "c", "a", "d"]);
assert.deepEqual(moveCardOrder(items, [], "c", "a"), ["c", "a", "b", "d"]);
assert.deepEqual(moveCardOrder(items, [], "a", "d"), ["a", "b", "c", "d"]);
assert.deepEqual(moveCardOrder(items, [], "missing", "b"), ["a", "b", "c", "d"]);
assert.deepEqual(moveCardOrder(items, [], "a", "a"), ["a", "b", "c", "d"]);
assert.deepEqual(ids(items), ["a", "b", "c", "d"], "排序不可改動原始清單及最新加入項目");
console.log("通過：預設排序、上下移動、未知／重複設定、新項目保留、課題邊界及原始清單不變。");
