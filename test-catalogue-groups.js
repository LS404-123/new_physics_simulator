"use strict";
const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");
const { simulations, groupBySubtopic, applyCardOrder, matchesSearch, topics, subtopics } = require("./simulations.js");

assert.deepEqual(subtopics, ["溫度、熱和內能", "熱轉移過程", "物態的改變", "氣體"], "子課題須依課程第 1–2 頁的名稱及次序");
assert.ok(topics.includes("DSE問題"), "保留獨立的 DSE問題目錄分類");

const originalOrder = simulations.map(item => item.href);
for (const item of simulations) {
  assert.equal(item.topic, item.tags.includes("DSE問題") ? "DSE問題" : "熱和氣體");
  assert.ok(subtopics.includes(item.subtopic), `${item.title} 須使用正式子課題`);
  assert.ok(item.href.startsWith("./HEAT/"), `${item.title} 須存入熱和氣體主題資料夾`);
  assert.ok(existsSync(resolve(__dirname, item.href)), `${item.title} 的連結必須存在`);
  assert.ok(existsSync(resolve(__dirname, item.image)), `${item.title} 的預覽圖必須存在`);
  assert.ok(matchesSearch(item, item.subtopic), "搜尋須包含子主題名稱");
}

const settings = { window: {} };
runInNewContext(readFileSync(resolve(__dirname, "catalogue-order.js"), "utf8"), settings);
assert.ok(settings.window.catalogueOrder.every(href => originalOrder.includes(href)), "儲存排序不可包含搬移前的路徑");

for (const topic of new Set(simulations.map(item => item.topic))) {
  const items = simulations.filter(item => item.topic === topic);
  const groups = groupBySubtopic(items);
  assert.equal(groups.flatMap(([, cards]) => cards).length, items.length, "分組不可遺漏或重複卡片");
  assert.deepEqual(new Set(groups.flatMap(([, cards]) => cards)), new Set(items));
  for (const [subtopic, cards] of groups) {
    assert.ok(cards.every(item => item.topic === topic && item.subtopic === subtopic));
  }
  const reversed = applyCardOrder(items, [...items].reverse().map(item => item.href));
  const reorderedGroups = groupBySubtopic(reversed);
  assert.deepEqual(reorderedGroups.map(([name]) => name), groups.map(([name]) => name), "卡片排序不可改變子主題次序");
  reorderedGroups.forEach(([, cards], index) => {
    assert.deepEqual(cards, [...groups[index][1]].reverse(), "組內須保留已儲存的卡片次序");
  });
}

assert.deepEqual(groupBySubtopic(simulations).map(([, cards]) => cards.length), [6, 4, 3, 5]);
const dseGroups = groupBySubtopic(simulations.filter(item => item.topic === "DSE問題"));
assert.deepEqual(dseGroups.map(([name, cards]) => [name, cards.map(item => item.href)]), [
  ["溫度、熱和內能", ["./HEAT/resistance-thermometer-graph/index.html"]],
  ["氣體", ["./HEAT/basketball-pressure/index.html"]],
], "DSE問題也須按正式子課題分組，保留所屬物理主題資料夾");
const searched = simulations.filter(item => matchesSearch(item, "熱轉移過程"));
assert.equal(searched.length, 4);
assert.deepEqual(groupBySubtopic(searched).map(([name]) => name), ["熱轉移過程"], "搜尋後不顯示空的子主題");
assert.equal(simulations.filter(item => matchesSearch(item, "dse問題")).length, 2, "保留試題來源搜尋");
assert.ok(matchesSearch(simulations.find(item => item.href === "./HEAT/gas-laws/index.html"), "boyle"));
assert.deepEqual(groupBySubtopic([]), []);
assert.deepEqual(simulations.map(item => item.href), originalOrder, "分組不可改動原始清單及最新加入項目");
console.log("通過：正式課程分類、主題資料夾、分組及組內排序、搜尋、預覽圖與模擬器連結。");
