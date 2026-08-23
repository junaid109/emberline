// tools/package.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MAX_BYTES = 35 * 1024 * 1024;

// Ceiling on index.html's own size: the game code plus markup should never
// approach this. It exists purely to catch Three.js (or any other large lib)
// having been inlined by an accidental bundle: import, which balloons the
// file by well over a megabyte.
export const MAX_INDEX_HTML_BYTES = 400 * 1024;

// A string that only appears inside Three.js's own internals (its internal
// shader-chunk registry), never in application code that merely calls into
// the THREE global. Verified absent from the current legitimate index.html
// (which references THREE.* APIs like WebGLRenderer but never this symbol),
// and present dozens of times in vendor/three.js. If Three.js were ever
// bundled directly into index.html instead of loaded from ./vendor/three.js,
// this marker would leak into the file and trip the check below.
const EMBEDDED_THREE_MARKER = 'ShaderChunk';

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
  const external = indexHtmlText.match(/["'`(]\s*https?:\/\/[^"'`)\s]+/g);
  if (external) {
    errors.push(`index.html references an external URL: ${external[0].slice(0, 80)}`);
  }

  // Rule: the archive must actually carry Three.js as a vendored file. Without
  // this, a build run before `npm run vendor` produces a zip containing only
  // index.html (and maybe assets) that still passes every other check, while
  // the game itself is a black screen with "THREE is not defined".
  if (!fileNames.some((f) => f === 'vendor/three.js' || f.startsWith('vendor/'))) {
    errors.push('zip must contain a vendor/ directory with vendor/three.js — run `npm run vendor` before packaging');
  }

  // Rule: index.html must load Three.js via a relative <script src>, and must
  // not reference any script/stylesheet via a root-absolute ("/...") or
  // drive-absolute ("C:\..." / "C:/...") path — those resolve differently (or
  // not at all) once the zip is unpacked on a machine other than this one.
  if (!/src\s*=\s*["']\.\/vendor\/three\.js["']/.test(indexHtmlText)) {
    errors.push('index.html must load Three.js via a relative <script src="./vendor/three.js">');
  }
  const absoluteRef = indexHtmlText.match(/(?:src|href)\s*=\s*["'](\/(?!\/)[^"']*|[A-Za-z]:[\\/][^"']*)["']/);
  if (absoluteRef) {
    errors.push(`index.html has a non-relative src/href, which will not resolve after unzipping: ${absoluteRef[0].slice(0, 80)}`);
  }

  // Rule: Three.js must not be embedded directly in index.html. This is the
  // mirror-image failure mode to the missing-vendor rule above: if a source
  // file ever does `import * as THREE from 'three'` instead of using the
  // `/* global THREE */` convention, esbuild's bundler inlines the whole
  // library into the built index.html. Two independent signals catch it so
  // a lucky dodge of one does not slip through.
  if (indexHtmlText.length > MAX_INDEX_HTML_BYTES) {
    errors.push(`index.html is ${(indexHtmlText.length / 1024).toFixed(0)}KB, over the ${MAX_INDEX_HTML_BYTES / 1024}KB limit — Three.js may be embedded instead of vendored`);
  }
  if (indexHtmlText.includes(EMBEDDED_THREE_MARKER)) {
    errors.push(`index.html appears to contain Three.js's own source (found internal marker "${EMBEDDED_THREE_MARKER}") — it must be loaded from ./vendor/three.js, not bundled in`);
  }

  return { ok: errors.length === 0, errors };
}

function listFiles(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? listFiles(p, base) : [relative(base, p).replaceAll('\\', '/')];
  });
}

/**
 * Impure: reads the actual entry list out of a built .zip file on disk, so the
 * validator checks what was really archived rather than a list reconstructed
 * from the source tree. Throws on failure — callers must treat that as a hard
 * failure, never a silent pass.
 * @param {string} zipPath
 * @returns {string[]} entry paths, forward-slashed
 */
export function listZipEntries(zipPath) {
  if (process.platform === 'win32') {
    const script = [
      'Add-Type -AssemblyName System.IO.Compression.FileSystem;',
      `$zip = [System.IO.Compression.ZipFile]::OpenRead('${zipPath}');`,
      '$zip.Entries | ForEach-Object { $_.FullName };',
      '$zip.Dispose();',
    ].join(' ');
    const out = execFileSync('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8' });
    return out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((p) => p.replaceAll('\\', '/'));
  }
  const out = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' });
  return out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((p) => p.replaceAll('\\', '/'));
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

  let names;
  try {
    names = listZipEntries(out);
  } catch (err) {
    console.error('PACKAGE VALIDATION FAILED:');
    console.error(`  - could not read entries from emberline.zip: ${err.message}`);
    process.exit(1);
    return;
  }

  let indexHtmlText;
  try {
    indexHtmlText = readFileSync(join(root, 'index.html'), 'utf8');
  } catch (err) {
    console.error('PACKAGE VALIDATION FAILED:');
    console.error(`  - could not read index.html: ${err.message}`);
    process.exit(1);
    return;
  }

  const result = validateZipContents(names, statSync(out).size, indexHtmlText);

  if (!result.ok) {
    console.error('PACKAGE VALIDATION FAILED:');
    for (const e of result.errors) console.error('  - ' + e);
    process.exit(1);
  }
  console.log(`OK  emberline.zip  ${(statSync(out).size / 1048576).toFixed(2)}MB`);
}

// pathToFileURL (not string concatenation) is required for a correct comparison on
// Windows, where file URLs need a third slash before the drive letter (file:///C:/...).
// argv[1] is undefined when this module is imported rather than run (e.g. `node -e`),
// so guard before converting or the import itself throws.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
