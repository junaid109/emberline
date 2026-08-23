// tools/unpack.mjs
//
// Extracts the packaged emberline.zip into dist/ so it can be served and
// play-tested as-is.
//
// The point is to remove drift: `npm run serve` serves the working tree, which
// is NOT what a judge receives. Anything that works only because a stray file
// happens to sit in the repo -- or breaks only once files are laid out the way
// the zip lays them out -- is invisible until the zip itself is what is being
// served. Test the artefact, not the workspace.
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ZIP = resolve('emberline.zip');
const DIST = resolve('dist');

export function unpack(zipPath = ZIP, outDir = DIST) {
  if (!existsSync(zipPath)) {
    throw new Error(`${zipPath} does not exist — run \`npm run package\` first`);
  }

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  if (process.platform === 'win32') {
    execFileSync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${outDir}' -Force`,
    ], { stdio: 'pipe' });
  } else {
    execFileSync('unzip', ['-q', '-o', zipPath, '-d', outDir], { stdio: 'pipe' });
  }

  // The zip is only valid if index.html sits at the top level; if that ever
  // regresses, fail here rather than serving a 404 and blaming the phone.
  const index = resolve(outDir, 'index.html');
  if (!existsSync(index)) {
    throw new Error(`extracted archive has no top-level index.html at ${index}`);
  }
  return outDir;
}

function main() {
  const out = unpack();
  console.log(`unpacked emberline.zip -> ${out}`);
}

// argv[1] is undefined when this module is imported rather than run, so guard
// before converting or the import itself throws.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
