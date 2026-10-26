import { build } from '../specific-heat-errors/node_modules/esbuild/lib/main.js';
import { readFile } from 'node:fs/promises';
const license = await readFile(new URL('../specific-heat-errors/FONT-LICENSE.txt', import.meta.url), 'utf8');
await build({ absWorkingDir: import.meta.dirname, entryPoints: ['apparatus-3d.mjs'], bundle: true, minify: true, format: 'iife', outfile: 'apparatus-3d.js', legalComments: 'inline', banner: { js: `/* 刻度字型授權：${license} */` } });
console.log('已重建雙漏斗三維裝置。');
