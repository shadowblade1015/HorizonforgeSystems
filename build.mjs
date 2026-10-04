// Extract the bundled USTAR source using Node.js only; no dependencies.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve, dirname, sep } from 'node:path';
const bytes = gunzipSync(readFileSync(new URL('./site-source.tar.gz', import.meta.url)));
const root = resolve('dist');
const string = (start, len) => bytes.subarray(start, start + len).toString('utf8').split('\0')[0];
let files = 0;
for (let offset = 0; offset + 512 <= bytes.length;) {
  if (bytes.subarray(offset, offset + 512).every(v => v === 0)) break;
  const name = string(offset, 100), prefix = string(offset + 345, 155);
  const relative = prefix ? `${prefix}/${name}` : name;
  const size = parseInt(string(offset + 124, 12).trim() || '0', 8);
  const type = string(offset + 156, 1);
  const target = resolve(relative);
  if (!Number.isSafeInteger(size) || size < 0 || offset + 512 + size > bytes.length) throw new Error('Invalid archive entry');
  if (target !== root && !target.startsWith(root + sep)) throw new Error('Archive path outside dist');
  if (type === '5') mkdirSync(target, { recursive: true });
  else if (type === '' || type === '0') {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes.subarray(offset + 512, offset + 512 + size)); files++;
  } else throw new Error(`Unsupported entry type: ${type}`);
  offset += 512 + Math.ceil(size / 512) * 512;
}
if (!files) throw new Error('Empty site archive');
console.log(`Built Horizon Forge: ${files} files extracted to dist/`);
