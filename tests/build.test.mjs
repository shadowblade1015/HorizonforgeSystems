import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { root, readTree } from '../tools/verify-source.mjs';
import { generate } from '../tools/release.mjs';

test('clean build from another cwd, stale removal, rollback copy and failed validation', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'hfs-build-'));
  try {
    for (const p of ['site', 'tools', 'build.mjs', 'site-source.tar.gz', 'vercel.json']) cpSync(resolve(root, p), resolve(dir, p), { recursive: true });
    const build = () => spawnSync(process.execPath, [resolve(dir, 'build.mjs')], { cwd: tmpdir(), encoding: 'utf8' });
    assert.equal(existsSync(resolve(dir, 'dist')), false);
    let r = build(); assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(readTree(resolve(dir, 'dist')), generate(readTree(resolve(dir, 'site'))).output);
    writeFileSync(resolve(dir, 'dist/stale.txt'), 'retain in rollback');
    r = build(); assert.equal(r.status, 0, r.stderr);
    assert.equal(existsSync(resolve(dir, 'dist/stale.txt')), false);
    const backup = readdirSync(dir).find(p => p.startsWith('.dist-backup-'));
    assert.equal(readFileSync(resolve(dir, backup, 'stale.txt'), 'utf8'), 'retain in rollback');
    const previous = readTree(resolve(dir, 'dist'));
    writeFileSync(resolve(dir, 'site/app.js'), 'function {');
    r = build(); assert.notEqual(r.status, 0);
    assert.deepEqual(readTree(resolve(dir, 'dist')), previous);
    writeFileSync(resolve(dir, '.build.lock'), 'interrupted');
    r = build(); assert.notEqual(r.status, 0);
    assert.deepEqual(readTree(resolve(dir, 'dist')), previous);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
