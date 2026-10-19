/* ==========================================================================
   EMBER SOLITAIRE — Ceremonies: victory, forge transformation, legendary reveal
   ========================================================================== */
(function (root) {
  'use strict';
  const ES = root.ES = root.ES || {};
  const UI = ES.UI, St = () => ES.Store, S = () => ES.Store.state, A = () => ES.Artifacts;
  const { esc, n, I } = UI;

  function layer(cls, html) {
    const el = document.createElement('div');
    el.className = 'ceremony ' + (cls || '');
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = html;
    document.getElementById('app').appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-in'));
    return el;
  }
  function closeLayer(el) { el.classList.remove('is-in'); setTimeout(() => el.remove(), ES.FX.motion() ? 400 : 0); }
  const wait = ms => new Promise(r => setTimeout(r, ES.FX.motion() ? ms : Math.min(ms, 60)));

  /* ---------- victory ------------------------------------------------------ */
  function victory(g, out) {
    ES.Audio.play('victory'); ES.Audio.haptic([20, 60, 30]);
    ES.Analytics.log('game_win', { suits: g.suits, moves: g.moves, seconds: Math.round(g.elapsed / 1000), daily: !!g.daily });
    if (out.daily || (g.daily && g.won)) ES.Analytics.log('daily_complete', { perfect: !!g.won });
    ES.Screens.endGame(g, 'win'); ES.Ads.gameFinished();
    const def = A().get(S().artifact), p = St().current(), heat = St().heatPct();
    let ready = St().ready();
    const before = Math.max(0, heat - Math.round((out.ember || 0) / St().cost() * 100));
    const el = layer('victory', `
      <div class="cer-bg" style="background-image:url('${ES.Manifest.envSrc('forgeChamber')}')"></div>
      <div class="cer-inner content">
        <div class="caps center">${g.daily ? 'Daily Challenge' : g.suits + ' Suit · Spider'}</div>
        <h2 class="display xl ember-text center">Victory</h2>
        <div class="ornament"></div>
        <p class="center muted">All eight sequences are forged.</p>
        <div class="vic-stats">
          <div><span class="caps dim">Time</span><b class="num">${UI.clock(g.elapsed)}</b></div>
          <div><span class="caps dim">Moves</span><b class="num">${g.moves}</b></div>
          <div><span class="caps dim">Ember</span><b class="num ember">+${n(g.run || out.ember)}</b></div>
        </div>
        <div class="vic-art artifact-stage">${UI.artifactStage(def.id, p.tier, before, {})}</div>
        <div class="center"><div class="display sm">${esc(def.name)}</div><div class="caps">${A().TIERS[p.tier]} · <span class="num" id="vicPct">${heat}%</span></div></div>
        <div class="vic-bar">${UI.molten(before / 100, { ticks: true })}</div>
        <div class="menu-list">
          <div class="cta ${ready ? 'is-ready' : ''}"><button class="btn btn-primary btn-block" id="vicForge">${ready ? 'Strike the Forge' : 'Return to Forge'}</button></div>
          <button class="btn btn-block" id="vicAgain">${I('cards')}Play Again</button>
          ${!ready && ES.Ads.offer('victory') ? ES.Screens.stokeButton('vicStoke') : ''}
        </div>
      </div>`);
    UI.wireHeat(el, def.id, before);
    setTimeout(() => { UI.animateHeat(el, def.id, before, heat, 1500); const f = el.querySelector('.vic-bar .fill'); if (f) f.style.setProperty('--p', heat / 100); ES.FX.sparks(innerWidth / 2, innerHeight * 0.45, 14, 90, { up: true }); }, 500);
    ES.FX.setField('ceremony');
    const done = () => { St().abandonGame(); closeLayer(el); };
    let leaving = false;
    // Natural break after a finished game: a capped interstitial may play here, never before a strike ceremony.
    const leave = async (next, withAd) => { if (leaving) return; leaving = true; if (withAd) await ES.Ads.maybeInterstitial('post_game'); done(); next(); };
    el.querySelector('#vicForge').onclick = () => leave(() => { UI.go('forge'); if (ready) setTimeout(strike, 500); }, !ready);
    el.querySelector('#vicAgain').onclick = () => leave(() => ES.Screens.newGame(g.suits, { source: 'play_again' }), true);
    const vs = el.querySelector('#vicStoke');
    if (vs) vs.onclick = async () => {
      const fromPct = St().heatPct();
      const r = await ES.Screens.stoke('victory'); if (!r.granted) return;
      vs.remove();
      const emb = el.querySelector('.vic-stats .ember'); g.run = (g.run || 0) + r.amount; if (emb) emb.textContent = '+' + n(g.run);
      const to = St().heatPct(); UI.animateHeat(el, def.id, fromPct, to, 1000);
      const f = el.querySelector('.vic-bar .fill'); if (f) f.style.setProperty('--p', to / 100);
      el.querySelector('#vicPct').textContent = to + '%';
      if (St().ready() && !ready) { ready = true; const b = el.querySelector('#vicForge'); b.textContent = 'Strike the Forge'; b.parentElement.classList.add('is-ready'); }
    };
    setTimeout(() => el.querySelector('#vicForge').focus(), 400);
  }

  /* ---------- hammer SVG ---------------------------------------------------- */
  const HAMMER = `<svg class="hammer" viewBox="0 0 200 200" aria-hidden="true"><defs><linearGradient id="hmG" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#8a9097"/><stop offset=".5" stop-color="#3a3f45"/><stop offset="1" stop-color="#15181b"/></linearGradient></defs>
    <rect x="94" y="40" width="12" height="150" rx="4" fill="#2a1b12"/><rect x="60" y="14" width="80" height="44" rx="4" fill="url(#hmG)" stroke="#000" stroke-width="2"/><rect x="60" y="14" width="80" height="4" fill="#c9cfd4" opacity=".6"/></svg>`;

  /* ---------- forge transformation ----------------------------------------- */
  async function strike() {
    if (!St().ready()) return;
    const id = S().artifact, def = A().get(id), from = St().current().tier;
    const res = St().strike(); if (!res) return;
    ES.Analytics.log('forge_strike', { artifact: id, tier: res.to });
    if (res.kind === 'legendary') { ES.Analytics.log('artifact_legendary', { artifact: id }); return legendary(res); }
    const to = res.to, seenKey = id + ':' + to, canSkip = !!S().seen[seenKey];
    S().seen[seenKey] = true; St().save();
    let skipped = false;
    const el = layer('transform', `
      <div class="cer-bg" style="background-image:url('${ES.Manifest.envSrc('forgeChamber')}')"></div>
      <div class="cer-dark"></div>
      <div class="tf-stage artifact-stage" id="tfStage">${UI.artifactStage(id, from, 100, { prop: 'anvil' })}</div>
      ${HAMMER}
      <div class="flash"></div>
      <div class="tf-title">
        <h2 class="display xl ember-text">${A().TIERS[to]}</h2>
        <div class="display md">${esc(def.name)}</div>
        <p class="muted lore">“${A().TIER_LORE[to]}”</p>
        <div class="cta"><button class="btn btn-primary" id="tfContinue">Continue</button></div>
      </div>
      ${canSkip ? '<button class="link-btn tf-skip" id="tfSkip">Skip</button>' : ''}`);
    const stage = el.querySelector('#tfStage');
    UI.wireHeat(stage, id, 100);
    const swap = () => { stage.innerHTML = UI.artifactStage(id, to, 0, { prop: 'anvil' }); UI.wireHeat(stage, id, 0); };
    const finish = () => { el.classList.add('show-title'); setTimeout(() => el.querySelector('#tfContinue').focus(), 50); };
    const sk = el.querySelector('#tfSkip');
    if (sk) sk.onclick = () => { skipped = true; el.classList.add('skipped'); swap(); finish(); };
    el.querySelector('#tfContinue').onclick = () => { closeLayer(el); ES.FX.setField('forge'); UI.go('forge', { force: true }); };
    ES.FX.setField('none');
    await wait(500); if (skipped) return;
    el.classList.add('glow'); ES.Audio.play('ember');
    await wait(700); if (skipped) return;
    ES.FX.setField('ceremony');
    const r = stage.getBoundingClientRect();
    for (let k = 0; k < 2; k++) {
      el.classList.remove('swing'); void el.offsetWidth; el.classList.add('swing');
      await wait(380); if (skipped) return;
      ES.Audio.play('strike'); ES.Audio.haptic([30, 40, 60]);
      el.classList.remove('impact'); void el.offsetWidth; el.classList.add('impact');
      ES.FX.sparks(r.left + r.width / 2, r.top + r.height * 0.55, 26, 140, { up: true, dur: 800 });
      if (k === 1) { el.classList.add('white'); setTimeout(swap, 120); }
      await wait(k === 0 ? 700 : 900); if (skipped) return;
    }
    el.classList.remove('white');
    UI.animateHeat(stage, id, 0, St().heatPct(), 1200);
    await wait(500); if (skipped) return;
    finish();
  }

  /* ---------- legendary reveal --------------------------------------------- */
  async function legendary(res) {
    const id = res.id, def = A().get(id), s = S().stats, rec = res.record;
    ES.FX.setField('none');
    const el = layer('legendary-cer', `
      <div class="cer-black"></div>
      <div class="lg-stage artifact-stage" id="lgStage">${UI.artifactStage(id, 6, 0, {})}</div>
      <div class="flash"></div>
      <div class="lg-title">
        <div class="caps">The work is complete</div>
        <h2 class="display xl ember-text">Legendary</h2>
        <div class="display md">${esc(def.name)}</div>
        <div class="ornament"></div>
      </div>
      <div class="lg-stats content">
        <div class="panel">
          <div class="caps center">The Journey</div>
          <div class="journey">
            ${[['Games Played', n(s.games)], ['Victories', n(rec.victories)], ['Sequences Completed', n(s.sequences)], ['Daily Challenges', n(s.dailies)], ['4 Suit Wins', n((s.bySuits[4] || {}).wins || 0)], ['Cards Moved', n(s.cardsMoved)], ['Total Ember', n(rec.ember)], ['Forging Time', UI.dur(rec.forgingMs)]].map(([k, v]) => `<div><span class="caps dim">${k}</span><b class="num">${v}</b></div>`).join('')}
          </div>
        </div>
        <div class="cta is-ready"><button class="btn btn-primary btn-block" id="lgPlace">Place in Hall</button></div>
      </div>`);
    const stage = el.querySelector('#lgStage');
    UI.wireHeat(stage, id, 0);
    el.querySelector('#lgPlace').onclick = () => { closeLayer(el); ES.Screens.hallFocus(id); UI.go('hall', { force: true }); ES.Audio.play('strike'); };
    await wait(700);
    el.classList.add('silhouette');
    await wait(900);
    el.classList.add('channels'); ES.Audio.play('ember');
    UI.animateHeat(stage, id, 0, 100, 2400);
    await wait(2500);
    ES.Audio.play('strike'); ES.Audio.haptic([40, 60, 80]);
    el.classList.add('reveal', 'white');
    ES.FX.setField('ceremony');
    const r = stage.getBoundingClientRect(); ES.FX.sparks(r.left + r.width / 2, r.top + r.height / 2, 30, 160, { up: true, dur: 900 });
    await wait(400); el.classList.remove('white');
    await wait(900); el.classList.add('show-title');
    await wait(1200); el.classList.add('show-stats');
    setTimeout(() => el.querySelector('#lgPlace').focus(), 100);
  }

  ES.Ceremony = { victory, strike, legendary };
})(typeof window !== 'undefined' ? window : globalThis);
