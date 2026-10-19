/* ==========================================================================
   EMBER SOLITAIRE — First-time experience + 1 Suit tutorial (< 90 seconds)
   Splash → Intro forge → Choose first artifact → Placed on the anvil →
   BROKEN IMITATION → Begin Forging → guided 1 Suit hand
   ========================================================================== */
(function (root) {
  'use strict';
  const ES = root.ES = root.ES || {};
  const UI = ES.UI, St = () => ES.Store, S = () => ES.Store.state, A = () => ES.Artifacts;
  const { $, esc, I } = UI;

  /* ---------- intro scene ------------------------------------------------- */
  let pick = 'sword';
  function intro() {
    UI.go('intro', { focus: false });
    T.t0 = Date.now(); ES.Analytics.log('ftue_start', {});
    story();
  }
  UI.renderers.intro = function () {};
  function story() {
    $('#introRoot').innerHTML = `
      <div class="intro-story">
        <p class="line l1">Deep beneath the mountain,<br>an ancient forge still burns.</p>
        <p class="line l2">It feeds on patience. On skill.<br>On every hand you play.</p>
        <p class="line l3 caps">Every forge begins with a broken imitation.</p>
      </div>
      <div class="intro-cta content"><div class="cta"><button class="btn btn-primary btn-block" id="introGo">Enter the Forge</button></div></div>`;
    $('#introGo').onclick = () => { ES.Audio.unlock(); ES.Audio.play('ui'); choose(); };
    setTimeout(() => $('#introGo') && $('#introGo').focus(), 400);
  }
  function choose() {
    const opts = ['sword', 'shield', 'hammer'];
    $('#introRoot').innerHTML = `
      <div class="intro-choose">
        <div class="caps center">The first work</div>
        <h2 class="display lg center">Choose Your Artifact</h2>
        <div class="ornament"></div>
        <div class="choose-row" role="radiogroup" aria-label="First artifact">
          ${opts.map(id => { const a = A().get(id); return `<button class="choose-opt ${pick === id ? 'is-on' : ''}" role="radio" aria-checked="${pick === id}" data-id="${id}">
            <div class="artifact-stage">${UI.artifactStage(id, 0, 0, {})}</div><span class="display sm">${esc(a.name)}</span><span class="caps dim">${a.type}</span></button>`; }).join('')}
        </div>
        <p class="center small muted choose-note">${pickNote(pick)}</p>
      </div>
      <div class="intro-cta content"><div class="cta"><button class="btn btn-primary btn-block" id="chooseGo">Choose ${esc(A().get(pick).name)}</button></div></div>`;
    $('#introRoot').querySelectorAll('.choose-opt').forEach(b => b.onclick = () => { pick = b.dataset.id; ES.Audio.play('pick'); choose(); $(`.choose-opt[data-id="${pick}"]`).focus(); });
    $('#chooseGo').onclick = place;
  }
  function pickNote(id) { return { sword: 'A blade that remembers fire.', shield: 'A ward against the dark.', hammer: 'The heart of every forge.' }[id]; }
  async function place() {
    St().selectArtifact(pick);
    ES.Analytics.log('artifact_selected', { artifact: pick });
    const a = A().get(pick);
    $('#introRoot').innerHTML = `
      <div class="intro-place">
        <div class="artifact-stage place-stage" id="placeStage">${UI.artifactStage(pick, 0, 0, { prop: 'anvil' })}</div>
        <div class="place-title"><h2 class="display lg ember-text">Broken Imitation</h2><div class="display sm">${esc(a.name)}</div><p class="muted small">“${A().TIER_LORE[0]}”</p></div>
      </div>
      <div class="intro-cta content place-cta"><div class="cta is-ready"><button class="btn btn-primary btn-block" id="beginGo">Begin Forging</button></div></div>`;
    const stg = $('#placeStage');
    stg.classList.add('dropping');
    setTimeout(() => { ES.Audio.play('strike'); ES.Audio.haptic([20, 30, 40]); const r = stg.getBoundingClientRect(); ES.FX.sparks(r.left + r.width / 2, r.top + r.height * 0.62, 18, 90, { up: true }); stg.classList.add('landed'); }, ES.FX.motion() ? 720 : 0);
    setTimeout(() => $('#introRoot .intro-place').classList.add('show-title'), ES.FX.motion() ? 1200 : 0);
    $('#beginGo').onclick = () => { S().ftue.intro = true; St().save(true); start(); };
  }

  /* ---------- tutorial hand ------------------------------------------------ */
  const T = { step: null, el: null, lastRes: null };
  function tutorialDeal() {
    // pick a seed whose opening has a same-suit move that also reveals a card
    for (let s = 1; s < 400; s++) {
      const g = ES.Engine.newGame(1, { seed: 9000 + s });
      const h = ES.Engine.hints(g);
      if (h.length >= 2 && h[0].score >= 60) return g;
    }
    return ES.Engine.newGame(1);
  }
  function start() {
    const g = tutorialDeal(); g.run = 0; g.tutorial = true;
    g.initial = JSON.parse(JSON.stringify({ cols: g.cols, stock: g.stock }));
    St().startGame(g);
    UI.go('game', { focus: false });
    ES.Board.start(g, { animateDeal: true });
    mountCoach();
    setTimeout(() => step('move'), ES.FX.motion() ? 1500 : 100);
  }
  function mountCoach() {
    if (T.el) T.el.remove();
    T.el = document.createElement('div'); T.el.className = 'coach'; T.el.setAttribute('role', 'status'); T.el.setAttribute('aria-live', 'polite');
    document.querySelector('#scr-game .fg').appendChild(T.el);
  }
  function coach(html, actions) {
    T.el.innerHTML = `<div class="coach-card"><div class="coach-text">${html}</div><div class="coach-actions"><button class="link-btn" data-t="skip">Skip tutorial</button>${actions || ''}</div></div>`;
    T.el.classList.remove('is-in'); void T.el.offsetWidth; T.el.classList.add('is-in');
    T.el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { ES.Audio.play('ui'); const t = b.dataset.t; if (t === 'skip') end(true); else step(t); });
  }
  function step(name) {
    ES.Analytics.log('tutorial_step', { step: name });
    T.step = name; ES.Board.clearHints(); ES.Board.stockHighlight(false);
    const g = ES.Board.game; if (!g) return end();
    if (name === 'move') {
      const h = ES.Engine.hints(g)[0];
      if (h) ES.Board.highlight(h.from, h.idx, h.to);
      coach(`<b>Drag a card onto a card exactly one rank higher.</b><span>Try the glowing card — or tap it, then tap its destination.</span>`);
    } else if (name === 'reveal') {
      coach(T.lastRes && T.lastRes.revealed ? `<b>Well struck.</b><span>Uncovered cards turn face up and open new moves. Tip: double-tap a card to send it to its best spot.</span>` : `<b>Well struck.</b><span>Runs of the same suit move together. Tip: double-tap a card to send it to its best spot.</span>`, `<button class="btn" data-t="stock">Next</button>`);
    } else if (name === 'stock') {
      ES.Board.stockHighlight(true);
      coach(`<b>Out of moves? Deal from the stock.</b><span>One card lands on every column. Each column must hold a card first.</span>`, `<button class="btn" data-t="goal">Next</button>`);
    } else if (name === 'goal') {
      coach(`<b>Build King down to Ace in one suit.</b><span>A finished run is forged into a set. Forge all eight to win — and feed the flame.</span>`, `<button class="btn btn-primary" data-t="done">Got it</button>`);
    } else if (name === 'done') end();
  }
  function end(skipped) {
    if (T.step) ES.Analytics.log(skipped ? 'tutorial_skip' : 'ftue_complete', skipped ? { step: T.step } : { seconds: Math.round((Date.now() - (T.t0 || Date.now())) / 1000) });
    S().ftue.tutorial = true; St().save();
    ES.Board.clearHints(); ES.Board.stockHighlight(false);
    if (T.el) { T.el.classList.remove('is-in'); const e = T.el; setTimeout(() => e.remove(), 300); T.el = null; }
    T.step = null;
  }
  function notify(res) {
    if (!T.step || !res || !res.ok) return;
    T.lastRes = res;
    if (T.step === 'move' && res.type === 'move') setTimeout(() => step('reveal'), 350);
    else if (T.step === 'stock' && res.type === 'deal') setTimeout(() => step('goal'), 500);
  }

  ES.Tutorial = { intro, start, notify, end, get active() { return !!T.step; } };
})(typeof window !== 'undefined' ? window : globalThis);
