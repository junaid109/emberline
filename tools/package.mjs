// tools/package.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MAX_BYTES = 35 * 1024 * 1024;

/**
 * Pure validator. Takes plain data so it is testable without building a zip.
 * @param {string[]} fileNames  paths inside the zip, forward-slashed
 * @param {number} totalBytes   size of the zip on disk
 * @param {string} indexHtmlText  full text of index.html
 */
export function validateZipContents(fileNames, totalBytes, indexHtmlText) {
  const errors = [];

  if (!fileNames.includes('index.html')) {
    errors.push('index.html must be at the top level of the .zip, not inside a folder');
  }
  if (totalBytes > MAX_BYTES) {
    errors.push(`zip is ${(totalBytes / 1048576).toFixed(1)}MB, over the 35MB limit`);
  }
  const external = indexHtmlText.match(/["'(]\s*https?:\/\/[^"')\s]+/g);
  if (external) {
    errors.push(`index.html references an external URL: ${external[0].slice(0, 80)}`);
  }
  return { ok: errors.length === 0, errors };
}

function listFiles(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? listFiles(p, base) : [relative(base, p).replaceAll('\\', '/')];
  });
}

function main() {
  const root = process.cwd();
  const out = join(root, 'emberline.zip');
  if (existsSync(out)) rmSync(out);

  const parts = ['index.html', 'vendor'].filter((p) => existsSync(join(root, p)));
  if (existsSync(join(root, 'assets'))) parts.push('assets');

  if (process.platform === 'win32') {
    execFileSync('powershell', [
      '-NoProfile', '-Command',
      `Compress-Archive -Path ${parts.map((p) => `'${p}'`).join(',')} -DestinationPath 'emberline.zip' -Force`,
    ], { cwd: root, stdio: 'inherit' });
  } else {
    execFileSync('zip', ['-r', '-q', 'emberline.zip', ...parts], { cwd: root, stdio: 'inherit' });
  }

  const names = ['index.html', ...(existsSync(join(root, 'vendor')) ? listFiles(join(root, 'vendor')).map((f) => `vendor/${f}`) : [])];
  const result = validateZipContents(names, statSync(out).size, readFileSync(join(root, 'index.html'), 'utf8'));

  if (!result.ok) {
    console.error('PACKAGE VALIDATION FAILED:');
    for (const e of result.errors) console.error('  - ' + e);
    process.exit(1);
  }
  console.log(`OK  emberline.zip  ${(statSync(out).size / 1048576).toFixed(2)}MB`);
}

// pathToFileURL (not string concatenation) is required for a correct comparison on
// Windows, where file URLs need a third slash before the drive letter (file:///C:/...).
if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
