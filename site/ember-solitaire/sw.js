/* Ember release protocol v1. Generated RELEASE binds every cacheable byte. */
'use strict';
const RELEASE = null; // BUILD_RELEASE
const PREFIX = 'ember-solitaire:' + encodeURIComponent(self.registration.scope) + ':release-v1:';
const META = PREFIX + 'clients', CACHE = PREFIX + RELEASE.id;
const marker = new URL('__ready', self.registration.scope).href;
const catalog = new URL('__catalog', self.registration.scope).href;
const pinURL = id => new URL('__client/' + encodeURIComponent(id), self.registration.scope).href;
const pendingURL = new URL('__pending', self.registration.scope).href;
const activeURL = new URL('__active', self.registration.scope).href;
const owned = url => url.origin === new URL(self.registration.scope).origin && url.pathname.startsWith(new URL(self.registration.scope).pathname);
const unavailable = (status = 503) => new Response(status === 404 ? 'This game route does not exist.' : 'This content is unavailable offline. Reconnect and retry.', { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
const hex = bytes => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
async function checkedFetch(url, entry) {
  const abort = new AbortController(), timeout = setTimeout(() => abort.abort(), 4000);
  try {
    const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: abort.signal });
    if (response.status !== 200 || response.type === 'opaque' || response.type === 'opaqueredirect' || response.redirected) throw Error('Unsuitable response');
    const bytes = await response.clone().arrayBuffer();
    if (entry && (bytes.byteLength !== entry.bytes || hex(await crypto.subtle.digest('SHA-256', bytes)) !== entry.sha256)) throw Error('Release content mismatch');
    return response;
  } finally { clearTimeout(timeout); }
}
async function windows() { return (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).filter(c => owned(new URL(c.url))); }
async function pin(client, id) {
  if (!client || !/^[a-f0-9]{64}$/.test(id)) return;
  await (await caches.open(META)).put(pinURL(client), new Response(id));
}
async function unknownClients(except) {
  const meta = await caches.open(META); let count = 0;
  for (const client of await windows()) if (client.id !== except) {
    const record = await meta.match(pinURL(client.id));
    if (!record || !/^[a-f0-9]{64}$/.test(await record.text())) count++;
  }
  return count;
}
async function retire() {
  // Snapshot candidates before reading protection metadata. A cache created
  // during this pass must never be deleted using an older keep-set.
  const candidates = await caches.keys();
  const live = await windows(), meta = await caches.open(META), keep = new Set([RELEASE.id]);
  let unknown = false;
  const pending = await meta.match(pendingURL);
  if (pending) keep.add(await pending.text());
  const active = await meta.match(activeURL);
  if (active) keep.add(await active.text());
  for (const client of live) {
    const record = await meta.match(pinURL(client.id));
    if (record) keep.add(await record.text()); else unknown = true;
  }
  const liveKeys = new Set(live.map(c => pinURL(c.id)));
  for (const req of await meta.keys()) if (![pendingURL, activeURL].includes(req.url) && !liveKeys.has(req.url)) await meta.delete(req);
  if (!unknown) for (const name of candidates) {
    const id = name.slice(PREFIX.length);
    if (name.startsWith(PREFIX) && /^[a-f0-9]{64}$/.test(id) && !keep.has(id)) await caches.delete(name);
  }
  // Scoped pre-3F caches remain read-only migration evidence, never deleted.
}
async function install() {
  const existing = await cacheRelease(RELEASE.id);
  if (existing) {
    // Repair partial eviction without destroying the other valid cached files.
    for (const entry of RELEASE.files.filter(f => f.core)) {
      const url = new URL(RELEASE.base + entry.path, self.registration.scope).href;
      const hit = await existing.cache.match(url);
      if (hit) { if (hit.body) void hit.body.cancel().catch(() => {}); }
      else await existing.cache.put(url, await checkedFetch(url, entry));
    }
    return;
  }
  await retire();
  const names = (await caches.keys()).filter(n => n.startsWith(PREFIX) && /^[a-f0-9]{64}$/.test(n.slice(PREFIX.length)));
  if (!names.includes(CACHE) && names.length >= 4) throw Error('Close old game tabs before installing another release');
  let cache;
  try {
    await (await caches.open(META)).put(pendingURL, new Response(RELEASE.id));
    // Publish protection before making the candidate visible to retirement.
    cache = await caches.open(CACHE);
    await cache.delete(marker);
    for (const entry of RELEASE.files.filter(f => f.core)) {
      const url = new URL(RELEASE.base + entry.path, self.registration.scope).href;
      await cache.put(url, await checkedFetch(url, entry));
    }
    await cache.put(catalog, new Response(JSON.stringify(RELEASE)));
    await cache.put(marker, new Response(RELEASE.id));
  } catch (error) {
    await caches.delete(CACHE);
    const meta = await caches.open(META), pending = await meta.match(pendingURL);
    if (pending && await pending.text() === RELEASE.id) await meta.delete(pendingURL);
    throw error;
  }
}
self.addEventListener('install', event => event.waitUntil(install()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  await self.clients.claim(); // Keep existing pages on their immutable release; no automatic reload.
  const meta = await caches.open(META), pending = await meta.match(pendingURL);
  await meta.put(activeURL, new Response(RELEASE.id));
  if (pending && await pending.text() === RELEASE.id) await meta.delete(pendingURL);
  await retire();
})()));
async function cacheRelease(id) {
  const name = PREFIX + id;
  if (!(await caches.keys()).includes(name)) return null;
  const cache = await caches.open(name);
  const ready = await cache.match(marker);
  if (!ready || await ready.text() !== id) return null;
  const response = await cache.match(catalog);
  if (!response) return null;
  const data = await response.json();
  return data.id === id ? { cache, data } : null;
}
async function asset(id, path, event) {
  let stored;
  try { stored = await cacheRelease(id); } catch (_) { /* Online verified bytes can still be used. */ }
  const data = stored?.data || (id === RELEASE.id ? RELEASE : null);
  if (!data) return unavailable();
  const entry = data.files.find(f => f.path === path);
  if (!entry) return unavailable(404);
  const url = new URL(data.base + path, self.registration.scope).href;
  let hit;
  try { hit = await stored?.cache.match(url); } catch (_) { /* Read denied: use checked network. */ }
  if (hit && hit.status === 200 && hit.type !== 'opaque') return hit;
  try {
    const response = await checkedFetch(url, entry);
    if (stored) {
      const write = stored.cache.put(url, response.clone());
      if (event) event.waitUntil(write.catch(() => {})); else await write;
    } else if (!event) return unavailable(); // Downloads must acknowledge durable storage.
    return response;
  } catch { return unavailable(); }
}
self.addEventListener('fetch', event => {
  const req = event.request, url = new URL(req.url);
  if (req.method !== 'GET' || !owned(url)) return;
  const relative = url.pathname.slice(new URL(self.registration.scope).pathname.length);
  if (relative === 'sw.js') return;
  const immutable = relative.match(/^_releases\/([a-f0-9]{64})\/(.+)$/);
  if (immutable) {
    event.respondWith(asset(immutable[1], immutable[2], event).catch(() => unavailable()));
    if (req.mode === 'navigate' && event.resultingClientId) event.waitUntil(pin(event.resultingClientId, immutable[1]).catch(() => {}));
    return;
  }
  if (req.mode === 'navigate') {
    if (!['', 'index.html', 'privacy.html'].includes(relative)) { event.respondWith(Promise.resolve(unavailable(404))); return; }
    event.respondWith(asset(RELEASE.id, relative === 'privacy.html' ? relative : 'index.html', event).catch(() => unavailable()));
    if (event.resultingClientId) event.waitUntil(pin(event.resultingClientId, RELEASE.id).catch(() => {}));
    return;
  }
  event.respondWith((async () => {
    // Preserve exact cached unversioned dependencies requested by legacy tabs.
    const legacyPrefix = 'ember-solitaire:' + encodeURIComponent(self.registration.scope) + ':';
    for (const name of await caches.keys()) if (name.startsWith(legacyPrefix) && !name.startsWith(PREFIX)) {
      const hit = await (await caches.open(name)).match(req);
      if (hit && hit.status === 200 && hit.type !== 'opaque') return hit;
    }
    if (relative === 'release.json') return new Response(JSON.stringify(RELEASE), { headers: { 'Content-Type': 'application/json' } });
    return asset(RELEASE.id, relative, event);
  })().catch(() => unavailable()));
});
self.addEventListener('message', event => {
  const data = event.data || {}, reply = value => event.ports[0]?.postMessage(value);
  if (!event.source || !owned(new URL(event.source.url))) return;
  event.waitUntil((async () => {
    if (data.type === 'HELLO') { await pin(event.source.id, data.id); await retire(); reply({ ok: true, id: RELEASE.id }); return; }
    if (data.type === 'STATUS') {
      const stored = await cacheRelease(RELEASE.id);
      let ok = !!stored, artworkOk = !!stored;
      if (stored) for (const f of RELEASE.files) {
        const hit = await stored.cache.match(new URL(RELEASE.base + f.path, self.registration.scope).href);
        if (!hit || hit.status !== 200 || hit.type === 'opaque') { if (f.core) ok = false; else artworkOk = false; }
        if (hit) if (hit.body) void hit.body.cancel().catch(() => {});
      }
      reply({ ok, artworkOk, id: RELEASE.id, legacyClients: await unknownClients(event.source.id) }); return;
    }
    if (data.type === 'RETIRE') { await retire(); reply({ ok: true }); return; }
    if (data.type === 'REPAIR') { await install(); reply({ ok: true, id: RELEASE.id }); return; }
    if (data.type === 'ACTIVATE') {
      if (data.id !== RELEASE.id) { reply({ ok: false, reason: 'A different update is waiting. Retry.' }); return; }
      if (await unknownClients(event.source.id)) { reply({ ok: false, reason: 'Close other older game tabs before updating. Their progress is not coordinated.' }); return; }
      // Acknowledge the native request, then let the page wait for ownership.
      await self.skipWaiting(); reply({ ok: true, id: RELEASE.id, action: 'ACTIVATE' }); return;
    }
    if (data.type === 'DOWNLOAD') {
      let failed = 0;
      for (const entry of RELEASE.files.filter(f => !f.core)) if ((await asset(RELEASE.id, entry.path)).status !== 200) failed++;
      reply({ ok: failed === 0, failed });
    }
  })().catch(() => reply({ ok: false, reason: 'Offline storage unavailable. Keep this page open and retry online.' })));
});
