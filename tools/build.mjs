// tools/build.mjs
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const result = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  minify: false,          // rules require readable, unminified game code
  target: 'es2022',
  write: false,
  legalComments: 'inline',
});

const code = result.outputFiles[0].text;
const template = readFileSync('tools/index.template.html', 'utf8');

if (!template.includes('/*__GAME_CODE__*/')) {
  throw new Error('injection marker missing from tools/index.template.html');
}

// Function replacer avoids `$&` and friends being treated as replacement patterns.
writeFileSync('index.html', template.replace('/*__GAME_CODE__*/', () => code));
console.log(`built index.html  ${(code.length / 1024).toFixed(1)}KB of game code`);
