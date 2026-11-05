/* ==========================================================================
   EMBER SOLITAIRE — Native platform bridge (Capacitor 8)
   Every call is optional: on the web, or when a plugin is missing, the game
   keeps working with browser fallbacks. Nothing here touches game rules.
   ========================================================================== */
(function (root) {
  'use strict';
  const ES = root.ES = root.ES || {};
  const Cap = root.Capacitor;
  const native = !!(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform());
  const cache = {};

  function plugin(name) {
    if (!native) return null;
    if (cache[name] !== undefined) return cache[name];
    let p = null;
    try {
      const avail = typeof Cap.isPluginAvailable === 'function' ? Cap.isPluginAvailable(name) : true;
      if (avail) p = (typeof Cap.registerPlugin === 'function' ? Cap.registerPlugin(name) : null) || (Cap.Plugins && Cap.Plugins[name]) || null;
    } catch (e) { p = null; }
    return (cache[name] = p);
  }
  async function call(name, method, args) {
    const p = plugin(name); if (!p || typeof p[method] !== 'function') return undefined;
    try { return await p[method](args); } catch (e) { ES.Analytics && ES.Analytics.nonFatal(e, name + '.' + method); return undefined; }
  }

  /* ---------- storage: Preferences survives WebView data eviction ---------- */
  // The Store owns profile validation and writer authority. Preferences is an
  // ordered acknowledged mirror, never a timestamp-based profile selector.
  let writes = Promise.resolve(true), hydrated = false, expectedNative = null;
  async function required(method, args) {
    const p = plugin('Preferences');
    if (!p || typeof p[method] !== 'function') throw Error('Native Preferences unavailable');
    return p[method](args);
  }
  async function hydrate(key) {
    if (!native || !ES.Store?.ownsWriter) return false;
    try {
      const r = await required('get', { key });
      expectedNative = r?.value ?? null;
      // Restore raw companions as recovery copies, never merge player profiles.
      const keys = await required('keys');
      for (const copyKey of keys.keys || []) if (copyKey.startsWith(key + '.')) {
        const raw = (await required('get', { key: copyKey }))?.value;
        if (raw == null) continue;
        const existing = root.localStorage.getItem(copyKey);
        if (existing === raw) continue;
        const destination = existing === null ? copyKey : key + '.recovery.native.' + Date.now() + '.' + Math.random().toString(16).slice(2);
        root.localStorage.setItem(destination, raw);
        if (root.localStorage.getItem(destination) !== raw) throw Error('Native recovery copy could not be preserved');
      }
      const local = root.localStorage.getItem(key);
      if (expectedNative !== null) ES.Store.inspectImport(expectedNative);
      if (expectedNative !== null && local !== null && expectedNative !== local) throw Error('Native and browser saves differ; review whole recovery copies');
      if (expectedNative !== null && local === null && !ES.Store.restoreNative(expectedNative)) throw Error('Native save cannot be restored safely');
      hydrated = true;
      if (expectedNative === null && local !== null) return await persist(key, local);
      return true;
    } catch (e) { ES.Store.nativeFailure(expectedNative, e.message); return false; }
  }
  function persist(key, value, copies = {}) {
    if (!native) return Promise.resolve(true);
    writes = writes.then(async () => {
      try {
        if (!hydrated || !ES.Store.ownsWriter) throw Error('Native save has no validated owner');
        ES.Store.inspectImport(value);
        const current = (await required('get', { key }))?.value ?? null;
        if (current !== expectedNative) { ES.Store.nativeFailure(current, 'Native save changed; original protected'); return false; }
        // Preserve backup and recovery values before committing the primary.
        // A failed companion write leaves the prior native primary intact.
        for (const [copyKey, raw] of Object.entries(copies)) {
          if (!copyKey.startsWith(key + '.')) throw Error('Invalid game recovery key');
          const old = (await required('get', { key: copyKey }))?.value ?? null;
          if (old !== null && old !== raw) {
            const recovery = key + '.recovery.native.' + Date.now() + '.' + Math.random().toString(16).slice(2);
            await required('set', { key: recovery, value: old });
          }
          await required('set', { key: copyKey, value: raw });
        }
        if (!ES.Store.ownsWriter) throw Error('Native writer ownership was released');
        await required('set', { key, value });
        if ((await required('get', { key }))?.value !== value) throw Error('Native write could not be verified');
        expectedNative = value;
        return true;
      } catch (e) { ES.Store.nativeFailure(null, e.message); return false; }
    });
    return writes;
  }
  function flush() { return writes; }

  /* ---------- haptics ------------------------------------------------------ */
  function haptic(pattern) {
    const H = plugin('Haptics');
    if (H) {
      const style = Array.isArray(pattern) ? (pattern.length > 2 ? 'HEAVY' : 'MEDIUM') : (pattern >= 14 ? 'MEDIUM' : 'LIGHT');
      call('Haptics', 'impact', { style });
      return true;
    }
    return false;
  }

  /* ---------- lifecycle, back button, chrome ------------------------------ */
  function topOverlay() { const o = document.querySelectorAll('.overlay'); return o[o.length - 1] || null; }
  function onBack() {
    const ov = topOverlay();
    if (ov) { const x = ov.querySelector('.sheet-x'); if (x) x.click(); return; }
    if (document.querySelector('.ceremony')) {                 // ceremonies: back = their primary action
      const b = document.querySelector('.ceremony .btn-primary, .ceremony #tfSkip'); if (b && b.offsetParent) b.click(); return;
    }
    const cur = ES.UI.current;
    if (cur === 'game') { ES.Screens.pauseMenu(); return; }
    if (cur === 'home' || cur === 'splash' || cur === 'intro') { call('App', 'minimizeApp'); return; }
    ES.UI.back('home');
  }
  let initialized = false;
  async function init() {
    if (!native || initialized) return;
    initialized = true;
    document.documentElement.classList.add('is-native');
    const App = plugin('App');
    if (App) {
      const listen = (name, fn) => { try { Promise.resolve(App.addListener(name, fn)).catch(e => ES.Analytics?.nonFatal(e, 'App.' + name)); } catch (e) { ES.Analytics?.nonFatal(e, 'App.' + name); } };
      listen('backButton', onBack);
      listen('appStateChange', ({ isActive }) => {
        if (!isActive) { if (ES.Board) ES.Board.setAppActive(false); void ES.Store.flushSave(); ES.Audio?.suspend(true); ES.Analytics.flushSession(); }
        else { ES.Board && ES.Board.setAppActive(true); ES.Audio?.suspend(false); ES.Ads && ES.Ads.onResume(); }
      });
    }
    call('StatusBar', 'setStyle', { style: 'DARK' });
    call('StatusBar', 'setBackgroundColor', { color: '#090B0D' });
    // phones stay portrait; tablets (shortest side ≥ 600dp) may rotate
    if (Math.min(root.screen.width, root.screen.height) < 600) call('ScreenOrientation', 'lock', { orientation: 'portrait' });
    setTimeout(() => call('SplashScreen', 'hide', { fadeOutDuration: 200 }), 60);
  }
  async function minimize() { return call('App', 'minimizeApp'); }
  async function openUrl(url) {
    // Capacitor routes navigation to external hosts to the system browser.
    try { root.open(url, '_blank'); } catch (e) { location.href = url; }
  }

  ES.Platform = { native, plugin, call, hydrate, persist, flush, haptic, init, minimize, openUrl, onBack };
})(typeof window !== 'undefined' ? window : globalThis);
