import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { archiveFiles, root, verify } from '../tools/verify-source.mjs';

test('read-only source baseline and references', () => {
  const r = verify(); assert.deepEqual(r.errors, []); assert.equal(r.matching, 143); assert.equal(r.precache, 131); assert.equal(r.syntax, 23);
});
test('archive rejects duplicate entries, traversal, checksum damage and truncation', () => {
  const original = gunzipSync(readFileSync(resolve(root, 'site-source.tar.gz')));
  const first = archiveFiles(gzipSync(original)); assert.equal(first.size, 143);
  const size = parseInt(original.subarray(124, 136).toString().replace(/\0/g, '').trim(), 8);
  const end = 512 + Math.ceil(size / 512) * 512;
  assert.throws(() => archiveFiles(gzipSync(Buffer.concat([original.subarray(0, end), original]))), /Duplicate/);
  const damaged = Buffer.from(original); damaged[0] ^= 1;
  assert.throws(() => archiveFiles(gzipSync(damaged)), /header/);
  assert.throws(() => archiveFiles(gzipSync(original.subarray(0, 700))), /Truncated|terminator/);
  const unsafe = Buffer.from(original); unsafe.fill(0, 0, 100); unsafe.write('../bad', 0);
  unsafe.fill(32, 148, 156); const sum = unsafe.subarray(0, 512).reduce((s, b) => s + b, 0);
  unsafe.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii');
  assert.throws(() => archiveFiles(gzipSync(unsafe)), /Unsafe/);
});

test('verifier detects changed, missing, stale, invalid JSON/JS, routes and references without repairing them', async () => {
  const { mkdtempSync, cpSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(resolve(tmpdir(), 'hfs-verifier-'));
  try {
    for (const p of ['site', 'dist', 'site-source.tar.gz', 'build.mjs', 'vercel.json']) cpSync(resolve(root, p), resolve(dir, p), { recursive: true });
    rmSync(resolve(dir, 'dist/about/index.html'));
    rmSync(resolve(dir, 'dist/ember-solitaire/ember_spade.png'));
    writeFileSync(resolve(dir, 'dist/stale.txt'), 'stale');
    writeFileSync(resolve(dir, 'dist/app.js'), 'function {');
    writeFileSync(resolve(dir, 'dist/ember-solitaire/manifest.webmanifest'), '{');
    writeFileSync(resolve(dir, 'dist/contact/index.html'), '<img src="/missing.png">');
    const r = verify(dir);
    for (const prefix of ['Missing: dist/about/index.html', 'Stale: dist/stale.txt', 'Changed: dist/app.js', 'Syntax: dist/app.js', 'JSON:', 'Broken reference:']) assert.ok(r.errors.some(e => e.startsWith(prefix)), prefix);
    assert.ok(r.errors.some(e => e.includes('-> /about/')));
    assert.ok(r.errors.some(e => e.includes('sw.js -> ember_spade.png')));
    assert.ok(r.errors.some(e => e.includes('-> /missing.png')));
    assert.equal(readFileSync(resolve(dir, 'dist/app.js'), 'utf8'), 'function {');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
