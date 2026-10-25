import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { harness } from './helpers.mjs';

// Small DOM adapter exercises event wiring; layout/download behavior needs a browser.
function uiHarness(raw = null, options = {}) {
  const ids = new Map(), created = [], downloads = [];
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.handlers = {}; this.nodes = new Map(); this.classList = { add() {}, remove() {} }; this.dataset = {}; this.hidden = false; }
    set innerHTML(value) { this.html = value; for (const m of value.matchAll(/id="([^"]+)"/g)) { const n = new Element('parsed'); this.nodes.set(m[1], n); ids.set(m[1], n); } }
    get innerHTML() { return this.html || ''; }
    appendChild(el) { this.children.push(el); return el; }
    append(...els) { this.children.push(...els); }
    remove() { this.removed = true; }
    click() { this.clicked = true; if (this.onclick) this.onclick(); }
    focus() {}
    setAttribute(k,v) { this[k] = v; }
    removeAttribute(k) { delete this[k]; }
    getAttribute(k) { return this[k] ?? null; }
    querySelector(selector) { return selector.startsWith('#') ? this.nodes.get(selector.slice(1)) : null; }
    querySelectorAll() { return []; }
    addEventListener(k, fn) { this.handlers[k] = fn; }
  }
  const app = new Element('app'); ids.set('app',app);
  const document = { createElement(tag) { const el = new Element(tag); created.push(el); return el; }, getElementById: id => ids.get(id), querySelector: s => ids.get(s.slice(1)), querySelectorAll: () => [], body: new Element('body'), addEventListener() {}, removeEventListener() {}, activeElement: null };
  const result = harness(raw, { ...options, globals: { document, addEventListener() {}, requestAnimationFrame: fn => fn(), cancelAnimationFrame() {}, Blob, URL: { createObjectURL(blob) { downloads.push(blob); return 'blob:test'; }, revokeObjectURL() {} } } });
  const es = result.context.ES;
  es.Icons = { icon: () => '' }; es.FX = { motion: () => false }; es.Audio = { play() {}, apply() {} };
  vm.runInContext(readFileSync(new URL('../site/ember-solitaire/js/ui.js', import.meta.url), 'utf8'), result.context);
  return { ...result, UI: es.UI, app, downloads, ids, created };
}

test('persistent status banner shows blocked/failed saves, exposes recovery and clears only after success', () => {
  const { S, UI, app } = uiHarness('{'); S.load(); UI.mountSaveStatus();
  const banner = app.children.at(-1);
  assert.equal(banner.hidden, false); assert.match(banner.children[0].textContent, /protected/i);
  banner.children[1].click();
  const sheet = app.children.at(-1);
  assert.match(sheet.innerHTML, /Save Recovery/); assert.equal(sheet.querySelector('#saveAccept').disabled, true);
  assert.equal(S.importSave('{"v":2,"embers":7}'), true);
  assert.equal(banner.hidden, true);
});

test('recovery controls export the untouched original and require a separate acceptance confirmation', async () => {
  const raw = '{"v":2,"embers":321,"game":{"cols":[]}}';
  const { S, UI, app, downloads } = uiHarness(raw); S.load(); UI.saveRecovery();
  const sheet = app.children.at(-1);
  sheet.querySelector('#saveOriginal').click(); assert.equal(await downloads[0].text(), raw);
  assert.equal(sheet.querySelector('#saveAccept').disabled, false);
  sheet.querySelector('#saveAccept').click();
  assert.equal(S.persistence.blocked, true);
  const confirmation = app.children.at(-1); assert.match(confirmation.innerHTML, /Use recovered progress/);
  confirmation.handlers.click({ target: { closest: s => s === '[data-i]' ? { dataset: { i: '1' } } : null } });
  assert.equal(S.persistence.blocked, false); assert.equal(S.state.embers, 321);
});

test('import file validation rejects invalid data and previews valid data without replacing progress', async () => {
  const { S, UI, app } = uiHarness('{"v":2,"embers":321}'); S.load(); UI.saveRecovery();
  const sheet = app.children.at(-1), input = sheet.querySelector('#saveImport');
  await input.onchange({ target: { files: [{ size: 10, text: async () => '{"v":3}' }], value: 'x' } });
  assert.match(sheet.querySelector('#recoveryMessage').textContent, /Import rejected/); assert.equal(S.state.embers, 321);
  await input.onchange({ target: { files: [{ size: 30, text: async () => '{"v":2,"embers":42}' }], value: 'x' } });
  assert.match(app.children.at(-1).innerHTML, /42 Ember/); assert.equal(S.state.embers, 321);
});
