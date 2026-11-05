/* Release/update UI. No player data is stored here and no unsolicited reloads. */
(function (root) {
  'use strict';
  const ES = root.ES = root.ES || {};
  let registration, id, scope, banner, message, update, download, deferred = false, approving = false;
  let releaseHold = () => {}, reloadTarget = null, reloadTimer, reloading = false;
  const supports = worker => { try { return new URL(worker.scriptURL).searchParams.get('emberProtocol') === '1'; } catch (_) { return false; } };
  const text = value => { if (message) message.textContent = value; };
  function rpc(worker, data, timeout = 12000) {
    return new Promise((resolve, reject) => {
      if (!worker) return reject(Error('No installed worker'));
      const channel = new MessageChannel();
      const timer = setTimeout(() => { channel.port1.close(); reject(Error('Worker did not respond')); }, timeout);
      channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data); };
      worker.postMessage(data, [channel.port2]);
    });
  }
  async function hello() {
    for (const worker of new Set([navigator.serviceWorker.controller, registration?.active, registration?.waiting])) if (supports(worker)) {
      try { await rpc(worker, { type: 'HELLO', id }, 1200); } catch (_) { /* Legacy workers have no release protocol. */ }
    }
  }
  function show(value) { text(value); if (banner && !deferred) banner.hidden = false; }
  async function check() {
    if (!registration) return;
    await hello();
    const worker = registration.waiting || navigator.serviceWorker.controller || registration.active;
    if (!supports(worker)) { show('Preparing the offline release. Older tabs can continue playing; check again after installation.'); return; }
    try {
      const status = await rpc(worker, { type: 'STATUS' });
      if (!/^[a-f0-9]{64}$/.test(status.id)) throw Error('Unknown release');
      reloadTarget = status.id !== id || registration.waiting ? status.id : null;
      update.hidden = !reloadTarget; update.disabled = !status.ok || status.legacyClients > 0;
      if (reloadTarget) { deferred = false; show(status.legacyClients > 0 ? 'Close other older game tabs before updating, then check again in Settings. Their progress is not coordinated. Save Recovery remains available.' : 'An update is ready. Update & reload saves your progress first. Other tabs keep their current release; saves between tabs may conflict.'); }
      else if (status.ok) show('Offline ready: one suit, default back/table, fonts and forge screens. Other artwork needs a connection or Download all artwork.');
      else show('Offline files are incomplete or were evicted. Stay online and retry installation; keep recovery exports.');
    } catch (_) { show('Offline installation is not ready. Keep this page open and retry online.'); }
  }
  function unblock(value) {
    approving = false; clearTimeout(reloadTimer); releaseHold(); releaseHold = () => {};
    update.disabled = false; show(value);
  }
  async function finishReload(expected) {
    if (!approving || reloading) return;
    // A historical controller has no message protocol. Wait for takeover;
    // sending it a STATUS port would only time out and cancel this approval.
    if (!supports(navigator.serviceWorker.controller)) return;
    try {
      const status = await rpc(navigator.serviceWorker.controller, { type: 'STATUS' });
      if (status.id !== expected || !status.ok) return;
      if (!ES.Store.save(true) || ES.Store.persistence.blocked || ES.Store.persistence.unsaved) { unblock('Update paused: saving failed. Use Save Recovery or export progress before retrying.'); return; }
      if (!reloading) { reloading = true; location.reload(); }
    } catch (_) { unblock('Update did not complete. Your current game is still open; retry online.'); }
  }
  async function approve() {
    if (approving || !reloadTarget) return false;
    releaseHold = ES.Board?.hold ? ES.Board.hold() : () => {};
    if (!ES.Store.save(true) || ES.Store.persistence.blocked || ES.Store.persistence.unsaved) { unblock('Update blocked: progress could not be saved. Use Save Recovery to retry or export it.'); return false; }
    approving = true; deferred = false; update.disabled = true;
    const expected = reloadTarget;
    reloadTimer = setTimeout(() => unblock('Update timed out. Your current game is still open. Retry when ready.'), 15000);
    try {
      if (!supports(navigator.serviceWorker.controller) && registration.waiting) {
        // The bridge document already runs the waiting bundle through immutable
        // URLs, despite its historical controller. A protected same-bundle
        // reload releases that controller's outstanding streams so it can retire.
        const status = await rpc(registration.waiting, { type: 'STATUS' });
        if (!status.ok || status.id !== id || status.id !== expected || status.legacyClients > 0) { unblock('Close other older tabs and check again before finishing this update.'); return false; }
        if (!ES.Store.save(true) || ES.Store.persistence.blocked || ES.Store.persistence.unsaved) { unblock('Update paused: saving failed. Use Save Recovery before retrying.'); return false; }
        registration.waiting.postMessage({ type: 'ACTIVATE', id: expected });
        reloading = true; location.reload(); return true;
      }
      if (registration.waiting) {
        const result = await rpc(registration.waiting, { type: 'ACTIVATE', id: expected });
        if (!result.ok) { unblock(result.reason); return false; }
      }
      await finishReload(expected); // Also handles an update activated by another tab.
      return true;
    } catch (_) { unblock('Update unavailable. Your saved and in-memory progress remain intact. Retry online.'); return false; }
  }
  function defer() { if (approving) return; deferred = true; banner.hidden = true; }
  async function downloadAll() {
    if (!registration || download.disabled) return;
    download.disabled = true; show('Downloading optional artwork. Keep this page open.');
    try {
      // Ask the page's release worker only; another release must never fill it.
      const worker = navigator.serviceWorker.controller, status = await rpc(worker, { type: 'STATUS' });
      if (status.id !== id) throw Error('Update this tab first');
      const result = await rpc(worker, { type: 'DOWNLOAD' }, 180000);
      show(result.ok ? 'All artwork downloaded for this release. All suit modes, backs and tables are available offline.' : 'Some optional artwork could not be stored. Core offline play is unchanged. Reconnect and retry; storage may be full.');
    } catch (_) { show('Optional download did not complete. Reconnect and retry, or update this tab first. Core files were not cleared.'); }
    finally { download.disabled = false; }
  }
  async function repair() {
    try {
      const worker = navigator.serviceWorker.controller, status = await rpc(worker, { type: 'STATUS' });
      if (status.id !== id) { show('Update this tab before repairing offline files.'); return; }
      show('Repairing offline files. Keep this page open.');
      const result = await rpc(worker, { type: 'REPAIR' }, 180000);
      if (!result.ok) throw Error('Repair failed');
      await check();
    } catch (_) { show('Offline repair could not complete. Existing cached files and player progress were retained. Reconnect and retry.'); }
  }
  async function start() {
    id = document.querySelector('meta[name="ember-release"]')?.content;
    scope = document.querySelector('meta[name="ember-scope"]')?.content;
    if (!id || !scope || !('serviceWorker' in navigator) || root.Capacitor || !/^https?:/.test(location.protocol) || /[?&]nosw/.test(location.search)) return;
    banner = document.createElement('aside'); banner.className = 'offline-status'; banner.hidden = true; banner.setAttribute('aria-label', 'Offline and updates');
    message = document.createElement('span'); message.setAttribute('role', 'status');
    const button = (label, action) => { const b = document.createElement('button'); b.className = 'btn'; b.textContent = label; b.onclick = action; banner.appendChild(b); return b; };
    banner.appendChild(message); update = button('Update & reload', approve); update.hidden = true;
    download = button('Download all artwork', downloadAll);
    button('Repair offline files', repair);
    button('Save Recovery', () => ES.UI.saveRecovery()); button('Later', defer);
    document.getElementById('app').appendChild(banner);
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (approving) finishReload(reloadTarget); else check(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && registration) hello(); });
    try {
      registration = await navigator.serviceWorker.register(new URL(scope + 'sw.js?emberProtocol=1', location.origin), { scope, updateViaCache: 'none' });
      registration.addEventListener('updatefound', () => { const worker = registration.installing; worker.addEventListener('statechange', () => { if (worker.state === 'installed') check(); if (worker.state === 'redundant') show('Offline installation failed. The previous release remains available; reconnect and retry.'); }); });
      await check();
    } catch (_) { show('Offline installation failed or storage is unavailable. Online play can continue; retain recovery exports.'); }
  }
  async function reopen() { deferred = false; if (banner) banner.hidden = false; try { await registration?.update(); } catch (_) { show('Update check unavailable offline. Existing cached play is unchanged.'); } await check(); }
  ES.Offline = { start, check: reopen, approve, defer, downloadAll, repair, get id() { return id; }, get target() { return reloadTarget; } };
})(typeof window !== 'undefined' ? window : globalThis);
