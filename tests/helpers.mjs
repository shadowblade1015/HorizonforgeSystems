import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { root } from '../tools/verify-source.mjs';
import { resolve } from 'node:path';
export const plain = x => JSON.parse(JSON.stringify(x));
export function harness(raw = null) {
  const storage = new Map(raw === null ? [] : [['ember.save.v2', raw]]);
  const context = vm.createContext({
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
    setTimeout: () => 1, clearTimeout: () => {},
    Date: class extends Date { static now() { return 1792324800000; } }
  });
  for (const name of ['engine', 'manifest', 'artifacts', 'store']) {
    const p = `site/ember-solitaire/js/${name}.js`;
    const disk = readFileSync(resolve(root, p));
    vm.runInContext(disk.toString(), context, { filename: p, timeout: 1000 });
  }
  return { E: context.ES.Engine, S: context.ES.Store, storage };
}
export const card = (id, rank, suit = 'S', up = true) => ({ id, rank, suit, up });
export function position(E) { const g = E.newGame(1, { seed: 42 }); g.cols = Array.from({ length: 10 }, () => []); g.stock = []; return g; }
export function finalSet(E) {
  const g = position(E); g.completed = g.bestCompleted = 7;
  g.cols[0] = Array.from({ length: 12 }, (_, i) => card('final' + i, 13 - i));
  g.cols[1] = [card('ace', 1)]; return g;
}
