// tools/serve.mjs
//
// Static file server for play-testing. Binds to every interface, not just
// loopback, and prints the LAN URL, because the only test that means anything
// for a portrait mobile game is the one taken on a phone.
//
//   node tools/serve.mjs              serve the working tree (fast iteration)
//   node tools/serve.mjs --dir dist   serve the extracted zip (what a judge gets)
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';
import { injectShim, parseShot, SHOT_ROUTE, HARNESS_ROUTE } from './harness.mjs';

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json',
};

const dirFlag = process.argv.indexOf('--dir');
const ROOT = resolve(dirFlag !== -1 ? process.argv[dirFlag + 1] : process.cwd());
const PORT = Number(process.env.PORT ?? 8080);

// Opt-in, and off by default. The harness exposes a route that writes files,
// which has no business being reachable on a server anyone might leave running
// while testing from a phone on a shared network.
const HARNESS = process.argv.includes('--harness');
const SHOT_DIR = resolve('.shots');

if (!existsSync(join(ROOT, 'index.html'))) {
  console.error(`no index.html in ${ROOT} — run \`npm run build\` (or \`npm run unpack\`) first`);
  process.exit(1);
}

function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
}

createServer(async (req, res) => {
  const route = req.url.split('?')[0];

  if (HARNESS && req.method === 'POST' && route === SHOT_ROUTE) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    try {
      const { name, bytes } = parseShot(Buffer.concat(chunks).toString('utf8'));
      await mkdir(SHOT_DIR, { recursive: true });
      const out = join(SHOT_DIR, name);
      await writeFile(out, bytes);
      console.log(`shot -> ${out} (${(bytes.length / 1024).toFixed(0)}KB)`);
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end(out);
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'text/plain' }).end(String(err.message));
    }
    return;
  }

  if (HARNESS && route === HARNESS_ROUTE) {
    try {
      const html = await readFile(join(ROOT, 'index.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
      res.end(injectShim(html));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' }).end(String(err.message));
    }
    return;
  }

  const rel = normalize(decodeURIComponent(route)).replace(/^([/\\])+/, '');
  const path = join(ROOT, rel === '' ? 'index.html' : rel);
  if (!path.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(path);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream',
      // Phones cache aggressively; a stale index.html after a rebuild wastes
      // a whole test cycle chasing a bug that is already fixed.
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(PORT, () => {
  console.log(`serving ${ROOT}`);
  console.log(`  local   http://localhost:${PORT}`);
  for (const ip of lanAddresses()) {
    console.log(`  phone   http://${ip}:${PORT}   (same Wi-Fi)`);
  }
  if (HARNESS) console.log(`  harness http://localhost:${PORT}${HARNESS_ROUTE}   (dev capture)`);
});
