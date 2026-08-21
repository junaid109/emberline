// tools/vendor.mjs
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('vendor', { recursive: true });

await build({
  entryPoints: ['node_modules/three/build/three.module.js'],
  bundle: true,
  format: 'iife',
  globalName: 'THREE',
  minify: false,
  target: 'es2022',
  outfile: 'vendor/three.js',
});

console.log('vendored three -> vendor/three.js');
