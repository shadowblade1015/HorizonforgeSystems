import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { generate } from './release.mjs';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const hash = b => createHash('sha256').update(b).digest('hex');
export function archiveFiles(buffer) {
  const bytes = gunzipSync(buffer), files = new Map(), names = new Set();
  const str = (o, n) => bytes.subarray(o, o + n).toString().split('\0')[0];
  let o = 0, ended = false;
  while (o + 512 <= bytes.length) {
    const header = bytes.subarray(o, o + 512);
    if (header.every(x => x === 0)) { ended = true; break; }
    const octal = (s) => { if (!/^[0-7]+$/.test(s.trim())) throw Error('Invalid tar number'); return parseInt(s.trim(), 8); };
    const size = octal(str(o + 124, 12)), checksum = octal(str(o + 148, 8));
    const actual = header.reduce((s, x, i) => s + (i >= 148 && i < 156 ? 32 : x), 0);
    if (actual !== checksum || str(o + 257, 6) !== 'ustar') throw Error('Invalid USTAR header');
    const prefix = str(o + 345, 155), name = (prefix ? prefix + '/' : '') + str(o, 100);
    const clean = name.replace(/\/$/, '');
    if (!clean.startsWith('dist') || (clean !== 'dist' && !clean.startsWith('dist/')) || clean.includes('\\') || clean.split('/').some(p => p === '..' || p === '.')) throw Error('Unsafe archive path: ' + name);
    if (names.has(clean)) throw Error('Duplicate archive entry: ' + name);
    names.add(clean);
    if (!Number.isSafeInteger(size) || o + 512 + Math.ceil(size / 512) * 512 > bytes.length) throw Error('Truncated archive');
    const type = str(o + 156, 1);
    if (type === '' || type === '0') files.set(clean, bytes.subarray(o + 512, o + 512 + size));
    else if (type !== '5') throw Error('Unsupported tar entry: ' + name);
    o += 512 + Math.ceil(size / 512) * 512;
  }
  if (!ended || bytes.subarray(o).some(x => x !== 0) || !files.size) throw Error('Invalid archive terminator');
  return files;
}
export function readTree(directory) {
  const files = new Map();
  function walk(relative = '') {
    const folder = resolve(directory, relative), info = lstatSync(folder);
    if (!info.isDirectory() || info.isSymbolicLink()) throw Error('Not a regular directory: ' + folder);
    for (const name of readdirSync(folder).sort()) {
      const p = relative ? relative + '/' + name : name, stat = lstatSync(resolve(directory, p));
      if (stat.isSymbolicLink()) throw Error('Symlink: ' + p);
      if (stat.isDirectory()) walk(p);
      else if (stat.isFile()) files.set(p, readFileSync(resolve(directory, p)));
      else throw Error('Special file: ' + p);
    }
  }
  walk();
  if (!files.size) throw Error('Empty source/output tree: ' + directory);
  return files;
}
export function verify(base = root, { output = resolve(base, "dist") } = {}) {
  const errors = [], archive = readFileSync(resolve(base, 'site-source.tar.gz')), historical = archiveFiles(archive);
  if (hash(archive) !== 'e6c378cab4ef0d92b122ec4f725a2a728bb1001e002b022755e1743e53f84291') errors.push('Historical archive hash changed');
  const source = readTree(resolve(base, 'site')), generated = generate(source);
  const files = new Map([...generated.output].map(([p, b]) => ['dist/' + p, b]));
  const disk = new Map([...readTree(output)].map(([p, b]) => ['dist/' + p, b]));
  const diskPath = p => resolve(output, p.slice(5));
  let matching = 0;
  for (const [p, bytes] of files) {
    if (!disk.has(p)) errors.push('Missing: ' + p);
    else if (!bytes.equals(disk.get(p))) errors.push('Changed: ' + p);
    else matching++;
  }
  for (const p of disk.keys()) if (!files.has(p)) errors.push('Stale: ' + p);
  let syntax = 0, json = 0, references = 0;
  function reference(from, ref) {
    ref = ref.trim().replace(/&amp;/g, '&');
    if (!ref || /^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(ref)) return;
    try {
      const origin = 'https://local.invalid/' + from.slice(5);
      const baseHref = from.endsWith('.html') ? disk.get(from)?.toString().match(/<base href="([^"]+)"/)?.[1] : null;
      const url = new URL(ref, baseHref ? new URL(baseHref, origin) : origin);
      let p = 'dist' + decodeURIComponent(url.pathname);
      if (p.endsWith('/')) p += 'index.html';
      if (!disk.has(p) && disk.has(p + '/index.html')) p += '/index.html';
      references++;
      if (!disk.has(p)) errors.push(`Broken reference: ${from} -> ${ref}`);
    } catch { errors.push(`Invalid reference: ${from} -> ${ref}`); }
  }
  for (const [p, bytes] of disk) {
    const text = bytes.toString();
    if (p.endsWith('.js')) {
      const r = spawnSync(process.execPath, ['--check', diskPath(p)], { encoding: 'utf8' });
      syntax++; if (r.status !== 0) errors.push(`Syntax: ${p}: ${r.stderr || r.error}`);
    }
    if (/\.(json|webmanifest)$/.test(p)) {
      json++; try { const data = JSON.parse(text); if (p.endsWith('.webmanifest')) { for (const i of data.icons || []) reference(p, i.src); if (data.start_url) reference(p, data.start_url); } } catch (e) { errors.push(`JSON: ${p}: ${e.message}`); }
    }
    if (/\.(html|css)$/.test(p)) {
      for (const m of text.matchAll(/\b(?:src|href|poster|action)\s*=\s*["']([^"']+)["']/gi)) reference(p, m[1]);
      for (const m of text.matchAll(/url\(\s*["']?([^)'"\s]+)["']?\s*\)/gi)) reference(p, m[1]);
    }
    if (p.endsWith('.js') && !p.endsWith('/sw.js')) {
      // Literal browser asset paths; dynamic card paths are enumerated below.
      for (const m of text.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/["']((?:\.?\.?\/|assets\/|js\/|css\/)[^"'\n]+\.(?:js|css|webp|png|woff2|html|webmanifest))["']/g)) {
        reference(/^dist\/ember-solitaire\/(?:_releases\/[a-f0-9]{64}\/)?js\//.test(p) && !p.endsWith('stuck-worker.js') ? p.replace(/js\/[^/]+$/, 'index.html') : p, m[1]);
      }
    }
  }
  json++; try { JSON.parse(readFileSync(resolve(base, 'vercel.json'), 'utf8')); } catch (e) { errors.push('JSON: vercel.json: ' + e.message); }
  const buildCheck = spawnSync(process.execPath, ['--check', resolve(base, 'build.mjs')], { encoding: 'utf8' });
  syntax++; if (buildCheck.status !== 0) errors.push('Syntax: build.mjs');
  const precache = generated.release.files.filter(f => f.core).length;
  for (const entry of generated.release.files) reference('dist/ember-solitaire/sw.js', generated.release.base + entry.path);
  const context = vm.createContext({});
  vm.runInContext(disk.get('dist/ember-solitaire/js/manifest.js').toString(), context, { timeout: 1000 });
  for (const s of ['S', 'H', 'D', 'C']) for (let r = 1; r <= 13; r++) for (const hi of [false, true]) reference('dist/ember-solitaire/index.html', context.ES.Manifest.card(r, s, hi));
  const routes = ['/', '/about/', '/contact/', '/portfolio/', '/services/', '/tools/', '/ember-solitaire/', '/ember-solitaire/index.html', '/ember-solitaire/privacy.html'];
  for (const r of routes) reference('dist/index.html', r);
  const inventory = [...files].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([path, b]) => ({ path, bytes: b.length, sha256: hash(b) }));
  const sourceHashes = Object.fromEntries(['build.mjs', 'vercel.json'].map(p => [p, hash(readFileSync(resolve(base, p)))]));
  return { sourceHashes, archiveSha256: hash(archive), inventorySha256: hash(JSON.stringify(inventory)), matching, archiveFiles: historical.size, release: generated.release.id, coreBytes: generated.release.files.filter(f=>f.core).reduce((n,f)=>n+f.bytes,0), sourceFiles: source.size, baselineMatching: [...historical].filter(([p, b]) => source.get(p.slice(5))?.equals(b)).length, extractedFiles: disk.size, syntax, json, references, precache, routes: routes.length, errors, inventory };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const result = verify(); console.log(JSON.stringify(result, null, 2)); if (result.errors.length) process.exitCode = 1; }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
