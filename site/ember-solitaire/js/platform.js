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
  async function hydrate(key) {
    if (!native) return;
    const r = await call('Preferences', 'get', { key });
    try {
      const local = root.localStorage.getItem(key);
      if (r && r.value) {
        // prefer whichever save is newer
        const a = JSON.parse(r.value), b = local ? JSON.parse(local) : null;
        if (!b || (a.savedAt || 0) >= (b.savedAt || 0)) root.localStorage.setItem(key, r.value);
      } else if (local) {
        await call('Preferences', 'set', { key, value: local });      // first run after migration
      }
    } catch (e) { /* corrupted local copy: Preferences wins */ if (r && r.value) try { root.localStorage.setItem(key, r.value); } catch (e2) {} }
  }
  function persist(key, value) { if (native) call('Preferences', 'set', { key, value }); }

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
  async function init() {
    if (!native) return;
    document.documentElement.classList.add('is-native');
    const App = plugin('App');
    if (App) {
      App.addListener('backButton', onBack);
      App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) { if (ES.Board) ES.Board.setAppActive(false); ES.Store.save(true); ES.Analytics.flushSession(); }
        else { ES.Board && ES.Board.setAppActive(true); ES.Ads && ES.Ads.onResume(); }
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

  ES.Platform = { native, plugin, call, hydrate, persist, haptic, init, minimize, openUrl, onBack };
})(typeof window !== 'undefined' ? window : globalThis);
