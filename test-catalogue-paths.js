"use strict";
const assert = require("node:assert/strict");
const { existsSync, readFileSync, readdirSync, statSync } = require("node:fs");
const { dirname, extname, resolve, relative } = require("node:path");
const { pathToFileURL, fileURLToPath } = require("node:url");
const { simulations } = require("./simulations.js");

let references = 0;
function checkReference(file, reference) {
  if (/^(?:#|[a-z][\w+.-]*:|\/\/)/i.test(reference)) return;
  const target = fileURLToPath(new URL(reference, pathToFileURL(file)));
  assert.ok(existsSync(target), `${relative(__dirname, file)}：找不到 ${reference}`);
  references++;
}

for (const simulation of simulations) {
  const folder = dirname(resolve(__dirname, simulation.href));
  for (const name of readdirSync(folder)) {
    const file = resolve(folder, name);
    if (!statSync(file).isFile() || !/\.(?:html|m?js)$/.test(name)) continue;
    const source = readFileSync(file, "utf8");
    if (extname(file) === ".html") {
      for (const match of source.matchAll(/<(?:a|link|script|img)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/g)) {
        checkReference(file, match[1]);
        if (/^\.\.\/(?:\.\.\/)?(?:index\.html)?$/.test(match[1])) {
          const target = fileURLToPath(new URL(match[1], pathToFileURL(file)));
          assert.equal(statSync(target).isDirectory() ? resolve(target, "index.html") : target, resolve(__dirname, "index.html"), "返回目錄須指向根目錄首頁");
        }
      }
    }
    if (name !== "apparatus-3d.js") {
      for (const match of source.matchAll(/(?:\bfrom\s+|\b(?:require|import)\s*\(\s*)["'](\.{1,2}\/[^"']+)["']/g)) {
        checkReference(file, match[1]);
      }
    }
  }
}

assert.ok(existsSync(resolve(__dirname, "PhyCompulsory_and_Elective_Part_Revised_Curriculum-20151211C.pdf")));
console.log(`通過：${simulations.length} 個模擬器，共 ${references} 個本機資源、共用模組及目錄連結。`);
