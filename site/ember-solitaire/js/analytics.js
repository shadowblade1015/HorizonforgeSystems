/* ==========================================================================
   EMBER SOLITAIRE — Analytics, crash reporting and Remote Config
   Firebase is used only in native builds that were compiled with a
   google-services.json (ES.Build.firebase). Everywhere else events go to an
   in-memory ring buffer (inspect with ES.Analytics.recent()) so tests and the
   web build can verify the event stream without sending anything.

   Event taxonomy (snake_case, ≤40 chars, ≤25 params — Firebase limits):
     ftue_start · artifact_selected{artifact} · tutorial_step{step} · tutorial_skip{step} · ftue_complete{seconds}
     game_start{suits, daily, source} · game_end{suits, result, moves, seconds, sets, hints, undos}
     game_win{suits, moves, seconds, daily} · sequence_complete{suits, sets}
     smart_move · auto_complete{moves} · stuck_shown{suits, sets} · stuck_action{action}
     ember_earned{source, amount} · forge_strike{artifact, tier} · artifact_legendary{artifact}
     daily_start · daily_complete{perfect}
     ad_opportunity{format, placement} · ad_request{format} · ad_loaded{format} · ad_show{format, placement}
     ad_failed{format, stage} · rewarded_offer{placement} · rewarded_accept{placement} · reward_earned{placement, amount}
     consent_result{status, can_request_ads} · game_start_latency{ms, suits} · error_nonfatal{where}
   ========================================================================== */
(function (root) {
  'use strict';
  const ES = root.ES = root.ES || {};
  const ring = [];
  let consentAnalytics = true;
  const enabled = () => ES.Build.native && ES.Build.firebase;
  const sessionStart = Date.now();

  function clean(params) {
    const out = {};
    Object.keys(params || {}).slice(0, 25).forEach(k => {
      let v = params[k];
      if (typeof v === 'boolean') v = v ? 1 : 0;
      if (typeof v === 'number' && !isFinite(v)) return;
      if (typeof v === 'string') v = v.slice(0, 100);
      if (v != null) out[k.slice(0, 40)] = v;
    });
    return out;
  }
  function log(name, params) {
    const p = clean(params);
    ring.push({ t: Date.now(), name, params: p }); if (ring.length > 300) ring.shift();
    if (root.location && /[?&]debug/.test(root.location.search)) console.info('[analytics]', name, p);
    if (enabled() && consentAnalytics) ES.Platform.call('FirebaseAnalytics', 'logEvent', { name, params: p });
  }
  function nonFatal(err, where) {
    const message = (err && (err.message || err.toString())) || String(err);
    ring.push({ t: Date.now(), name: 'error_nonfatal', params: { where: where || '', message: message.slice(0, 100) } });
    if (!enabled()) return;
    const P = ES.Platform.plugin('FirebaseCrashlytics'); if (!P) return;
    try { P.recordException({ message: `[${where || 'js'}] ${message}`.slice(0, 500) }).catch(() => {}); } catch (e) {}
  }
  function setKey(key, value) {
    if (!enabled()) return;
    ES.Platform.call('FirebaseCrashlytics', 'setCustomKey', { key, value: String(value), type: 'string' });
  }

  /* Map the UMP outcome to Firebase consent mode. */
  async function applyConsent(c) {
    const adsOk = !!(c && c.canRequestAds);
    const needed = c && c.status === 'REQUIRED';
    consentAnalytics = !needed || adsOk;
    if (!enabled()) return;
    const G = 'GRANTED', D = 'DENIED';
    const set = (type, ok) => ES.Platform.call('FirebaseAnalytics', 'setConsent', { type, status: ok ? G : D });
    await set('ANALYTICS_STORAGE', consentAnalytics);
    await set('AD_STORAGE', adsOk); await set('AD_USER_DATA', adsOk); await set('AD_PERSONALIZATION', adsOk && c.status !== 'REQUIRED');
  }

  /* Remote Config: defaults are compiled in; a fetched config overrides them. */
  async function fetchRemoteConfig() {
    if (!enabled()) return false;
    const RC = ES.Platform.plugin('FirebaseRemoteConfig'); if (!RC) return false;
    try {
      await RC.setSettings({ fetchTimeoutInSeconds: 8, minimumFetchIntervalInSeconds: 3600 });
      await RC.fetchAndActivate();
      const keys = Object.keys(ES.Config.DEFAULTS), got = {};
      for (const k of keys) {
        const d = ES.Config.DEFAULTS[k];
        try {
          const r = typeof d === 'boolean' ? await RC.getBoolean({ key: k }) : typeof d === 'number' ? await RC.getNumber({ key: k }) : await RC.getString({ key: k });
          // only take values that were actually set remotely
          if (r && r.source === 2) got[k] = r.value;          // GetValueSource.Remote
        } catch (e) {}
      }
      ES.Config.apply(got);
      return true;
    } catch (e) { nonFatal(e, 'remote_config'); return false; }
  }

  /* Global error capture → Crashlytics non-fatals. */
  root.addEventListener('error', e => nonFatal(e.error || e.message, 'window.onerror'));
  root.addEventListener('unhandledrejection', e => nonFatal(e.reason, 'unhandledrejection'));

  ES.Analytics = {
    log, nonFatal, setKey, applyConsent, fetchRemoteConfig,
    recent(name) { return name ? ring.filter(e => e.name === name) : ring.slice(); },
    flushSession() { log('session_pause', { seconds: Math.round((Date.now() - sessionStart) / 1000) }); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
