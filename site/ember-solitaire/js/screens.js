/* ==========================================================================
   EMBER SOLITAIRE — Screen renderers
   ========================================================================== */
(function (root) {
  'use strict';
  const ES = root.ES = root.ES || {};
  const UI = ES.UI, St = () => ES.Store, S = () => ES.Store.state, A = () => ES.Artifacts;
  const { $, esc, n, I } = UI;
  const R = UI.renderers;

  /* ======================= GAME FLOW ===================================== */
  function newGame(suits, opts) {
    opts = opts || {};
    const g = ES.Engine.newGame(suits, opts.daily ? { seed: St().dailySeed(opts.dailyKey), daily: true, dailyKey: opts.dailyKey } : {});
    g.run = 0;
    g.initial = JSON.parse(JSON.stringify({ cols: g.cols, stock: g.stock }));
    const t0 = performance.now();
    St().startGame(g);
    ES.Manifest.preload(ES.Manifest.cardUrls(suits).concat([ES.Manifest.envSrc('forgeChamber'), ES.Manifest.env.anvil]));   // victory + forge art ready before the win
    UI.go('game', { focus: false });
    ES.Board.start(g, { animateDeal: true });
    ES.Analytics.log('game_start', { suits, daily: !!opts.daily, source: opts.source || (opts.daily ? 'daily' : 'modes') });
    if (opts.daily) ES.Analytics.log('daily_start', {});
    requestAnimationFrame(() => requestAnimationFrame(() => ES.Analytics.log('game_start_latency', { ms: Math.round(performance.now() - t0), suits })));
    return g;
  }
  function resumeGame() {
    const g = S().game; if (!g) return false;
    UI.go('game', { focus: false });
    ES.Board.start(g, { animateDeal: false });
    ES.Analytics.log('game_start', { suits: g.suits, daily: !!g.daily, source: 'resume' });
    return true;
  }
  /* A game the player is leaving. Long games count as "finished" for ad pacing. */
  function endGame(g, result) {
    if (!g) return false;
    ES.Analytics.log('game_end', { suits: g.suits, result, moves: g.moves, seconds: Math.round(g.elapsed / 1000), sets: g.completed, hints: g.hintsUsed, undos: g.undosUsed });
    const substantial = result === 'win' || (g.elapsed >= 180000 && g.moves >= 30);
    if (substantial && result !== 'win') ES.Ads.gameFinished();
    return substantial;
  }
  function inProgress() { const g = S().game; return g && !g.won ? g : null; }

  R.game = function () { UI.hydrateIcons($('#scr-game')); };

  function pauseMenu() {
    const g = ES.Board.game; ES.Board.pause(true);
    UI.sheet({
      kicker: 'Paused', title: 'The Forge Waits',
      body: g ? `<div class="pause-stats"><div><span class="caps dim">Time</span><b>${UI.clock(g.elapsed)}</b></div><div><span class="caps dim">Moves</span><b>${g.moves}</b></div><div><span class="caps dim">Sets</span><b>${g.completed}/8</b></div><div><span class="caps dim">Ember</span><b>+${g.run || 0}</b></div></div>` : '',
      actions: [
        { label: 'Resume', primary: true, icon: 'play' },
        { label: 'Back to portfolio', icon: 'home', onClick: () => { St().save(true); location.href = '/portfolio/#ember-solitaire'; } },
        { label: 'Restart this deal', icon: 'restart', onClick: () => {
          const same = ES.Engine.newGame(g.suits, g.seed != null ? { seed: g.seed, daily: g.daily, dailyKey: g.dailyKey } : {});
          if (g.initial) { same.cols = JSON.parse(JSON.stringify(g.initial.cols)); same.stock = JSON.parse(JSON.stringify(g.initial.stock)); same.initial = g.initial; }
          endGame(g, 'restart');
          same.run = 0; St().startGame(same); ES.Board.start(same, { animateDeal: true });
          ES.Analytics.log('game_start', { suits: same.suits, daily: !!same.daily, source: 'restart' });
        } },
        { label: 'New game', icon: 'cards', onClick: () => { const long = endGame(g, 'abandon'); St().abandonGame(); (long ? ES.Ads.maybeInterstitial('abandon_long_game') : Promise.resolve()).then(() => UI.go('modes')); } },
        { label: 'Settings', icon: 'settings', onClick: () => UI.go('settings') },
        { label: 'Return to forge', ghost: true, icon: 'forge', onClick: () => { St().save(true); UI.go('home'); } }
      ],
      onClose: () => ES.Board.pause(false)
    });
  }

  /* ======================= HOME ========================================== */
  R.home = function () {
    const st = S(), def = A().get(st.artifact), p = St().current(), heat = St().heatPct(), ready = St().ready();
    $('#homeSettings').innerHTML = I('settings');
    $('#homeLevel').innerHTML = `${UI.levelBadge()}<div class="lvl-meta"><span class="caps">Forge Level</span>${UI.molten(St().levelProgress(), { thin: true, label: 'Forge level progress' })}<span class="small muted num">${n(st.totalEmber % St().LEVEL_EMBER)} / ${n(St().LEVEL_EMBER)}</span></div>`;
    $('#homeTitle').innerHTML = `<h1 class="display lg ember-text art-name">${esc(def.name)}</h1><div class="caps tier-name">${A().TIERS[p.tier]}</div>`;
    $('#homeStage').innerHTML = UI.artifactStage(def.id, p.tier, heat, { prop: 'pedestal', inspect: true });
    UI.wireHeat($('#homeStage'), def.id, heat);
    const g = inProgress();
    $('#homeBottom').innerHTML = `
      <div class="heat-line"><span class="display sm num">${heat}%</span><span class="caps dim">${ready ? 'The metal is ready' : 'Heated'}</span></div>
      ${UI.molten(heat / 100, { ticks: true, label: 'Artifact heat' })}
      <div class="cta ${ready ? 'is-ready' : ''}"><button class="btn btn-primary btn-block" id="homeCta">${ready ? 'Strike the Forge' : g ? 'Continue Forging' : 'Continue Forging'}</button></div>
      <p class="home-sub small muted center">${ready ? 'Bring the hammer down to reforge ' + esc(def.name) + '.' : g ? `Hand in progress · ${g.suits} suit · ${g.moves} moves` : esc(def.work[p.tier])}</p>`;
    $('#homeCta').onclick = () => { ES.Audio.unlock(); if (ready) UI.go('forge'); else if (g) resumeGame(); else UI.go('modes'); };
    $('#homeStage .art-holder').onclick = () => inspect(def.id);
    $('#homeStage .art-holder').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inspect(def.id); } };
  };

  /* ======================= MODES ========================================= */
  let chosen = 2;
  function fan(suits) {
    const M = ES.Manifest;
    const sets = { 1: [[13, 'S'], [12, 'S'], [1, 'S']], 2: [[13, 'S'], [13, 'H']], 4: [[13, 'S'], [13, 'H'], [13, 'C'], [13, 'D']] }[suits];
    const spread = { 1: 14, 2: 16, 4: 11 }[suits];
    return `<div class="fan fan-${suits}" aria-hidden="true">${sets.map(([r, s], i) => { const k = i - (sets.length - 1) / 2; return `<img src="${M.card(r, s, true)}" alt="" style="--r:${k * spread}deg;--x:${k * (suits === 4 ? 12 : suits === 2 ? 17 : 15)}px;--i:${i}" loading="lazy">`; }).join('')}</div>`;
  }
  R.modes = function () {
    const g = inProgress(), W = St().WIN_REWARD, M = St().MODES, key = St().today(), d = St().dailyFor(key);
    const desc = { 1: 'Spades only. A gentle, meditative forge.', 2: 'Spades and Hearts. The intended Ember experience.', 4: 'All four suits. The traditional Spider trial.' };
    $('#modesRoot').innerHTML = `
      ${UI.header({ back: true, title: 'Choose Your Forge', kicker: 'Spider Solitaire' })}
      <div class="content modes">
        ${g ? `<div class="panel resume"><div><div class="caps">Hand in progress</div><div class="small muted">${g.daily ? 'Daily · ' : ''}${g.suits} suit · ${g.moves} moves · ${UI.clock(g.elapsed)} · ${g.completed}/8 sets</div></div><button class="btn" id="resumeBtn">${I('play')}Resume</button></div>` : ''}
        <div class="mode-list" role="radiogroup" aria-label="Difficulty">
          ${[1, 2, 4].map(s => `
            <button class="mode panel ${chosen === s ? 'glow is-on' : ''}" role="radio" aria-checked="${chosen === s}" data-suits="${s}">
              ${fan(s)}
              <div class="mode-text">
                <div class="display md">${s} Suit</div>
                <div class="caps">${M[s].name}</div>
                <p class="small muted">${desc[s]}</p>
                <div class="mode-reward"><span class="chip">${I('flame')}+${W[s]}</span><span class="mult">${M[s].mult} Ember</span></div>
              </div>
            </button>`).join('')}
        </div>
        <div class="cta"><button class="btn btn-primary btn-block" id="beginBtn">Begin Forging</button></div>
        <button class="panel daily-teaser" data-go="daily">
          <div class="dt-stamp">${I('challenges')}</div>
          <div class="dt-text"><div class="caps">Daily Challenge</div><div class="display sm">Spider — 2 Suit</div><div class="small muted">${d && d.rewarded ? 'Completed today · Ember stamped' : `Complete ${St().DAILY_GOAL_SETS} full sequences`}</div></div>
          <div class="dt-reward"><b>+${St().DAILY_REWARD}</b><span class="caps dim">Ember</span></div>
        </button>
      </div>`;
    $('#modesRoot').querySelectorAll('.mode').forEach(b => b.onclick = () => { chosen = +b.dataset.suits; ES.Audio.play('pick'); R.modes(); $(`.mode[data-suits="${chosen}"]`).focus(); });
    ES.Manifest.preload(ES.Manifest.cardUrls(chosen));
    $('#beginBtn').onclick = () => { ES.Audio.unlock(); newGame(chosen); };
    const rb = $('#resumeBtn'); if (rb) rb.onclick = resumeGame;
  };

  /* ======================= FORGE ========================================= */
  R.forge = function () {
    const st = S(), def = A().get(st.artifact), p = St().current(), heat = St().heatPct(), ready = St().ready();
    $('#forgeRoot').innerHTML = `
      <header class="forge-top">
        <div class="level">${UI.levelBadge()}<div class="lvl-meta"><span class="caps">Forge Level ${st.forgeLevel}</span><span class="chip">${I('flame')}<span class="num">${n(st.embers)}</span></span></div></div>
        <button class="icon-btn" data-go="hall" aria-label="Hall of Legends">${I('hall')}</button>
      </header>
      <div class="forge-title center"><h1 class="display lg ember-text">${esc(def.name)}</h1><div class="caps tier-name">${A().TIERS[p.tier]}</div></div>
      <div class="forge-stage artifact-stage" id="forgeStage">${UI.artifactStage(def.id, p.tier, heat, { prop: 'anvil', inspect: true })}</div>
      <div class="forge-panel content">
        <div class="panel ${ready ? 'glow' : ''}">
          <div class="heat-row">${ready ? `<div class="ready-title display md ember-text">The Metal Is Ready</div>` : `<div class="pct display num">${heat}%</div>`}<div class="forge-ember small num"><b>${n(p.heat)}</b> / ${n(St().cost())}<span class="caps dim"> Ember</span></div></div>
          ${UI.molten(heat / 100, { ticks: true, label: 'Artifact heat' })}
          ${st.reserve ? `<div class="reserve small muted center">${n(st.reserve)} Ember held in reserve</div>` : ''}
          <div class="work"><span class="caps">Current Work</span><p>${esc(def.work[p.tier])}<br><span class="muted">${ready ? 'Strike to reforge it into ' + A().TIERS[Math.min(6, p.tier + 1)] + '.' : 'Each victory brings it closer.'}</span></p></div>
          <div class="forge-actions">
            ${ready ? `<div class="cta is-ready"><button class="btn btn-primary btn-block" id="strikeBtn">Strike the Forge</button></div>`
                    : `<button class="btn btn-block" id="inspectBtn">${I('inspect')}Inspect</button><div class="cta"><button class="btn btn-primary btn-block" id="forgePlay">Play</button></div>`}
          </div>
          ${!ready && ES.Ads.offer('forge') ? stokeButton('forgeStoke') : ''}
        </div>
      </div>`;
    UI.wireHeat($('#forgeStage'), def.id, heat);
    const hold = $('#forgeStage .art-holder');
    hold.onclick = () => inspect(def.id);
    hold.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inspect(def.id); } };
    const ib = $('#inspectBtn'); if (ib) ib.onclick = () => inspect(def.id);
    const fp = $('#forgePlay'); if (fp) fp.onclick = () => (inProgress() ? resumeGame() : UI.go('modes'));
    const sb = $('#strikeBtn'); if (sb) sb.onclick = () => ES.Ceremony.strike();
    const fs = $('#forgeStoke'); if (fs) fs.onclick = () => stoke('forge', heat);
    if (R.forge.pendingHeat) { const [a, b] = R.forge.pendingHeat; R.forge.pendingHeat = null; UI.animateHeat($('#forgeStage'), def.id, a, b, 1400); }
  };

  /* ---------- Stoke the Forge (opt-in rewarded ad) ------------------------ */
  function stokeButton(id) {
    return `<button class="stoke" id="${id}" aria-label="Watch a short ad for ${ES.Ads.rewardAmount()} bonus Ember">
      <span class="stoke-ico">${I('flame')}</span><span class="stoke-txt"><b>Stoke the Forge</b><span>Watch a short ad · +${ES.Ads.rewardAmount()} Ember</span></span><span class="stoke-tag">AD</span></button>`;
  }
  async function stoke(placement, fromHeat) {
    const r = await ES.Ads.showRewarded(placement);
    if (!r.granted) { ES.UI.toast('No Ember this time. The ad was not finished.'); if (placement === 'forge') R.forge(); return r; }
    ES.UI.toast(`The forge roars · +${r.amount} Ember`, 'ember'); ES.Audio.play('ember');
    if (placement === 'forge') { R.forge.pendingHeat = [fromHeat, St().heatPct()]; R.forge(); }
    return r;
  }

  /* ---------- dead end -------------------------------------------------------- */
  function stuckSheet(g) {
    if (document.querySelector('.overlay') || ES.UI.current !== 'game' || (ES.Tutorial && ES.Tutorial.active)) return;
    ES.Board.pause(true);
    ES.Analytics.log('stuck_shown', { suits: g.suits, sets: g.completed });
    const act = a => ES.Analytics.log('stuck_action', { action: a });
    UI.sheet({
      kicker: 'No useful moves', title: 'The Forge Has Gone Cold',
      body: `<p class="center small muted">None of the next several moves uncovers a card, builds a run or frees a column${g.stock.length ? ', and the stock needs every column filled' : ', and the stock is empty'}.</p>`,
      actions: [
        ...(g.history.length ? [{ label: 'Undo last move', primary: true, icon: 'undo', onClick: () => { act('undo'); ES.Board.doUndo(); } }] : []),
        { label: 'Restart this deal', icon: 'restart', primary: !g.history.length, onClick: () => {
          act('restart'); endGame(g, 'stuck_restart');
          const same = ES.Engine.newGame(g.suits, g.seed != null ? { seed: g.seed, daily: g.daily, dailyKey: g.dailyKey } : {});
          if (g.initial) { same.cols = JSON.parse(JSON.stringify(g.initial.cols)); same.stock = JSON.parse(JSON.stringify(g.initial.stock)); same.initial = g.initial; }
          same.run = 0; St().startGame(same); ES.Board.start(same, { animateDeal: true });
        } },
        { label: 'New deal', icon: 'cards', onClick: () => { act('new'); const long = endGame(g, 'stuck'); St().abandonGame(); (long ? ES.Ads.maybeInterstitial('stuck') : Promise.resolve()).then(() => newGame(g.suits, { source: 'stuck' })); } },
        { label: 'Keep looking', ghost: true, onClick: () => act('dismiss') }
      ],
      onClose: () => ES.Board.pause(false)
    });
  }

  /* ======================= INSPECT ======================================= */
  function inspect(id) {
    const def = A().get(id), st = S(), as = St().artifactState(id), prog = st.progress[id] || {}, rec = st.completed[id];
    const tier = as.tier, heat = as.state === 'legendary' ? 100 : St().pctFor(id);
    UI.sheet({
      cls: 'inspect', kicker: def.type + ' · ' + A().CATEGORY_LABEL[def.category], title: def.name,
      body: `<div class="inspect-stage artifact-stage">${UI.artifactStage(id, tier, heat, { silhouette: as.state === 'locked' })}</div>
        <div class="caps center tier-name">${as.state === 'locked' ? 'Locked' : A().TIERS[tier]}</div>
        <p class="center small muted lore">${as.state === 'locked' ? `Forge ${def.unlock} legendary ${def.unlock === 1 ? 'artifact' : 'artifacts'} to unlock.` : '“' + A().TIER_LORE[tier] + '”'}</p>
        <ol class="ladder" aria-label="Tier progress">${A().TIERS.map((t, i) => `<li class="${i < tier || as.state === 'legendary' ? 'done' : i === tier && as.state !== 'locked' ? 'now' : ''}"><i></i><span>${t}</span></li>`).join('')}</ol>
        <div class="kv"><div><span class="caps dim">Ember invested</span><b class="num">${n(rec ? rec.ember : prog.ember || 0)}</b></div><div><span class="caps dim">Victories</span><b class="num">${n(rec ? rec.victories : prog.victories || 0)}</b></div>${rec ? `<div><span class="caps dim">Forged</span><b>${UI.date(rec.date)}</b></div>` : ''}</div>`,
      onMount: w => { UI.wireHeat(w, id, heat); tilt(w.querySelector('.inspect-stage')); }
    });
  }
  function tilt(el) {
    if (!el || !ES.FX.motion()) return;
    el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; el.style.setProperty('--rx', (-y * 10).toFixed(2) + 'deg'); el.style.setProperty('--ry', (x * 14).toFixed(2) + 'deg'); });
    el.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  }

  /* ======================= HALL OF LEGENDS =============================== */
  let hallIdx = null;
  R.hall = function () {
    const st = S(), list = A().LIST;
    if (hallIdx == null) { const f = list.findIndex(a => st.completed[a.id]); hallIdx = f >= 0 ? f : list.findIndex(a => a.id === st.artifact); }
    const done = Object.keys(st.completed).length;
    $('#hallRoot').innerHTML = `
      ${UI.header({ back: true, title: 'Hall of Legends', kicker: 'A legacy forged in solitaire' })}
      <div class="hall-count caps center">${done} of ${list.length} forged</div>
      <div class="hall-gallery" id="hallGallery" tabindex="0" aria-roledescription="carousel" aria-label="Artifacts">
        ${list.map((a, i) => { const as = St().artifactState(a.id); const lit = as.state === 'legendary';
          return `<div class="hall-slide ${lit ? 'is-lit' : 'is-dark'}" data-i="${i}" aria-roledescription="slide" aria-label="${esc(a.name)}">
            <div class="hall-alcove"></div>
            <div class="artifact-stage hall-stage">${UI.artifactStage(a.id, lit ? 6 : as.tier, lit ? 100 : 0, { prop: 'pedestal', silhouette: !lit })}${lit ? '' : '<div class="shroud"></div>'}</div>
            <div class="plate"><span class="display sm">${lit ? esc(a.name) : 'Not yet forged'}</span><span class="caps dim">${lit ? 'Legendary' : as.state === 'locked' ? 'Sealed' : as.state === 'current' ? 'On the anvil' : 'Awaiting the smith'}</span></div>
          </div>`; }).join('')}
      </div>
      <div class="hall-nav"><button class="icon-btn" id="hallPrev" aria-label="Previous artifact">${I('back')}</button><div class="dots" id="hallDots">${list.map((a, i) => `<i class="${i === hallIdx ? 'on' : ''}"></i>`).join('')}</div><button class="icon-btn" id="hallNext" aria-label="Next artifact">${I('next')}</button></div>
      <div class="content"><div class="panel hall-info" id="hallInfo" aria-live="polite"></div></div>`;
    const gal = $('#hallGallery');
    list.forEach((a, i) => { const sl = gal.children[i]; const lit = !!st.completed[a.id]; UI.wireHeat(sl, a.id, lit ? 100 : 0); });
    const setIdx = (i, smooth) => {
      hallIdx = Math.max(0, Math.min(list.length - 1, i));
      const sl = gal.children[hallIdx];
      gal.scrollTo({ left: sl.offsetLeft - (gal.clientWidth - sl.clientWidth) / 2, behavior: smooth && ES.FX.motion() ? 'smooth' : 'auto' });
      info();
    };
    const info = () => {
      const a = list[hallIdx], rec = st.completed[a.id], as = St().artifactState(a.id);
      [...gal.children].forEach((c, i) => c.classList.toggle('is-sel', i === hallIdx));
      $('#hallDots').innerHTML = list.map((x, i) => `<i class="${i === hallIdx ? 'on' : ''}"></i>`).join('');
      $('#hallInfo').innerHTML = rec
        ? `<div class="hi-head"><div><div class="display md ember-text">${esc(a.name)}</div><div class="caps">${a.type} · Legendary</div></div></div>
           <div class="kv four"><div><span class="caps dim">Date forged</span><b>${UI.date(rec.date)}</b></div><div><span class="caps dim">Victories</span><b class="num">${n(rec.victories)}</b></div><div><span class="caps dim">Ember invested</span><b class="num">${n(rec.ember)}</b></div><div><span class="caps dim">Forging time</span><b>${UI.dur(rec.forgingMs)}</b></div></div>
           <button class="btn btn-block" id="hallInspect">${I('inspect')}Inspect</button>`
        : `<div class="hi-head"><div><div class="display md">${as.state === 'locked' ? 'Sealed Alcove' : esc(a.name)}</div><div class="caps dim">${a.type} · ${as.state === 'locked' ? `Forge ${a.unlock} ${a.unlock === 1 ? 'legend' : 'legends'} to unseal` : as.state === 'current' ? A().TIERS[as.tier] + ' · on the anvil' : 'Not yet forged'}</div></div></div>
           <p class="small muted">${as.state === 'locked' ? 'A covered statue waits in the dark. Its shape is not yet known.' : 'Its pedestal stands empty until the work reaches Legendary.'}</p>
           ${as.state !== 'locked' ? `<button class="btn btn-block" id="hallInspect">${I('inspect')}Inspect</button>` : ''}`;
      const hb = $('#hallInspect'); if (hb) hb.onclick = () => inspect(a.id);
    };
    let st2 = 0;
    gal.addEventListener('scroll', () => { clearTimeout(st2); st2 = setTimeout(() => { const mid = gal.scrollLeft + gal.clientWidth / 2; let best = 0, bd = 1e9; [...gal.children].forEach((c, i) => { const d = Math.abs(c.offsetLeft + c.clientWidth / 2 - mid); if (d < bd) { bd = d; best = i; } }); if (best !== hallIdx) { hallIdx = best; info(); } }, 90); }, { passive: true });
    gal.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') setIdx(hallIdx - 1, true); if (e.key === 'ArrowRight') setIdx(hallIdx + 1, true); });
    [...gal.children].forEach((c, i) => c.onclick = () => setIdx(i, true));
    $('#hallPrev').onclick = () => setIdx(hallIdx - 1, true);
    $('#hallNext').onclick = () => setIdx(hallIdx + 1, true);
    requestAnimationFrame(() => setIdx(hallIdx, false));
  };

  /* ======================= COLLECTION ==================================== */
  let colCat = 'all';
  R.collection = function () {
    const st = S(), list = A().LIST, done = Object.keys(st.completed).length;
    const cats = [['all', 'All'], ['weapons', 'Weapons'], ['artifacts', 'Artifacts'], ['relics', 'Relics']];
    const shown = list.filter(a => colCat === 'all' || a.category === colCat);
    $('#collectionRoot').innerHTML = `
      ${UI.header({ title: 'Artifact Collection', kicker: 'Forged through dedication', right: `<button class="icon-btn" data-go="hall" aria-label="Hall of Legends">${I('hall')}</button>` })}
      <div class="content">
        <div class="seg" role="tablist" aria-label="Category">${cats.map(([k, l]) => `<button role="tab" aria-selected="${colCat === k}" data-cat="${k}">${l}</button>`).join('')}</div>
        <div class="col-summary"><span class="caps dim">Legendary</span><b class="num">${done} / ${list.length}</b><span class="spacer"></span><button class="link-btn" data-go="hall">View Hall ${I('next')}</button></div>
        <div class="col-grid">
          ${shown.map(a => { const as = St().artifactState(a.id), p = st.progress[a.id];
            const status = as.state === 'legendary' ? 'Legendary' : as.state === 'locked' ? '0 / 7' : `${as.tier + 1} / 7`;
            return `<button class="col-tile ${as.state}" data-id="${a.id}" aria-label="${esc(a.name)}, ${as.state === 'locked' ? 'locked' : status}">
              <div class="col-art artifact-stage">${UI.artifactStage(a.id, as.tier, St().pctFor(a.id), { silhouette: as.state === 'locked' })}${as.state === 'locked' ? `<span class="lock">${I('lock')}</span>` : ''}</div>
              <div class="col-name">${esc(a.name)}</div>
              <div class="col-status ${as.state === 'legendary' ? 'leg' : ''}">${as.state === 'current' ? '<span class="dot"></span>' : ''}${status}</div>
            </button>`; }).join('')}
        </div>
      </div>`;
    $('#collectionRoot').querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { colCat = b.dataset.cat; ES.Audio.play('ui'); R.collection(); });
    $('#collectionRoot').querySelectorAll('.col-tile').forEach(t => {
      const a = A().get(t.dataset.id), as = St().artifactState(a.id), p = st.progress[a.id];
      UI.wireHeat(t, a.id, St().pctFor(a.id));
      t.onclick = () => tileSheet(a.id);
    });
  };
  function tileSheet(id) {
    const a = A().get(id), as = St().artifactState(id);
    if (as.state === 'current' || as.state === 'legendary' || as.state === 'locked') return inspect(id);
    UI.sheet({
      kicker: a.type, title: a.name,
      body: `<div class="inspect-stage artifact-stage small">${UI.artifactStage(id, as.tier, St().pctFor(id))}</div><p class="center small muted">${as.state === 'started' ? `Resting at ${A().TIERS[as.tier]}. Your progress is kept.` : 'A new work for the anvil.'} Your current work keeps its heat while you switch.</p>`,
      onMount: w => UI.wireHeat(w, id, St().pctFor(id)),
      actions: [{ label: 'Place on the anvil', primary: true, onClick: () => { St().selectArtifact(id); UI.toast(a.name + ' is on the anvil.'); UI.go('forge'); } }, { label: 'Inspect', ghost: true, onClick: () => setTimeout(() => inspect(id), 240) }]
    });
  }

  /* ======================= DAILY ========================================= */
  let calMonth = null;
  R.daily = function () {
    const now = new Date(), key = St().today();
    if (!calMonth) calMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
    const d = St().dailyFor(key) || { sets: 0 }, g = inProgress(), dailyG = g && g.daily && g.dailyKey === key ? g : null;
    let streak = 0; for (let i = 0; i < 400; i++) { const dt = new Date(now); dt.setDate(now.getDate() - i); const r = St().dailyFor(St().today(dt)); if (r && r.rewarded) streak++; else if (i > 0) break; }
    const cells = [];
    for (let i = 0; i < first; i++) cells.push('<span class="day pad"></span>');
    for (let dd = 1; dd <= days; dd++) {
      const k = St().today(new Date(y, m, dd)), r = St().dailyFor(k), isToday = k === key, future = new Date(y, m, dd) > now && !isToday;
      const cls = ['day', r && r.perfect ? 'perfect' : r && r.rewarded ? 'done' : '', isToday ? 'today' : '', future ? 'future' : ''].join(' ');
      cells.push(`<span class="${cls}" aria-label="${new Date(y, m, dd).toDateString()}${r && r.perfect ? ', perfect' : r && r.rewarded ? ', completed' : ''}"><b>${dd}</b></span>`);
    }
    const monthName = calMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const canNext = new Date(y, m + 1, 1) <= now;
    $('#dailyRoot').innerHTML = `
      ${UI.header({ title: 'Daily Challenge', kicker: 'Return to the forge' })}
      <div class="content daily">
        <div class="panel ledger">
          <div class="ledger-head"><button class="icon-btn" id="calPrev" aria-label="Previous month">${I('back')}</button><div class="display sm">${monthName}</div><button class="icon-btn" id="calNext" aria-label="Next month" ${canNext ? '' : 'disabled'}>${I('next')}</button></div>
          <div class="cal-dow">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(x => `<span>${x}</span>`).join('')}</div>
          <div class="cal" role="grid">${cells.join('')}</div>
          <div class="legend small muted"><span><i class="lg-dot done"></i>Completed</span><span><i class="lg-dot perfect"></i>Perfect</span><span><i class="lg-dot today"></i>Today</span><span class="streak">${I('flame')}${streak} day streak</span></div>
        </div>
        <div class="panel today-panel ${d.rewarded ? '' : 'glow'}">
          <div class="tp-stamp">${d.perfect ? '<span class="stamp perfect"></span>' : d.rewarded ? '<span class="stamp done"></span>' : I('play')}</div>
          <div class="tp-body">
            <div class="caps">Today's Challenge</div>
            <div class="display md">Spider — 2 Suit</div>
            <div class="small muted">Complete ${St().DAILY_GOAL_SETS} full sequences.${d.rewarded && !d.perfect ? ' Win the hand for a white-hot stamp.' : ''}</div>
            <div class="tp-progress">${UI.molten(Math.min(1, (dailyG ? dailyG.bestCompleted : d.sets || 0) / St().DAILY_GOAL_SETS), { thin: true })}<span class="small num">${Math.min(St().DAILY_GOAL_SETS, dailyG ? dailyG.bestCompleted : d.sets || 0)} / ${St().DAILY_GOAL_SETS}</span></div>
          </div>
          <div class="tp-reward"><span class="caps dim">Reward</span><b class="num">+${St().DAILY_REWARD}</b><span class="caps">Ember</span></div>
        </div>
        <div class="cta ${d.rewarded ? '' : 'is-ready'}"><button class="btn btn-primary btn-block" id="dailyPlay">${dailyG ? 'Continue Challenge' : d.perfect ? 'Replay Challenge' : d.rewarded ? 'Play Again' : 'Play Challenge'}</button></div>
        <p class="small muted center">Everyone receives the same deal today. The ledger resets at midnight.</p>
      </div>`;
    $('#calPrev').onclick = () => { calMonth = new Date(y, m - 1, 1); R.daily(); };
    $('#calNext').onclick = () => { if (canNext) { calMonth = new Date(y, m + 1, 1); R.daily(); } };
    $('#dailyPlay').onclick = () => { ES.Audio.unlock(); if (dailyG) resumeGame(); else newGame(2, { daily: true, dailyKey: key }); };
  };

  /* ======================= PROFILE / STATISTICS ========================== */
  function achievements() {
    const s = S().stats, c = Object.keys(S().completed).length, b = s.bySuits;
    return [
      ['First Flame', 'Win a hand', s.wins >= 1, 'flame', 'ember'],
      ['Sequence Smith', 'Forge 25 sequences', s.sequences >= 25, 'sets', 'bronze'],
      ['Tempered Hand', 'Win 10 hands', s.wins >= 10, 'trophy', 'bronze'],
      ['Twin Suits', 'Win a 2 suit hand', (b[2] || {}).wins >= 1, 'cards', 'bronze'],
      ['Four Crowns', 'Win a 4 suit hand', (b[4] || {}).wins >= 1, 'star', 'gold'],
      ['Unbroken', 'Win 5 in a row', s.bestStreak >= 5, 'shield', 'gold'],
      ['Swift Hammer', 'Win in under 8 minutes', s.bestTimeMs != null && s.bestTimeMs < 480000, 'clock', 'ember'],
      ['Economy of Motion', 'Win in under 150 moves', s.lowestMoves != null && s.lowestMoves < 150, 'moves', 'ember'],
      ['Devotion', 'Complete 7 daily challenges', s.dailies >= 7, 'challenges', 'bronze'],
      ['Reforged', 'Reach Reforged on any artifact', Object.values(S().progress).some(p => p.tier >= 1) || c > 0, 'forge', 'bronze'],
      ['Masterwork', 'Reach Masterwork on any artifact', Object.values(S().progress).some(p => p.tier >= 3) || c > 0, 'hint', 'gold'],
      ['Legend Forged', 'Place an artifact in the Hall', c >= 1, 'hall', 'gold']
    ];
  }
  R.profile = function () {
    const st = S(), s = st.stats, fav = St().favoriteSuits(), ach = achievements(), earned = ach.filter(a => a[2]).length;
    const rows = [
      ['trophy', 'Games Won', n(s.wins)],
      ['percent', 'Win Rate', s.games ? Math.round(s.wins / s.games * 100) + '%' : '—'],
      ['sets', 'Sequences Forged', n(s.sequences)],
      ['clock', 'Play Time', UI.dur(s.playMs)],
      ['cards', 'Favorite Difficulty', fav ? fav + ' Suit' : '—'],
      ['flame', 'Current Streak', n(s.streak)],
      ['star', 'Best Streak', n(s.bestStreak)],
      ['moves', 'Lowest Moves', s.lowestMoves == null ? '—' : n(s.lowestMoves)],
      ['clock', 'Best Time', s.bestTimeMs == null ? '—' : UI.clock(s.bestTimeMs)],
      ['flame', 'Total Ember', n(st.totalEmber)],
      ['hall', 'Legendary Artifacts', n(Object.keys(st.completed).length)],
      ['play', 'Games Played', n(s.games)],
      ['challenges', 'Daily Challenges', n(s.dailies)]
    ];
    $('#profileRoot').innerHTML = `
      ${UI.header({ title: 'Forge Record', kicker: 'The smith’s ledger', right: `<button class="icon-btn" data-go="settings" aria-label="Settings">${I('settings')}</button>` })}
      <div class="content profile">
        <div class="panel smith">
          ${UI.levelBadge()}
          <div class="smith-meta"><div class="caps">Forge Level ${st.forgeLevel}</div>${UI.molten(St().levelProgress(), { thin: true })}<div class="small muted num">${n(st.totalEmber)} total Ember · ${n(St().LEVEL_EMBER - st.totalEmber % St().LEVEL_EMBER)} to level ${st.forgeLevel + 1}</div></div>
        </div>
        <div class="panel stat-list" role="list">
          ${rows.map(r => `<div class="stat-row" role="listitem"><span class="stat-ico">${I(r[0])}</span><span class="stat-k">${r[1]}</span><b class="stat-v num">${r[2]}</b></div>`).join('')}
        </div>
        <div class="panel ach">
          <div class="panel-title"><span class="caps">Achievements</span><span class="num small">${earned} / ${ach.length}</span></div>
          <div class="medals">${ach.map(a => `<div class="medal-cell" title="${esc(a[1])}">${ES.Icons.medal(a[3], a[2], a[4])}<span class="${a[2] ? '' : 'muted'}">${esc(a[0])}</span><small>${esc(a[1])}</small></div>`).join('')}</div>
        </div>
      </div>`;
  };

  /* ======================= SETTINGS ====================================== */
  R.settings = function () {
    const s = S().settings, M = ES.Manifest;
    const sw = (k, label, sub, ico) => `<div class="set-row"><span class="set-ico">${I(ico)}</span><div class="set-txt"><b id="lbl-${k}">${label}</b><span>${sub}</span></div><button class="switch" role="switch" aria-checked="${!!s[k]}" aria-labelledby="lbl-${k}" data-k="${k}"></button></div>`;
    const rg = (k, label, ico) => `<div class="set-row"><span class="set-ico">${I(ico)}</span><div class="set-txt"><b id="lbl-${k}">${label}</b></div><input class="range" type="range" min="0" max="100" value="${Math.round(s[k] * 100)}" style="--v:${Math.round(s[k] * 100)}%" aria-labelledby="lbl-${k}" data-k="${k}"></div>`;
    const nav = (id, label, val, ico) => `<button class="set-row link" id="${id}"><span class="set-ico">${I(ico)}</span><div class="set-txt"><b>${label}</b></div><span class="set-val">${esc(val)}</span>${I('next', 'chev')}</button>`;
    $('#settingsRoot').innerHTML = `
      ${UI.header({ back: true, title: 'Settings', kicker: 'Workshop preferences' })}
      <div class="content settings">
        <div class="panel set-group">
          ${rg('music', 'Music', 'music')}
          ${rg('sfx', 'Sound Effects', 'sound')}
          ${sw('haptics', 'Haptics', 'Tactile feedback on moves', 'haptics')}
          ${sw('reduced', 'Reduced Motion', 'Instant card moves, no particles', 'motion')}
          ${sw('contrast', 'High Contrast', 'Bolder text and card indices', 'contrast')}
          ${sw('largeCards', 'Large Cards', 'Bigger ranks and suits on the board', 'cards')}
          ${sw('oneTap', 'One-Tap Moves', 'Tap a card to send it to its best spot', 'moves')}
        </div>
        <div class="panel set-group">
          ${nav('setBacks', 'Card Backs', M.backs[s.cardBack].name, 'cardback')}
          ${nav('setTables', 'Table Themes', M.tables[s.table].name, 'table')}
          ${nav('setAbout', 'About', 'v' + ES.Build.version, 'about')}
        </div>
        <div class="panel set-group">
          ${ES.Ads.privacyOptionsAvailable() ? nav('setPrivacyChoices', 'Privacy Choices', 'Ads and data', 'shield') : ''}
          ${nav('setPrivacy', 'Privacy Policy', '', 'about')}
        </div>
        <div class="panel set-group">
          ${nav('setTutorial', 'Replay Tutorial', '', 'hint')}
          ${nav('setReset', 'Reset Progress', '', 'restart')}
        </div>
      </div>`;
    const root = $('#settingsRoot');
    root.querySelectorAll('.switch').forEach(b => b.onclick = () => { const k = b.dataset.k; s[k] = !s[k]; b.setAttribute('aria-checked', s[k]); ES.Audio.play('ui'); UI.applySettings(); St().save(); if (k === 'largeCards' || k === 'contrast') ES.Board.refreshTheme(); });
    root.querySelectorAll('.range').forEach(r => r.oninput = () => { s[r.dataset.k] = r.value / 100; r.style.setProperty('--v', r.value + '%'); ES.Audio.unlock(); UI.applySettings(); St().save(); });
    root.querySelectorAll('.range').forEach(r => r.onchange = () => ES.Audio.play(r.dataset.k === 'sfx' ? 'place' : 'ui'));
    $('#setBacks').onclick = () => chooser('Card Backs', M.backs, 'cardBack', k => `<img src="${M.back(k, true)}" alt="" loading="lazy">`);
    $('#setTables').onclick = () => chooser('Table Themes', M.tables, 'table', k => `<span class="tbl-swatch" style="background-image:url('${M.tables[k].src}')"></span>`);
    const pc = $('#setPrivacyChoices'); if (pc) pc.onclick = () => ES.Ads.showPrivacyOptions();
    $('#setPrivacy').onclick = () => ES.Platform.openUrl(ES.Build.privacyUrl);
    $('#setAbout').onclick = () => UI.sheet({ kicker: 'A Horizon Forge Game', title: 'Ember Solitaire', body: `<img class="about-emblem" src="${M.branding.emblemSmall}" alt=""><p class="center small muted">Version ${ES.Build.version} (${ES.Build.versionCode})<br>Support: <a href="mailto:${esc(ES.Build.supportEmail)}">${esc(ES.Build.supportEmail)}</a><br>Classic Spider Solitaire inside an ancient forge.<br>Every hand feeds the flame.</p><p class="center small muted">Keyboard: ← → choose a column · Enter pick up / place · ↑ ↓ adjust run · D deal · U undo · H hint</p>` });
    $('#setTutorial').onclick = () => { S().ftue.tutorial = false; St().save(); ES.Tutorial.start(); };
    $('#setReset').onclick = () => UI.sheet({ title: 'Reset Progress?', body: '<p class="center small muted">All Ember, artifacts, statistics and the hand in progress will be erased. This cannot be undone.</p>', actions: [{ label: 'Keep my progress', primary: true }, { label: 'Erase everything', ghost: true, onClick: () => { St().reset(); UI.applySettings(); UI.toast('Progress reset.'); UI.go('home'); } }] });
  };
  function chooser(title, map, key, thumb) {
    const s = S().settings;
    UI.sheet({
      title, cls: 'chooser',
      body: `<div class="choice-grid">${Object.keys(map).map(k => `<button class="choice-tile ${s[key] === k ? 'is-on' : ''}" aria-pressed="${s[key] === k}" data-k="${k}">${thumb(k)}<span>${esc(map[k].name)}</span></button>`).join('')}</div>`,
      onMount: (w, close) => w.querySelectorAll('.choice-tile').forEach(b => b.onclick = () => { s[key] = b.dataset.k; St().save(); ES.Board.refreshTheme(); ES.Audio.play('pick'); close(); R.settings(); })
    });
  }

  ES.Screens = { newGame, resumeGame, inProgress, pauseMenu, inspect, stuckSheet, stoke, stokeButton, endGame, hallFocus(id) { hallIdx = A().LIST.findIndex(a => a.id === id); } };
})(typeof window !== 'undefined' ? window : globalThis);
