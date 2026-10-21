/* ==========================================================================
   EMBER SOLITAIRE — Release + tunable configuration
   `ES.Build` is written by tools/build_www.js for native builds (web builds use
   the defaults below). `ES.Config` holds every value Remote Config may override.
   ========================================================================== */
(function (root) {
  'use strict';
  const ES = root.ES = root.ES || {};

  ES.Build = Object.assign({
    version: '2.1.0',
    versionCode: 21,
    native: false,            // true inside the Android app
    firebase: false,          // true only when google-services.json was present at build time
    adsProduction: false,     // false = Google test ad units (safe for development)
    privacyUrl: 'https://horizonforgesystems.com/ember-solitaire/privacy.html',   // set in release.config.json
    supportEmail: 'support@horizonforgesystems.com'                         // set in release.config.json
  }, root.ES_BUILD || {});

  /* Ad units. Test IDs are Google's public sample units and never earn revenue.
     Replace the production values with your AdMob units (AdMob → Apps → Ad units). */
  ES.AdUnits = {
    // production units are injected from release.config.json by tools/build_www.js --production
    test: {
      interstitial: 'ca-app-pub-3940256099942544/1033173712',
      rewarded: 'ca-app-pub-3940256099942544/5224354917'
    },
    production: Object.assign({ interstitial: '', rewarded: '' }, root.ES_BUILD_UNITS || {})
  };

  /* Remote Config keys (Firebase console → Remote Config). Defaults ship in the app. */
  const DEFAULTS = {
    ads_enabled: true,
    interstitial_enabled: true,
    interstitial_every_n_games: 3,         // finished games between interstitials
    interstitial_min_interval_sec: 240,    // and at least this long since the last one
    interstitial_grace_games: 3,           // no interstitials during a player's first N finished games
    rewarded_enabled: true,
    rewarded_ember: 50,                    // Stoke the Forge bonus
    rewarded_daily_cap: 3,
    first_artifact_tier_costs: '400,600,800,1000,1000,1000',
    tier_cost: 1000,
    autocomplete_enabled: true,
    stuck_prompt_enabled: true
  };
  const values = Object.assign({}, DEFAULTS);

  ES.Config = {
    DEFAULTS,
    get(k) { return values[k]; },
    num(k) { const v = Number(values[k]); return isFinite(v) ? v : Number(DEFAULTS[k]); },
    bool(k) { const v = values[k]; return v === true || v === 'true' || v === 1; },
    list(k) { return String(values[k]).split(',').map(Number).filter(n => isFinite(n) && n > 0); },
    apply(obj) { Object.keys(obj || {}).forEach(k => { if (k in DEFAULTS && obj[k] != null && obj[k] !== '') values[k] = obj[k]; }); },
    snapshot() { return Object.assign({}, values); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
