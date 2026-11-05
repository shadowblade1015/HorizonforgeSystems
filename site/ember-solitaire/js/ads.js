/* ==========================================================================
   EMBER SOLITAIRE — Consent-aware advertising (Google Mobile Ads + UMP)

   Principles (Google Play ads policy + the launch audit):
   • Consent first: UMP consent info is refreshed on every launch; no ad SDK
     initialization and no ad request happen unless canRequestAds is true.
   • The game never waits on, or depends on, an ad. Every failure is silent.
   • Rewarded ("Stoke the Forge") is always opt-in and capped per day.
   • Interstitials only at a natural break AFTER a finished game, never at app
     start, never at the start of a deal, never during play. Frequency is capped
     by games and by time, with a grace period for new players, all tunable from
     Remote Config.
   • No banners, no app-open ads.
   • Audience is 13+ (not child-directed): maxAdContentRating = Teen.

   Web builds: ads are off. `?ads=mock` simulates ads for UI tests.
   ========================================================================== */
(function (root) {
  'use strict';
  const ES = root.ES = root.ES || {};
  const A = {
    status: 'off',            // off | consenting | ready | blocked
    canRequest: false, privacyRequired: false, consentStatus: 'UNKNOWN',
    loaded: { interstitial: false, rewarded: false }, showing: false
  };
  const mock = /[?&]ads=mock/.test(root.location ? root.location.search : '');
  const C = () => ES.Config, log = (n, p) => ES.Analytics && ES.Analytics.log(n, p);
  const units = () => ES.Build.adsProduction ? ES.AdUnits.production : ES.AdUnits.test;
  const plug = () => ES.Platform.plugin('AdMob');
  const st = () => { const s = ES.Store.state.ads; const d = ES.Store.today(); if (s.day !== d) { s.day = d; s.rewardsToday = 0; } return s; };

  /* ---------- startup: consent → init → preload --------------------------- */
  async function init() {
    if (mock) { A.status = 'ready'; A.canRequest = true; A.loaded.interstitial = A.loaded.rewarded = true; return A; }
    if (!ES.Platform.native || !C().bool('ads_enabled')) { A.status = 'off'; return A; }
    const P = plug(); if (!P) { A.status = 'off'; return A; }
    A.status = 'consenting';
    try {
      const req = { tagForUnderAgeOfConsent: false };
      // Internal test builds can force the EEA consent flow on registered test devices (tools/build_www.js --ump-eea).
      if (!ES.Build.adsProduction && ES.Build.umpDebugEEA) { req.debugGeography = 1; req.testDeviceIdentifiers = ES.Build.testDevices || []; }
      let info = await P.requestConsentInfo(req);
      if (info && !info.canRequestAds && info.status === 'REQUIRED' && info.isConsentFormAvailable) {
        info = await P.showConsentForm();
      }
      A.consentStatus = (info && info.status) || 'UNKNOWN';
      A.canRequest = !!(info && info.canRequestAds);
      A.privacyRequired = !!(info && info.privacyOptionsRequirementStatus === 'REQUIRED');
      log('consent_result', { status: A.consentStatus, can_request_ads: A.canRequest });
      await ES.Analytics.applyConsent(info);
    } catch (e) {
      ES.Analytics.nonFatal(e, 'ump');
      A.canRequest = false;
    }
    if (!A.canRequest) { A.status = 'blocked'; return A; }
    try {
      await P.initialize({
        initializeForTesting: !ES.Build.adsProduction,
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
        maxAdContentRating: 'Teen'
      });
    } catch (e) { ES.Analytics.nonFatal(e, 'ads_init'); A.status = 'blocked'; return A; }
    wire(P);
    A.status = 'ready';
    preload('rewarded'); preload('interstitial');
    return A;
  }
  function wire(P) {
    const on = (ev, fn) => { try { P.addListener(ev, fn); } catch (e) {} };
    on('interstitialAdLoaded', () => { A.loaded.interstitial = true; log('ad_loaded', { format: 'interstitial' }); });
    on('interstitialAdFailedToLoad', e => { A.loaded.interstitial = false; log('ad_failed', { format: 'interstitial', stage: 'load', code: e && e.code }); retry('interstitial'); });
    on('onRewardedVideoAdLoaded', () => { A.loaded.rewarded = true; log('ad_loaded', { format: 'rewarded' }); });
    on('onRewardedVideoAdFailedToLoad', e => { A.loaded.rewarded = false; log('ad_failed', { format: 'rewarded', stage: 'load', code: e && e.code }); retry('rewarded'); });
  }
  const backoff = { interstitial: 0, rewarded: 0 };
  function retry(fmt) { backoff[fmt] = Math.min(6, backoff[fmt] + 1); setTimeout(() => preload(fmt), 2000 * Math.pow(2, backoff[fmt])); }
  async function preload(fmt) {
    if (mock) { A.loaded[fmt] = true; return; }
    if (A.status !== 'ready' || A.loaded[fmt]) return;
    const P = plug(); if (!P) return;
    const opts = { adId: units()[fmt], isTesting: !ES.Build.adsProduction, immersiveMode: true };
    log('ad_request', { format: fmt });
    try {
      if (fmt === 'interstitial') await P.prepareInterstitial(opts); else await P.prepareRewardVideoAd(opts);
      A.loaded[fmt] = true; backoff[fmt] = 0;
    } catch (e) { A.loaded[fmt] = false; }
  }

  /* ---------- rewarded: Stoke the Forge ------------------------------------ */
  function rewardedAvailable() {
    return A.status === 'ready' && A.canRequest && C().bool('rewarded_enabled') && A.loaded.rewarded && !A.showing &&
      st().rewardsToday < C().num('rewarded_daily_cap');
  }
  function rewardAmount() { return Math.max(1, Math.round(C().num('rewarded_ember'))); }
  async function showRewarded(placement) {
    if (!rewardedAvailable()) return { granted: false };
    log('rewarded_accept', { placement });
    A.showing = true; ES.Audio.suspend(true);
    let granted = false;
    try {
      if (mock) granted = await mockAd('Rewarded test ad', true);
      else {
        const P = plug(), subs = [];
        granted = await new Promise(resolve => {
          let got = false; const done = () => { subs.forEach(s => s && s.then && s.then(h => h.remove()).catch(() => {})); resolve(got); };
          subs.push(P.addListener('onRewardedVideoAdReward', () => { got = true; }));
          subs.push(P.addListener('onRewardedVideoAdDismissed', done));
          subs.push(P.addListener('onRewardedVideoAdFailedToShow', () => { log('ad_failed', { format: 'rewarded', stage: 'show' }); done(); }));
          log('ad_show', { format: 'rewarded', placement });
          P.showRewardVideoAd().then(r => { if (r) got = true; }).catch(() => done());
          setTimeout(done, 120000);
        });
      }
    } finally { A.showing = false; A.loaded.rewarded = false; ES.Audio.suspend(false); preload('rewarded'); }
    if (!granted) return { granted: false };
    const amount = rewardAmount();
    st().rewardsToday++;
    ES.Store.addEmber(amount, 'rewarded');
    log('reward_earned', { placement, amount });
    return { granted: true, amount };
  }
  function offer(placement) { if (rewardedAvailable()) { log('rewarded_offer', { placement }); return true; } return false; }

  /* ---------- interstitial: only after a finished game -------------------- */
  // Call when a game ends (won, or a long game the player chose to leave).
  function gameFinished() { const s = st(); s.finishedTotal++; s.finishedSinceInterstitial++; ES.Store.save(); }
  function interstitialEligible() {
    const s = st();
    if (A.status !== 'ready' || !A.canRequest || !C().bool('interstitial_enabled') || !A.loaded.interstitial || A.showing) return false;
    if (s.finishedTotal <= C().num('interstitial_grace_games')) return false;
    if (s.finishedSinceInterstitial < C().num('interstitial_every_n_games')) return false;
    if (Date.now() - s.lastInterstitialAt < C().num('interstitial_min_interval_sec') * 1000) return false;
    return true;
  }
  // Natural break, user-initiated navigation away from a finished game. Resolves when the ad is gone.
  async function maybeInterstitial(placement) {
    log('ad_opportunity', { format: 'interstitial', placement });
    if (!interstitialEligible()) return false;
    const s = st();
    A.showing = true; ES.Audio.suspend(true);
    try {
      if (mock) await mockAd('Interstitial test ad', false);
      else {
        const P = plug(), subs = [];
        await new Promise(resolve => {
          const done = () => { subs.forEach(x => x && x.then && x.then(h => h.remove()).catch(() => {})); resolve(); };
          subs.push(P.addListener('interstitialAdDismissed', done));
          subs.push(P.addListener('interstitialAdFailedToShow', () => { log('ad_failed', { format: 'interstitial', stage: 'show' }); done(); }));
          log('ad_show', { format: 'interstitial', placement });
          P.showInterstitial().catch(done);
          setTimeout(done, 90000);
        });
      }
      s.lastInterstitialAt = Date.now(); s.finishedSinceInterstitial = 0; ES.Store.save();
    } finally { A.showing = false; A.loaded.interstitial = false; ES.Audio.suspend(false); preload('interstitial'); }
    return true;
  }

  /* ---------- privacy options (Settings) ----------------------------------- */
  function privacyOptionsAvailable() { return mock || (ES.Platform.native && A.privacyRequired); }
  async function showPrivacyOptions() {
    if (mock) { ES.UI.toast('Privacy options (test mode)'); return; }
    const P = plug(); if (!P) return;
    try {
      const info = await P.showPrivacyOptionsForm();
      if (info) { A.canRequest = !!info.canRequestAds; await ES.Analytics.applyConsent(info); }
    } catch (e) { ES.Analytics.nonFatal(e, 'privacy_options'); }
  }
  function onResume() { if (A.status === 'ready') { preload('rewarded'); preload('interstitial'); } }

  /* ---------- test double -------------------------------------------------- */
  function mockAd(label, rewarded) {
    return new Promise(resolve => {
      const el = document.createElement('div');
      el.className = 'mock-ad'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', label);
      el.innerHTML = `<div class="mock-ad-box"><b>${label}</b><span>Shown only in ?ads=mock test builds.</span><button class="btn" id="mockAdClose">${rewarded ? 'Finish ad' : 'Close ad'}</button></div>`;
      document.body.appendChild(el);
      el.querySelector('#mockAdClose').onclick = () => { el.remove(); resolve(true); };
    });
  }

  ES.Ads = { init, state: A, rewardedAvailable, rewardAmount, showRewarded, offer, gameFinished, interstitialEligible, maybeInterstitial, privacyOptionsAvailable, showPrivacyOptions, onResume };
})(typeof window !== 'undefined' ? window : globalThis);
