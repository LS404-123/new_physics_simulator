import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const fontLicense = await readFile(new URL('FONT-LICENSE.txt', import.meta.url), 'utf8');
await build({
  absWorkingDir: import.meta.dirname,
  entryPoints: ['apparatus-3d.mjs'],
  bundle: true, minify: true, format: 'iife',
  outfile: 'apparatus-3d.js', legalComments: 'inline',
  banner: { js: `/* 刻度字型授權：${fontLicense} */` },
});
console.log('已重建比熱容量模擬器的三維裝置。');
