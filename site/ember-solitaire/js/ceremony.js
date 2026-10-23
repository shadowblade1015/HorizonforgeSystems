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
    const entrance = requestAnimationFrame(() => { if (el.isConnected !== false) el.classList.add('is-in'); });
    el.cancelEntrance = () => cancelAnimationFrame(entrance);
    return el;
  }
  function closeLayer(el) { el.cancelEntrance(); el.classList.remove('is-in'); setTimeout(() => el.remove(), ES.FX.motion() ? 400 : 0); }

  function ownScene(el) {
    const board = ES.Board, token = board.captureView(), waits = new Set(), timers = new Set(), heat = new Set();
    let closed = false;
    const current = () => !closed && board.isCurrent(token);
    const dispose = (fade = false) => {
      if (closed) return; closed = true; unsubscribe(); el.cancelEntrance();
      for (const id of timers) board.cancelLater(id); timers.clear();
      for (const waiter of waits) if (waiter.cancelWait) waiter.cancelWait(); waits.clear();
      for (const cancel of heat) if (typeof cancel === 'function') cancel(); heat.clear();
      if (fade) closeLayer(el); else el.remove();
    };
    const unsubscribe = board.onInvalidate(() => dispose());
    return {
      current, dispose,
      wait(ms) { if (!current()) return Promise.resolve(false); const waiter = {}; waits.add(waiter); return board.wait(ES.FX.motion() ? ms : Math.min(ms, 60), token, waiter).finally(() => waits.delete(waiter)); },
      later(fn, ms) { const id = board.later(() => { timers.delete(id); if (current()) fn(); }, ms, token); timers.add(id); },
      animate(cancel) { heat.add(cancel); }
    };
  }

  /* ---------- victory ------------------------------------------------------ */
  const shownVictories = new WeakSet();
  let activeVictory = null;
  function victory(g, out) {
    const board = ES.Board, token = board && board.capture();
    const owns = () => S().game === g && g.won && (!UI.current || UI.current === 'game') && (!board || board.isSession(token));
    if (!owns() || (board && !board.canPresent(token)) || shownVictories.has(g) || activeVictory) return false;
    shownVictories.add(g);
    const tasks = new Set(), heatAnimations = new Set();
    let closed = false, el, unsubscribe = () => {};
    const valid = () => !closed && owns();
    const defer = (fn, ms) => { const id = setTimeout(() => { tasks.delete(id); if (valid()) fn(); }, ms); tasks.add(id); };
    const dispose = (fade = false) => {
      if (closed) return; closed = true; unsubscribe();
      for (const id of tasks) clearTimeout(id); tasks.clear();
      for (const cancel of heatAnimations) if (typeof cancel === 'function') cancel(); heatAnimations.clear();
      if (el) { if (fade) closeLayer(el); else { el.cancelEntrance(); el.remove(); } }
      if (activeVictory === dispose) activeVictory = null;
    };
    activeVictory = dispose;
    if (board) unsubscribe = board.onInvalidate(kind => { if (kind !== 'pause') dispose(); });
    ES.Audio.play('victory'); ES.Audio.haptic([20, 60, 30]);
    ES.Analytics.log('game_win', { suits: g.suits, moves: g.moves, seconds: Math.round(g.elapsed / 1000), daily: !!g.daily });
    if (out.daily || (g.daily && g.won)) ES.Analytics.log('daily_complete', { perfect: !!g.won });
    ES.Screens.endGame(g, 'win'); ES.Ads.gameFinished();
    const def = A().get(S().artifact), p = St().current(), heat = St().heatPct();
    let ready = St().ready();
    const before = Math.max(0, heat - Math.round((out.ember || 0) / St().cost() * 100));
    el = layer('victory', `
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
    defer(() => { heatAnimations.add(UI.animateHeat(el, def.id, before, heat, 1500)); const f = el.querySelector('.vic-bar .fill'); if (f) f.style.setProperty('--p', heat / 100); ES.FX.sparks(innerWidth / 2, innerHeight * 0.45, 14, 90, { up: true }); }, 500);
    ES.FX.setField('ceremony');
    const done = () => { if (!valid()) return false; dispose(true); St().abandonGame(); return true; };
    let leaving = false;
    // Natural break after a finished game: a capped interstitial may play here, never before a strike ceremony.
    const leave = async (next, withAd) => {
      if (leaving || !valid()) return; leaving = true;
      try { if (withAd) await ES.Ads.maybeInterstitial('post_game'); } catch (error) { /* navigation still requires ownership */ }
      if (!valid()) return;
      if (done()) next();
    };
    el.querySelector('#vicForge').onclick = () => leave(() => { UI.go('forge'); if (ready) { const ticket = board && board.capture(); setTimeout(() => { if (UI.current === 'forge' && (!board || board.isCurrent(ticket))) strike(); }, 500); } }, !ready);
    el.querySelector('#vicAgain').onclick = () => leave(() => ES.Screens.newGame(g.suits, { source: 'play_again' }), true);
    const vs = el.querySelector('#vicStoke');
    if (vs) vs.onclick = async () => {
      if (!valid()) return;
      const fromPct = St().heatPct();
      const r = await ES.Screens.stoke('victory'); if (!valid() || !r.granted) return;
      vs.remove();
      const emb = el.querySelector('.vic-stats .ember'); g.run = (g.run || 0) + r.amount; if (emb) emb.textContent = '+' + n(g.run);
      const to = St().heatPct(); heatAnimations.add(UI.animateHeat(el, def.id, fromPct, to, 1000));
      const f = el.querySelector('.vic-bar .fill'); if (f) f.style.setProperty('--p', to / 100);
      el.querySelector('#vicPct').textContent = to + '%';
      if (St().ready() && !ready) { ready = true; const b = el.querySelector('#vicForge'); b.textContent = 'Strike the Forge'; b.parentElement.classList.add('is-ready'); }
    };
    defer(() => el.querySelector('#vicForge').focus(), 400);
    return true;
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
    const scene = ownScene(el);
    const stage = el.querySelector('#tfStage');
    UI.wireHeat(stage, id, 100);
    const swap = () => { stage.innerHTML = UI.artifactStage(id, to, 0, { prop: 'anvil' }); UI.wireHeat(stage, id, 0); };
    const finish = () => { if (!scene.current()) return; el.classList.add('show-title'); scene.later(() => el.querySelector('#tfContinue').focus(), 50); };
    const sk = el.querySelector('#tfSkip');
    if (sk) sk.onclick = () => { if (!scene.current()) return; skipped = true; el.classList.add('skipped'); swap(); finish(); };
    el.querySelector('#tfContinue').onclick = () => { if (!scene.current()) return; scene.dispose(true); ES.FX.setField('forge'); UI.go('forge', { force: true }); };
    ES.FX.setField('none');
    await scene.wait(500); if (!scene.current() || skipped) return;
    el.classList.add('glow'); ES.Audio.play('ember');
    await scene.wait(700); if (!scene.current() || skipped) return;
    ES.FX.setField('ceremony');
    const r = stage.getBoundingClientRect();
    for (let k = 0; k < 2; k++) {
      el.classList.remove('swing'); void el.offsetWidth; el.classList.add('swing');
      await scene.wait(380); if (!scene.current() || skipped) return;
      ES.Audio.play('strike'); ES.Audio.haptic([30, 40, 60]);
      el.classList.remove('impact'); void el.offsetWidth; el.classList.add('impact');
      ES.FX.sparks(r.left + r.width / 2, r.top + r.height * 0.55, 26, 140, { up: true, dur: 800 });
      if (k === 1) { el.classList.add('white'); scene.later(swap, 120); }
      await scene.wait(k === 0 ? 700 : 900); if (!scene.current() || skipped) return;
    }
    el.classList.remove('white');
    scene.animate(UI.animateHeat(stage, id, 0, St().heatPct(), 1200));
    await scene.wait(500); if (!scene.current() || skipped) return;
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
    const scene = ownScene(el);
    const stage = el.querySelector('#lgStage');
    UI.wireHeat(stage, id, 0);
    el.querySelector('#lgPlace').onclick = () => { if (!scene.current()) return; scene.dispose(); ES.Screens.hallFocus(id); UI.go('hall', { force: true }); ES.Audio.play('strike'); };
    await scene.wait(700); if (!scene.current()) return;
    el.classList.add('silhouette');
    await scene.wait(900); if (!scene.current()) return;
    el.classList.add('channels'); ES.Audio.play('ember');
    scene.animate(UI.animateHeat(stage, id, 0, 100, 2400));
    await scene.wait(2500); if (!scene.current()) return;
    ES.Audio.play('strike'); ES.Audio.haptic([40, 60, 80]);
    el.classList.add('reveal', 'white');
    ES.FX.setField('ceremony');
    const r = stage.getBoundingClientRect(); ES.FX.sparks(r.left + r.width / 2, r.top + r.height / 2, 30, 160, { up: true, dur: 900 });
    await scene.wait(400); if (!scene.current()) return; el.classList.remove('white');
    await scene.wait(900); if (!scene.current()) return; el.classList.add('show-title');
    await scene.wait(1200); if (!scene.current()) return; el.classList.add('show-stats');
    scene.later(() => el.querySelector('#lgPlace').focus(), 100);
  }

  ES.Ceremony = { victory, strike, legendary };
})(typeof window !== 'undefined' ? window : globalThis);
