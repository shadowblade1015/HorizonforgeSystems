// Dependency-free, script-relative build. Never publish unvalidated output.
import { mkdirSync, writeFileSync, renameSync, existsSync, mkdtempSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { generate } from './tools/release.mjs';
import { root, readTree, verify } from './tools/verify-source.mjs';

const lock = resolve(root, '.build.lock');
const fd = openSync(lock, 'wx'); // Reject concurrent builds and interrupted-build ambiguity.
let stage;
try {
  const { output: source } = generate(readTree(resolve(root, 'site')));
  stage = mkdtempSync(resolve(root, '.dist-stage-'));
  for (const [p, bytes] of source) {
    const target = resolve(stage, p);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
  const result = verify(root, { output: stage });
  if (result.errors.length) throw Error(result.errors.join('\n'));
  const output = resolve(root, 'dist');
  const backup = resolve(root, '.dist-backup-' + Date.now() + '-' + process.pid);
  let moved = false;
  if (existsSync(output)) { renameSync(output, backup); moved = true; }
  try { renameSync(stage, output); stage = undefined; }
  catch (error) {
    if (moved) renameSync(backup, output);
    throw error;
  }
  console.log(`Built Horizon Forge: ${result.matching} files in dist/`);
  if (moved) console.log(`Previous output retained: ${backup}`);
} finally {
  closeSync(fd);
  unlinkSync(lock);
  if (stage) console.error(`Unpublished staging retained for inspection: ${stage}`);
}
