/* ==========================================================================
   EMBER SOLITAIRE — Board: keyed card renderer, motion, drag & tap input
   Presentation only. Every rule decision is delegated to ES.Engine.
   ========================================================================== */
(function (root) {
  'use strict';
  const ES = root.ES = root.ES || {};
  const E = () => ES.Engine;
  const $ = s => document.querySelector(s);

  const B = {
    g: null, el: null, table: null, els: new Map(), pos: new Map(), L: null,
    sel: null, drag: null, hintIdx: 0, hintTimer: 0, kb: { col: 0, active: false }, busy: 0,
    timer: 0, paused: false, onWin: null, lastTick: 0
  };

  /* ---------- helpers ------------------------------------------------------ */
  const motion = () => ES.FX.motion();
  const faceUrl = c => ES.Manifest.card(c.rank, c.suit);
  function announce(msg) { const l = $('#gLive'); if (l) { l.textContent = ''; setTimeout(() => (l.textContent = msg), 30); } }
  function fmtTime(ms) { const s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }

  /* ---------- layout ------------------------------------------------------- */
  function computeLayout() {
    const g = B.g, W = B.el.clientWidth, Hvis = B.table.clientHeight;
    const large = ES.Store.state.settings.largeCards;
    const padX = Math.max(3, Math.round(W * 0.01));
    const gap = Math.max(large ? 2 : 3, Math.min(10, Math.round(W * 0.008)));
    const colW = (W - padX * 2 - gap * 9) / 10;
    const maxW = large ? 150 : 124;
    let cw = Math.min(colW, maxW, (Hvis * 0.3) / 1.4);
    cw = Math.max(26, cw);
    const ch = cw * 1.4;
    const extra = colW - cw;
    const idxH = large ? Math.max(20, cw * 0.4) : Math.max(15, cw * 0.33);
    const padT = 6;
    const avail = Math.max(ch * 2, Hvis - padT - ch - 10);
    const cols = [];
    let maxBottom = 0;
    for (let c = 0; c < 10; c++) {
      const col = g.cols[c];
      const nDown = col.filter(x => !x.up).length, nUp = col.length - nDown;
      let fd = Math.max(5, ch * 0.12), fu = Math.max(idxH + 4, ch * 0.42);
      const need = () => Math.max(0, nDown - (nUp ? 0 : 1)) * fd + Math.max(0, nUp - 1) * fu + (nUp && nDown ? fd : 0);
      if (need() > avail) { fd = Math.max(3, Math.min(fd, (avail * 0.18) / Math.max(1, nDown))); }
      if (need() > avail && nUp > 1) { fu = Math.max(idxH + 1, (avail - nDown * fd) / (nUp - 1)); }
      const x = padX + c * (colW + gap) + extra / 2;
      let y = padT; const items = [];
      col.forEach((card, i) => { items.push({ id: card.id, x, y, z: i + 1, up: card.up }); y += card.up ? fu : fd; });
      const bottom = items.length ? items[items.length - 1].y + ch : padT + ch;
      maxBottom = Math.max(maxBottom, bottom);
      cols.push({ x, items, fu, fd, top: items.length ? items[items.length - 1].y : padT });
    }
    return { W, cw, ch, colW, gap, padX, padT, cols, height: Math.max(Hvis, maxBottom + 12), idxH };
  }

  /* Screen-reader column controls (TalkBack / VoiceOver): one invisible button per column,
     laid over the column so explore-by-touch finds it. Double-tap picks up the movable run,
     double-tap another column places it. Cards themselves stay out of the accessibility tree. */
  function a11yColumns() {
    const g = B.g, L = B.L; if (!B.a11y || !g) return;
    for (let c = 0; c < 10; c++) {
      const b = B.a11y[c], col = g.cols[c], top = col[col.length - 1];
      b.style.transform = `translate3d(${L.cols[c].x}px, 0, 0)`;
      b.style.width = L.cw + 'px'; b.style.height = Math.max(L.ch, L.cols[c].top + L.ch) + 'px';
      const down = col.filter(x => !x.up).length;
      let i = col.length - 1; while (i > 0 && E().movable(col, i - 1)) i--;
      const run = col.length ? col.length - i : 0;
      let label = `Column ${c + 1}. `;
      label += col.length ? `${E().cardName(top)} on top` + (run > 1 ? `, run of ${run} from ${E().cardName(col[i])}` : '') + (down ? `, ${down} face down` : '') + '.' : 'Empty.';
      if (B.sel && B.sel.col === c) label += ' Selected. Double-tap to cancel.';
      else if (B.sel) label += E().canMove(g, B.sel.col, B.sel.idx, c) ? ' Double-tap to place the selected cards here.' : ' Selected cards cannot go here.';
      else if (col.length && top.up) label += ' Double-tap to pick up.';
      b.setAttribute('aria-label', label);
    }
  }
  function a11yActivate(c) {
    const g = B.g; if (!g) return;
    if (B.sel) { if (B.sel.col === c) { select(null); announce('Selection cancelled.'); } else tapColumn(c); a11yColumns(); return; }
    const col = g.cols[c]; if (!col.length) { announce('Empty column.'); return; }
    let i = col.length - 1; while (i > 0 && E().movable(col, i - 1)) i--;
    tapCard(c, i); a11yColumns();
  }

  function applyLayoutVars() {
    const L = B.L;
    B.el.style.setProperty('--cw', L.cw + 'px');
    B.el.style.setProperty('--chh', L.ch + 'px');
    B.el.style.height = L.height + 'px';
    B.el.classList.toggle('small-cards', L.cw < 84);
    // empty-slot + highlight markers
    for (let c = 0; c < 10; c++) {
      const slot = B.slots[c], hl = B.hls[c], col = L.cols[c];
      slot.style.transform = `translate3d(${col.x}px, ${L.padT}px, 0)`;
      slot.classList.toggle('is-empty', !B.g.cols[c].length);
      hl.style.transform = `translate3d(${col.x}px, ${col.top}px, 0)`;
    }
  }

  /* ---------- card elements ------------------------------------------------ */
  function makeCard(card) {
    const d = document.createElement('div');
    d.className = 'card';
    d.dataset.id = card.id;
    const red = E().isRed(card);
    d.innerHTML = `<div class="face" style="background-image:url('${faceUrl(card)}')"><span class="idx${red ? ' red' : ''}"><b>${E().rankLabel(card.rank)}</b><i>${E().SUIT_GLYPH[card.suit]}</i></span></div><div class="back"></div>`;
    d.setAttribute('aria-hidden', 'true');
    B.el.appendChild(d);
    B.els.set(card.id, d);
    return d;
  }
  function setFace(d, up) { d.classList.toggle('down', !up); }
  function place(d, p, lift) {
    d.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
    d.style.zIndex = lift ? 1000 + p.z : p.z;
  }

  /* ---------- reconcile + animate -----------------------------------------
     anim: { type: 'move'|'deal'|'undo'|'initial', moved:[ids], dealt:[ids],
             revealed:[ids], completions:[{cards}], from, to }                */
  function render(anim) {
    anim = anim || {};
    const g = B.g; if (!g) return;
    const prevPos = new Map(B.pos);
    const prevUp = new Map(); B.els.forEach((d, id) => prevUp.set(id, !d.classList.contains('down')));
    B.L = computeLayout();
    applyLayoutVars();
    const live = new Set();
    const moving = new Set(anim.moved || []);
    const dealt = new Set(anim.dealt || []);
    const doMotion = motion() && anim.type && anim.type !== 'none';
    const stockPt = stockPoint();
    let dealIndex = 0;

    B.L.cols.forEach((col, ci) => col.items.forEach((p, i) => {
      live.add(p.id);
      let d = B.els.get(p.id); const isNew = !d;
      if (!d) d = makeCard(g.cols[ci][i]);
      const wasUp = prevUp.get(p.id);
      d.classList.toggle('sel', !!(B.sel && B.sel.col === ci && i >= B.sel.idx));
      d.dataset.col = ci; d.dataset.idx = i;
      const prev = prevPos.get(p.id);
      B.pos.set(p.id, p);

      if (doMotion && dealt.has(p.id)) {
        // stock → column cascade with a mid-flight flip
        const k = anim.type === 'initial' ? (ci + i * 10) : dealIndex++;
        const delay = anim.type === 'initial' ? (i * 10 + ci) * 16 : ci * 30;
        setFace(d, false); place(d, p, true);
        const kf = [
          { transform: `translate3d(${stockPt.x - B.L.cw / 2}px, ${stockPt.y - B.L.ch / 2}px, 0) scale(.86) rotate(${k % 2 ? 4 : -4}deg)`, opacity: 0.0 },
          { offset: 0.08, opacity: 1 },
          { offset: 0.82, transform: `translate3d(${p.x}px, ${p.y - 4}px, 0) scale(1.02)` },
          { transform: `translate3d(${p.x}px, ${p.y}px, 0) scale(1)`, opacity: 1 }
        ];
        const dur = anim.type === 'initial' ? 300 : 320;
        d.animate(kf, { duration: dur, delay, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards' }).onfinish = () => { place(d, p); };
        if (p.up) setTimeout(() => flip(d, true), delay + dur * 0.5);
        if (anim.type !== 'initial' && ci === 0) ES.Audio.play('deal');
        return;
      }
      if (isNew && anim.type === 'undo' && anim.restoredFromSet) {
        setFace(d, p.up); place(d, p);
        if (doMotion) { const t = setPoint(g.completed); d.animate([{ transform: `translate3d(${t.x - B.L.cw / 2}px, ${t.y - B.L.ch / 2}px, 0) scale(.3)`, opacity: 0 }, { transform: `translate3d(${p.x}px, ${p.y}px, 0)`, opacity: 1 }], { duration: 320, delay: (12 - (i % 13)) * 14, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards' }); }
        return;
      }
      if (isNew && anim.type === 'undo' && anim.restoredFromStock) { /* handled by dealt reverse below */ }

      // face changes
      if (!isNew && wasUp === false && p.up) { place(d, p); if (doMotion) flip(d, true); else setFace(d, true); }
      else setFace(d, p.up);

      if (doMotion && prev && (Math.abs(prev.x - p.x) > 0.5 || Math.abs(prev.y - p.y) > 0.5)) {
        const isMover = moving.has(p.id) || anim.type === 'undo';
        place(d, p, isMover);
        const dist = Math.hypot(prev.x - p.x, prev.y - p.y);
        if (isMover && dist > 8) {
          const dur = anim.type === 'undo' ? 290 : Math.min(300, 220 + dist * 0.12);
          const from = anim.fromDrag ? prev : { x: prev.x, y: prev.y };
          const lift = anim.fromDrag ? 0 : -5;
          d.animate([
            { transform: `translate3d(${from.x}px, ${from.y}px, 0) scale(${anim.fromDrag ? 1.04 : 1})`, boxShadow: 'var(--card-shadow)' },
            { offset: anim.fromDrag ? 0 : 0.16, transform: `translate3d(${from.x}px, ${from.y + lift}px, 0) scale(1.03)`, boxShadow: 'var(--card-shadow-lift)' },
            { offset: 0.84, transform: `translate3d(${p.x}px, ${p.y - 2}px, 0) scale(1.015)`, boxShadow: 'var(--card-shadow-lift)' },
            { transform: `translate3d(${p.x}px, ${p.y}px, 0) scale(1)`, boxShadow: 'var(--card-shadow)' }
          ], { duration: dur, easing: 'cubic-bezier(.25,.8,.25,1)' }).onfinish = () => place(d, p);
        } else {
          d.animate([{ transform: `translate3d(${prev.x}px, ${prev.y}px, 0)` }, { transform: `translate3d(${p.x}px, ${p.y}px, 0)` }], { duration: 200, easing: 'cubic-bezier(.25,.8,.25,1)' }).onfinish = () => place(d, p);
        }
      } else {
        place(d, p);
      }
    }));

    // destination glow
    if (doMotion && anim.type === 'move' && anim.to != null) flashColumn(anim.to);

    // removed cards
    const completedIds = new Map();
    (anim.completions || []).forEach((cmp, k) => cmp.cards.forEach((c, i) => completedIds.set(c.id, { k, i, n: cmp.cards.length, slot: g.completed - (anim.completions.length - k) })));
    const toRemove = [];
    B.els.forEach((d, id) => { if (!live.has(id)) toRemove.push([id, d]); });
    const byCompletion = [];
    toRemove.forEach(([id, d]) => {
      const cm = completedIds.get(id);
      const prev = B.pos.get(id) || prevPos.get(id);
      B.els.delete(id); B.pos.delete(id);
      if (cm && prev) { byCompletion.push({ d, prev, cm }); return; }
      if (anim.type === 'undo' && doMotion && prev) {
        // cards un-dealt back to the stock
        d.style.zIndex = 1500;
        setTimeout(() => flip(d, false), 60);
        d.animate([{ transform: `translate3d(${prev.x}px, ${prev.y}px, 0)` }, { transform: `translate3d(${stockPt.x - B.L.cw / 2}px, ${stockPt.y - B.L.ch / 2}px, 0) scale(.86)`, opacity: 0.2 }], { duration: 300, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).onfinish = () => d.remove();
        return;
      }
      d.remove();
    });
    if (byCompletion.length) sequenceComplete(byCompletion);
    updateHud();
  }

  function flip(d, toUp) {
    if (!motion()) { setFace(d, toUp); return; }
    const a = d.animate([{ transform: d.style.transform + ' scaleX(1)' }, { transform: d.style.transform + ' scaleX(0.02)' }], { duration: 110, easing: 'ease-in' });
    a.onfinish = () => {
      setFace(d, toUp); ES.Audio.play('flip');
      d.animate([{ transform: d.style.transform + ' scaleX(0.02)', filter: 'brightness(1.35)' }, { transform: d.style.transform + ' scaleX(1)', filter: 'brightness(1)' }], { duration: 170, easing: 'cubic-bezier(.2,.8,.2,1)' });
    };
  }
  function flashColumn(ci) {
    const hl = B.hls[ci]; if (!hl) return;
    hl.classList.remove('flash'); void hl.offsetWidth; hl.classList.add('flash');
  }

  /* K→A sequence: illuminate → collapse → rise → travel to the set tray → sparks */
  function sequenceComplete(items) {
    ES.Audio.play('sequence'); ES.Audio.haptic([12, 40, 18]);
    if (!motion()) { items.forEach(x => x.d.remove()); updateHud(); return; }
    const groups = new Map();
    items.forEach(x => { const k = x.cm.k; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); });
    groups.forEach((arr, k) => {
      arr.sort((a, b) => a.cm.i - b.cm.i);
      const king = arr[0].prev;
      const t = setPoint(arr[0].cm.slot);
      const br = B.el.getBoundingClientRect();
      arr.forEach((x, i) => {
        const d = x.d; d.style.zIndex = 3000 + i; d.classList.add('forged');
        const p = x.prev;
        const tx = t.x - B.L.cw / 2, ty = t.y - B.L.ch / 2;
        d.animate([
          { transform: `translate3d(${p.x}px, ${p.y}px, 0)`, filter: 'brightness(1)' },
          { offset: 0.2, transform: `translate3d(${p.x}px, ${p.y}px, 0)`, filter: 'brightness(1.5) saturate(1.2)' },
          { offset: 0.42, transform: `translate3d(${king.x}px, ${king.y + i * 1.2}px, 0) scale(.98)`, filter: 'brightness(1.6)' },
          { offset: 0.56, transform: `translate3d(${king.x}px, ${king.y - 18 + i * 1.2}px, 0) scale(1.02)`, filter: 'brightness(1.7)' },
          { transform: `translate3d(${tx}px, ${ty}px, 0) scale(.26)`, filter: 'brightness(2.2)', opacity: 0.1 }
        ], { duration: 980, delay: k * 140 + i * 8, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' }).onfinish = () => d.remove();
      });
      setTimeout(() => {
        ES.FX.sparks(br.left + t.x, br.top + t.y - B.table.scrollTop, 10, 34);
        const pip = document.querySelectorAll('#gSets .pip')[arr[0].cm.slot];
        if (pip) { pip.classList.remove('lit'); void pip.offsetWidth; pip.classList.add('lit'); }
      }, 900 + k * 140);
    });
  }

  function stockPoint() {
    const s = $('#btnStock .stock-pile'), br = B.el.getBoundingClientRect();
    if (!s) return { x: B.L ? B.L.W - 30 : 0, y: B.el.clientHeight };
    const r = s.getBoundingClientRect();
    return { x: r.left + r.width / 2 - br.left, y: r.top + r.height / 2 - br.top };
  }
  function setPoint(slot) {
    const pips = document.querySelectorAll('#gSets .pip'), br = B.el.getBoundingClientRect();
    const r = (pips[Math.max(0, Math.min(7, slot))] || $('#gSets')).getBoundingClientRect();
    return { x: r.left + r.width / 2 - br.left, y: r.top + r.height / 2 - br.top };
  }

  /* ---------- HUD ---------------------------------------------------------- */
  function updateHud() {
    const g = B.g; if (!g) return;
    a11yColumns();
    $('#gMoves').textContent = g.moves;
    $('#gTime').textContent = fmtTime(g.elapsed);
    const pips = document.querySelectorAll('#gSets .pip');
    pips.forEach((p, i) => p.classList.toggle('on', i < g.completed));
    $('#gSets').setAttribute('aria-label', `Completed sets ${g.completed} of 8`);
    const deals = E().stockDealsLeft(g);
    const st = $('#btnStock');
    st.querySelector('.stock-count').textContent = deals;
    st.classList.toggle('is-empty', deals === 0);
    st.setAttribute('aria-label', deals ? `Deal from stock, ${deals} deals left` : 'Stock empty');
    st.querySelectorAll('.stock-pile i').forEach((c, i) => c.style.display = i < Math.min(5, deals) ? '' : 'none');
    $('#btnUndo').disabled = !g.history.length;
  }

  /* ---------- actions ------------------------------------------------------ */
  function afterAction(res, anim) {
    const g = B.g;
    B.hintIdx = 0; clearHints();
    const out = ES.Store.applyResult(g, res);
    render(Object.assign({}, anim, { completions: res.completions }));
    if (res.revealed) announce('Card revealed.');
    if (out.daily) setTimeout(() => ES.UI.toast(`Daily challenge complete · +${out.daily} Ember`, 'ember'), 900);
    else if (res.newSets && !res.won) setTimeout(() => ES.UI.toast(`Sequence forged · +${ES.Store.SET_REWARD} Ember`, 'ember'), 700);
    if (res.won) {
      stopTimer();
      setTimeout(() => B.onWin && B.onWin(g, out), motion() ? 1300 : 200);
    }
    if (res.newSets) ES.Analytics.log('sequence_complete', { suits: g.suits, sets: g.completed });
    ES.Store.save();
    if (ES.Tutorial) ES.Tutorial.notify(res);
    if (!res.won) scheduleEndgameChecks();
  }

  /* ---------- end-game helpers: auto-complete + dead-end detection ---------- */
  let endT = 0, worker = null, checkId = 0;
  function scheduleEndgameChecks() {
    clearTimeout(endT);
    endT = setTimeout(endgameChecks, motion() ? 650 : 60);
  }
  function endgameChecks() {
    const g = B.g; if (!g || g.won || B.autoRunning) return;
    // auto-complete
    const fin = $('#btnFinish');
    let plan = null;
    if (ES.Config.bool('autocomplete_enabled') && E().canAutoComplete(g)) {
      if (B.planFor !== g.moves + ':' + g.completed) { B.plan = E().solveEndgame(g, 20000); B.planFor = g.moves + ':' + g.completed; }
      plan = B.plan;
    }
    fin.hidden = !plan;
    if (plan) return;
    // dead end: only meaningful once the stock can't help
    if (!ES.Config.bool('stuck_prompt_enabled') || E().canDeal(g).ok || B.stuckShownAt === g.moves) return;
    const id = ++checkId, snap = { id, cols: g.cols, stock: g.stock, completed: g.completed };
    const verdict = stuck => { if (id !== checkId || !B.g || B.g !== g || stuck !== true) return; B.stuckShownAt = g.moves; B.onStuck && B.onStuck(g); };
    try {
      if (!worker && typeof Worker !== 'undefined') { worker = new Worker('js/stuck-worker.js'); worker.onmessage = e => pending(e.data); worker.onerror = () => { worker = null; const fns = [...pendingMap.values()]; pendingMap.clear(); fns.forEach(fn => fn(B.g ? E().isStuck(B.g) : false)); }; }
    } catch (e) { worker = null; }
    if (worker) { pendingMap.set(id, verdict); worker.postMessage(JSON.parse(JSON.stringify(snap))); }
    else setTimeout(() => verdict(E().isStuck(g)), 0);
  }
  const pendingMap = new Map();
  function pending(d) { const fn = pendingMap.get(d.id); pendingMap.delete(d.id); if (fn) fn(d.stuck); }
  async function runAutoComplete() {
    const g = B.g, plan = B.plan; if (!g || !plan || B.autoRunning) return;
    B.autoRunning = true; $('#btnFinish').hidden = true; select(null);
    ES.Analytics.log('auto_complete', { moves: plan.length, suits: g.suits });
    const gap = motion() ? 170 : 0;
    for (const m of plan) {
      if (B.g !== g || g.won) break;
      if (!doMove(m.from, m.idx, m.to)) break;
      await new Promise(r => setTimeout(r, gap));
    }
    B.autoRunning = false; B.plan = null;
  }
  function doMove(from, idx, to, opts) {
    const g = B.g; opts = opts || {};
    const res = E().move(g, from, idx, to);
    if (!res.ok) return false;
    B.sel = null;
    ES.Audio.play('place'); ES.Audio.haptic(10);
    afterAction(res, { type: 'move', moved: res.moved, to, fromDrag: opts.fromDrag });
    announce(`Moved ${res.moved.length > 1 ? res.moved.length + ' cards' : 'card'} to column ${to + 1}.`);
    return true;
  }
  function doDeal() {
    const g = B.g; if (!g || B.drag) return;
    const chk = E().canDeal(g);
    if (!chk.ok) {
      ES.Audio.play('invalid');
      ES.UI.toast(chk.reason === 'gaps' ? 'Fill every empty column before dealing.' : 'The stock is empty.');
      const st = $('#btnStock'); st.classList.remove('shake'); void st.offsetWidth; st.classList.add('shake');
      return;
    }
    B.sel = null;
    const res = E().deal(g);
    ES.Audio.haptic(14);
    afterAction(res, { type: 'deal', dealt: res.dealt });
    announce('Dealt ten cards.');
  }
  function doUndo() {
    const g = B.g; if (!g || B.drag) return;
    const before = g.completed, stockBefore = g.stock.length;
    const res = E().undo(g);
    if (!res.ok) { ES.UI.toast('Nothing to undo.'); return; }
    B.sel = null; clearHints();
    ES.Store.state.stats.undos++; g.undosUsed++;
    ES.Audio.play('pick');
    render({ type: 'undo', restoredFromSet: g.completed < before, restoredFromStock: g.stock.length > stockBefore });
    ES.Store.save();
    B.stuckShownAt = null; scheduleEndgameChecks();
    announce('Move undone.');
  }
  function clearHints() {
    clearTimeout(B.hintTimer);
    B.el && B.el.querySelectorAll('.hint-src').forEach(x => x.classList.remove('hint-src'));
    B.hls && B.hls.forEach(h => h.classList.remove('hint-dst'));
    const st = $('#btnStock'); st && st.classList.remove('hint-dst');
  }
  function doHint() {
    const g = B.g; if (!g) return;
    clearHints();
    const list = E().hints(g);
    ES.Store.state.stats.hints++; g.hintsUsed++;
    if (!list.length) {
      if (E().canDeal(g).ok) { $('#btnStock').classList.add('hint-dst'); ES.UI.toast('No useful moves — deal from the stock.'); announce('No useful moves. Deal from the stock.'); }
      else { ES.UI.toast(g.stock.length ? 'Fill the empty columns, then deal.' : 'No moves remain. Try Undo.'); }
      B.hintTimer = setTimeout(clearHints, 2200);
      return;
    }
    const h = list[B.hintIdx % list.length]; B.hintIdx++;
    for (let i = h.idx; i < g.cols[h.from].length; i++) { const d = B.els.get(g.cols[h.from][i].id); d && d.classList.add('hint-src'); }
    B.hls[h.to].classList.add('hint-dst');
    const c = g.cols[h.from][h.idx];
    announce(`Hint: move ${E().cardName(c)} from column ${h.from + 1} to column ${h.to + 1}.`);
    ES.Audio.play('ui');
    B.hintTimer = setTimeout(clearHints, 2200);
  }

  /* ---------- selection (tap) --------------------------------------------- */
  function select(col, idx) {
    B.sel = col == null ? null : { col, idx };
    B.els.forEach(d => { const c = +d.dataset.col, i = +d.dataset.idx; d.classList.toggle('sel', !!(B.sel && c === B.sel.col && i >= B.sel.idx)); });
    B.hls.forEach((h, c) => h.classList.toggle('target', !!(B.sel && E().canMove(B.g, B.sel.col, B.sel.idx, c))));
  }
  function smartMove(col, idx, quiet) {
    const g = B.g, to = E().smartTarget(g, col, idx);
    if (to < 0) { if (!quiet) { rejectAt(col, idx); ES.UI.toast('No place for this card right now.'); } return false; }
    select(null);
    const ok = doMove(col, idx, to);
    if (ok) ES.Analytics.log('smart_move', { suits: g.suits });
    return ok;
  }
  function tapCard(col, idx) {
    const g = B.g, card = g.cols[col][idx], now = performance.now();
    const dbl = B.lastTap && B.lastTap.id === (card && card.id) && now - B.lastTap.t < 340;
    B.lastTap = card ? { id: card.id, t: now } : null;
    if (dbl && card && card.up && E().movable(g.cols[col], idx)) { B.lastTap = null; smartMove(col, idx); return; }
    if (B.sel && B.sel.col !== col) {
      if (doMove(B.sel.col, B.sel.idx, col)) { select(null); return; }
    }
    if (!card || !card.up) { if (B.sel) { select(null); } return; }
    if (B.sel && B.sel.col === col && B.sel.idx === idx) { select(null); return; }
    if (E().movable(g.cols[col], idx)) {
      if (ES.Store.state.settings.oneTap && !B.sel && smartMove(col, idx, true)) return;
      select(col, idx); ES.Audio.play('pick'); ES.Audio.haptic(6); announce(`Selected ${E().cardName(card)}. Choose a destination, or double-tap to move it automatically.`);
    }
    else { rejectAt(col, idx); ES.UI.toast('Only a same-suit descending run can move together.'); }
  }
  function tapColumn(col) {
    if (B.sel && B.sel.col !== col) { if (doMove(B.sel.col, B.sel.idx, col)) { select(null); return; } rejectAt(B.sel.col, B.sel.idx); }
    select(null);
  }
  function rejectAt(col, idx) {
    ES.Audio.play('invalid'); ES.Audio.haptic([8, 30, 8]);
    const g = B.g; if (!motion()) return;
    for (let i = idx; i < g.cols[col].length; i++) {
      const d = B.els.get(g.cols[col][i].id); if (!d) continue;
      const p = B.pos.get(d.dataset.id);
      d.animate([0, -4, 4, -2, 0].map(dx => ({ transform: `translate3d(${p.x + dx}px, ${p.y}px, 0)` })), { duration: 240, easing: 'ease-out' });
    }
  }

  /* ---------- pointer: drag + tap ----------------------------------------- */
  function colAtX(x) {
    const L = B.L; let best = -1, bd = 1e9;
    L.cols.forEach((c, i) => { const cx = c.x + L.cw / 2, d = Math.abs(cx - x); if (d < bd) { bd = d; best = i; } });
    return bd < L.colW * 0.75 + L.gap ? best : -1;
  }
  function onDown(e) {
    if (!B.g || e.button > 0 || B.drag) return;
    ES.Audio.unlock();
    const br = B.el.getBoundingClientRect();
    const x = e.clientX - br.left, y = e.clientY - br.top;
    const cardEl = e.target.closest('.card');
    let col, idx;
    if (cardEl && B.els.has(cardEl.dataset.id)) { col = +cardEl.dataset.col; idx = +cardEl.dataset.idx; }
    else { col = colAtX(x); idx = -1; }
    B.drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x0: x, y0: y, col, idx, started: false, els: [], target: -1 };
    if (idx >= 0 && B.g.cols[col][idx] && B.g.cols[col][idx].up && E().movable(B.g.cols[col], idx)) {
      B.drag.can = true;
      try { B.el.setPointerCapture(e.pointerId); } catch (err) {}
    }
  }
  let rafMove = 0, lastEv = null;
  function onMove(e) {
    const D = B.drag; if (!D || D.id !== e.pointerId || !D.can) return;
    lastEv = e;
    if (!D.started) {
      if (Math.hypot(e.clientX - D.sx, e.clientY - D.sy) < 7) return;
      startDrag();
    }
    e.preventDefault();
    if (!rafMove) rafMove = requestAnimationFrame(() => { rafMove = 0; dragFrame(lastEv); });
  }
  function startDrag() {
    const D = B.drag, g = B.g; D.started = true;
    select(null); clearHints();
    for (let i = D.idx; i < g.cols[D.col].length; i++) {
      const id = g.cols[D.col][i].id, d = B.els.get(id), p = B.pos.get(id);
      d.getAnimations().forEach(a => a.finish());
      d.classList.add('dragging'); d.style.zIndex = 5000 + i;
      D.els.push({ d, p, id });
    }
    D.valid = B.hls.map((h, c) => E().canMove(g, D.col, D.idx, c));
    B.hls.forEach((h, c) => h.classList.toggle('target', D.valid[c]));
    B.el.classList.add('is-dragging');
    ES.Audio.play('pick'); ES.Audio.haptic(8);
  }
  function dragFrame(e) {
    const D = B.drag; if (!D || !D.started) return;
    const dx = e.clientX - D.sx, dy = e.clientY - D.sy;
    D.els.forEach(({ d, p }) => { d.style.transform = `translate3d(${p.x + dx}px, ${p.y + dy - 6}px, 0) scale(1.04)`; });
    const lead = D.els[0].p;
    const c = colAtX(lead.x + dx + B.L.cw / 2);
    if (c !== D.target) {
      if (D.target >= 0) B.hls[D.target].classList.remove('over');
      D.target = c;
      if (c >= 0 && D.valid[c] && c !== D.col) B.hls[c].classList.add('over');
    }
    D.dx = dx; D.dy = dy;
  }
  function onUp(e) {
    const D = B.drag; if (!D || D.id !== e.pointerId) return;
    B.drag = null;
    try { B.el.releasePointerCapture(e.pointerId); } catch (err) {}
    if (!D.started) {
      if (D.idx >= 0) tapCard(D.col, D.idx); else if (D.col >= 0) tapColumn(D.col);
      return;
    }
    B.el.classList.remove('is-dragging');
    B.hls.forEach(h => h.classList.remove('target', 'over'));
    const target = D.target;
    D.els.forEach(({ d, p }) => {
      d.classList.remove('dragging');
      B.pos.set(d.dataset.id, { x: p.x + (D.dx || 0), y: p.y + (D.dy || 0) - 6, z: p.z });
    });
    if (target >= 0 && target !== D.col && D.valid[target] && doMove(D.col, D.idx, target, { fromDrag: true })) return;
    // invalid: glide home
    ES.Audio.play(target >= 0 && target !== D.col ? 'invalid' : 'place');
    D.els.forEach(({ d, p }) => {
      const cur = B.pos.get(d.dataset.id);
      B.pos.set(d.dataset.id, p);
      if (motion()) d.animate([{ transform: `translate3d(${cur.x}px, ${cur.y}px, 0) scale(1.04)` }, { transform: `translate3d(${p.x}px, ${p.y}px, 0) scale(1)` }], { duration: 240, easing: 'cubic-bezier(.3,.8,.3,1)' }).onfinish = () => place(d, p);
      place(d, p);
    });
  }
  function onCancel(e) { if (B.drag && B.drag.id === e.pointerId) { B.drag.target = -1; onUp(e); } }

  /* ---------- keyboard ---------------------------------------------------- */
  function onKey(e) {
    if (!B.g || document.querySelector('.overlay')) return;
    const k = e.key, g = B.g;
    const cursor = () => { B.kb.active = true; B.hls.forEach((h, c) => h.classList.toggle('kb', c === B.kb.col)); const col = g.cols[B.kb.col]; const top = col[col.length - 1]; announce(`Column ${B.kb.col + 1}: ${col.length ? (top.up ? E().cardName(top) : 'face-down card') + ', ' + col.length + ' cards' : 'empty'}.`); };
    if (k === 'ArrowLeft' || k === 'ArrowRight') { B.kb.col = (B.kb.col + (k === 'ArrowLeft' ? 9 : 1)) % 10; cursor(); e.preventDefault(); return; }
    if ((k === 'ArrowUp' || k === 'ArrowDown') && B.sel) {
      const col = g.cols[B.sel.col]; let i = B.sel.idx + (k === 'ArrowUp' ? -1 : 1);
      if (i >= 0 && i < col.length && E().movable(col, i)) { select(B.sel.col, i); announce(`Selected ${col.length - i} cards from ${E().cardName(col[i])}.`); }
      e.preventDefault(); return;
    }
    if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      if (B.sel && B.sel.col !== B.kb.col) { tapColumn(B.kb.col); return; }
      const col = g.cols[B.kb.col]; if (!col.length) return;
      let i = col.length - 1; while (i > 0 && E().movable(col, i - 1)) i--;
      if (B.sel && B.sel.col === B.kb.col) { select(null); return; }
      tapCard(B.kb.col, i); return;
    }
    if (k === 'Escape') { select(null); return; }
    if (k === 'd' || k === 'D') doDeal();
    else if (k === 'u' || k === 'U' || ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'Z'))) { e.preventDefault(); doUndo(); }
    else if (k === 'h' || k === 'H') doHint();
  }

  /* ---------- timer -------------------------------------------------------- */
  function startTimer() {
    stopTimer(); B.lastTick = performance.now();
    B.timer = setInterval(() => {
      const now = performance.now(), dt = now - B.lastTick; B.lastTick = now;
      if (!B.g || B.paused || B.g.won || document.hidden) return;
      ES.Store.tick(B.g, Math.min(dt, 2000));
      $('#gTime').textContent = fmtTime(B.g.elapsed);
    }, 500);
  }
  function stopTimer() { clearInterval(B.timer); B.timer = 0; }

  /* ---------- public ------------------------------------------------------- */
  function mount() {
    B.el = $('#board'); B.table = $('#table');
    B.slots = []; B.hls = [];
    for (let c = 0; c < 10; c++) {
      const s = document.createElement('div'); s.className = 'slot'; s.setAttribute('aria-hidden', 'true'); B.el.appendChild(s); B.slots.push(s);
      const h = document.createElement('div'); h.className = 'col-hl'; h.setAttribute('aria-hidden', 'true'); B.el.appendChild(h); B.hls.push(h);
    }
    const ac = document.createElement('div'); ac.className = 'a11y-cols'; ac.setAttribute('role', 'group'); ac.setAttribute('aria-label', 'Columns');
    B.a11y = Array.from({ length: 10 }, (_, c) => { const b = document.createElement('button'); b.className = 'a11y-col'; b.type = 'button'; b.tabIndex = -1; b.addEventListener('click', () => a11yActivate(c)); ac.appendChild(b); return b; });
    B.table.appendChild(ac);
    B.el.addEventListener('pointerdown', onDown);
    B.el.addEventListener('pointermove', onMove, { passive: false });
    B.el.addEventListener('pointerup', onUp);
    B.el.addEventListener('pointercancel', onCancel);
    B.el.addEventListener('keydown', onKey);
    B.el.addEventListener('focus', () => { B.hls[B.kb.col].classList.add('kb'); });
    B.el.addEventListener('blur', () => B.hls.forEach(h => h.classList.remove('kb')));
    $('#btnUndo').addEventListener('click', doUndo);
    $('#btnHint').addEventListener('click', doHint);
    $('#btnStock').addEventListener('click', doDeal);
    $('#btnFinish').addEventListener('click', runAutoComplete);
    let rt = 0;
    root.addEventListener('resize', () => { cancelAnimationFrame(rt); rt = requestAnimationFrame(() => { if (B.g && B.el.offsetParent) render({ type: 'none' }); }); });
    // pips
    $('#gSets').innerHTML = Array.from({ length: 8 }, () => `<span class="pip">${ES.Icons.icon('sets')}</span>`).join('');
  }
  function start(game, opts) {
    opts = opts || {};
    B.els.forEach(d => d.remove()); B.els.clear(); B.pos.clear();
    B.g = game; B.sel = null; B.hintIdx = 0; B.paused = false; B.plan = null; B.planFor = null; B.stuckShownAt = null; B.autoRunning = false;
    const fin = $('#btnFinish'); if (fin) fin.hidden = true;
    const S = ES.Store.state.settings;
    B.el.style.setProperty('--back', `url('${ES.Manifest.abs(ES.Manifest.back(S.cardBack))}')`);
    B.table.style.setProperty('--table', `url('${ES.Manifest.abs((ES.Manifest.tables[S.table] || ES.Manifest.tables.iron).src)}')`);
    $('#gMode').textContent = (game.daily ? 'Daily · ' : '') + game.suits + ' Suit';
    $('#btnStock .stock-pile').style.setProperty('--back', `url('${ES.Manifest.abs(ES.Manifest.back(S.cardBack))}')`);
    requestAnimationFrame(() => {
      const all = game.cols.flat().map(c => c.id);
      render(opts.animateDeal ? { type: 'initial', dealt: all } : { type: 'none' });
      if (opts.animateDeal) ES.Audio.play('deal');
    });
    startTimer();
    scheduleEndgameChecks();
  }
  function refreshTheme() {
    if (!B.el) return;
    const S = ES.Store.state.settings;
    B.el.style.setProperty('--back', `url('${ES.Manifest.abs(ES.Manifest.back(S.cardBack))}')`);
    B.table.style.setProperty('--table', `url('${ES.Manifest.abs((ES.Manifest.tables[S.table] || ES.Manifest.tables.iron).src)}')`);
    const sp = $('#btnStock .stock-pile'); sp && sp.style.setProperty('--back', `url('${ES.Manifest.abs(ES.Manifest.back(S.cardBack))}')`);
    if (B.g) render({ type: 'none' });
  }
  ES.Board = {
    mount, start, render, refreshTheme, doHint, doDeal, doUndo, doMove, select, smartMove, runAutoComplete,
    set onStuck(fn) { B.onStuck = fn; },
    pause(v) { B.paused = v; }, stopTimer, startTimer,
    get game() { return B.g; }, set onWin(fn) { B.onWin = fn; },
    highlight(from, idx, to) { clearHints(); const g = B.g; for (let i = idx; i < g.cols[from].length; i++) { const d = B.els.get(g.cols[from][i].id); d && d.classList.add('hint-src'); } if (to != null) B.hls[to].classList.add('hint-dst'); },
    clearHints, stockHighlight(v) { $('#btnStock').classList.toggle('hint-dst', v); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
