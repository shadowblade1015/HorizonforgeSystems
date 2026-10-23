/* ==========================================================================
   EMBER SOLITAIRE — Boot
   ========================================================================== */
(function (root) {
  'use strict';
  const ES = root.ES;
  const UI = ES.UI, St = ES.Store, M = ES.Manifest;

  async function boot() {
    try { await ES.Platform.hydrate(St.KEY); } catch (e) {}
    St.load();
    UI.mountSaveStatus();
    ES.Platform.init();
    UI.applySettings();
    UI.hydrateIcons(document);
    document.getElementById('btnPause').innerHTML = UI.I('pause');
    document.querySelector('#btnUndo .i-undo').outerHTML = UI.I('undo');
    document.querySelector('#btnHint .i-hint').outerHTML = UI.I('hint');
    document.querySelector('#btnFinish .i-finish').outerHTML = UI.I('sets');
    ES.Board.mount();
    ES.Board.onWin = (g, out) => ES.Ceremony.victory(g, out);
    ES.Board.onStuck = g => ES.Screens.stuckSheet(g);
    ES.Analytics.setKey('build', ES.Build.version + '+' + ES.Build.versionCode);
    // Monetization + remote tuning start in the background and never block play.
    const rc = ES.Analytics.fetchRemoteConfig();
    Promise.race([rc, new Promise(r => setTimeout(r, 2500))]).then(() => ES.Ads.init()).catch(e => ES.Analytics.nonFatal(e, 'ads_boot'));
    document.getElementById('btnPause').onclick = () => { ES.Audio.play('ui'); ES.Screens.pauseMenu(); };
    ES.FX.parallaxInit();
    document.addEventListener('pointerdown', () => ES.Audio.unlock(), { once: true, capture: true });
    document.addEventListener('keydown', () => ES.Audio.unlock(), { once: true, capture: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden) St.save(true); });
    root.addEventListener('pagehide', () => St.save(true));

    // critical preload: branding, current table/back, current environment, current suits
    const s = St.state.settings;
    M.preload([M.branding.emblem, M.envSrc('splash'), M.envSrc('forgeHall'), M.env.pedestal, M.back(s.cardBack), M.tables[s.table].src]);
    if (St.state.game) M.preload(M.cardUrls(St.state.game.suits));

    splash();
    if ('serviceWorker' in navigator && !root.Capacitor && /^https?:/.test(location.protocol) && !/[?&]nosw/.test(location.search)) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  function splash() {
    const st = St.state, first = !st.ftue.splash;
    UI.go('splash', { focus: false });
    const scr = document.getElementById('scr-splash');
    let done = false;
    const next = () => {
      if (done) return; done = true;
      st.ftue.splash = true; St.save();
      const q = new URLSearchParams(location.search);
      if (q.get('screen')) return UI.go(q.get('screen'));
      if (!st.ftue.intro) ES.Tutorial.intro(); else UI.go('home');
    };
    const minMs = ES.FX.motion() ? (first ? 2300 : 1500) : 600;
    setTimeout(next, minMs);
    if (!first) {
      const sk = document.getElementById('splashSkip'); sk.hidden = false;
      scr.addEventListener('pointerdown', next, { once: true });
      document.addEventListener('keydown', function k() { document.removeEventListener('keydown', k); next(); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : globalThis);
