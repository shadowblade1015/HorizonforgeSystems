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

  /* Runtime ownership only: never serialized into the hand/save. */
  let session = 0, revision = 0, workEpoch = 0, visualVersion = 0;
  const timeouts = new Map(), frames = new Map();
  const animations = new Set();
  const owned = new Set(), invalidators = new Set(), holds = new Set(), ghosts = new Set();
  function capture() { return { game: B.g, session, revision, workEpoch }; }
  function captureView() { return Object.assign(capture(), { view: true, profile: ES.Store.state }); }
  function isSession(token, position = true) {
    return !!token && token.game === B.g && (token.view ? token.profile === ES.Store.state : B.g === ES.Store.state.game) && token.session === session && (!position || token.revision === revision);
  }
  function isCurrent(token, position = true) { return isSession(token, position) && token.workEpoch === workEpoch; }
  function later(fn, ms, token = capture()) {
    let id;
    const cancel = () => { clearTimeout(id); timeouts.delete(id); owned.delete(cancel); };
    id = setTimeout(() => { timeouts.delete(id); owned.delete(cancel); if (isCurrent(token)) fn(); }, ms);
    owned.add(cancel); timeouts.set(id, cancel); return id;
  }
  function cancelLater(id) { const cancel = timeouts.get(id); if (cancel) cancel(); else clearTimeout(id); }
  function cancelFrame(id) { const cancel = frames.get(id); if (cancel) cancel(); else cancelAnimationFrame(id); }
  function frame(fn, token = capture()) {
    let id;
    const cancel = () => { cancelAnimationFrame(id); frames.delete(id); owned.delete(cancel); };
    id = requestAnimationFrame(() => { frames.delete(id); owned.delete(cancel); if (isCurrent(token)) fn(); });
    owned.add(cancel); frames.set(id, cancel); return id;
  }
  function wait(ms, token, run) {
    return new Promise(resolve => {
      let id, finished = false;
      const finish = value => { if (finished) return; finished = true; clearTimeout(id); owned.delete(cancel); if (run) run.cancelWait = null; resolve(value); };
      const cancel = () => finish(false); if (run) run.cancelWait = cancel;
      id = setTimeout(() => finish(isCurrent(token)), ms); owned.add(cancel);
    });
  }
  function animate(node, frames, options) {
    const token = capture(), version = visualVersion, animation = node.animate(frames, options);
    let finish = null;
    const cancel = () => { animation.onfinish = null; animation.cancel(); animations.delete(cancel); owned.delete(cancel); };
    owned.add(cancel); animations.add(cancel);
    animation.onfinish = () => { animations.delete(cancel); owned.delete(cancel); if (version === visualVersion && isCurrent(token) && node.isConnected !== false && finish) finish(); };
    return { set onfinish(fn) { finish = fn; } };
  }
  function onInvalidate(fn) { invalidators.add(fn); return () => invalidators.delete(fn); }
  function cancelAutoComplete() {
    const wasRunning = !!B.autoRun;
    if (B.autoRun) { B.autoRun.cancelled = true; if (B.autoRun.cancelWait) B.autoRun.cancelWait(); }
    B.autoRun = null; B.autoRunning = false; B.plan = null; B.planFor = null;
    const button = $('#btnFinish'); if (button) button.hidden = true;
    if (wasRunning && eligible()) scheduleEndgameChecks();
  }
  function invalidate(kind = 'position', preserveAuto = false) {
    workEpoch++;
    if (kind === 'position') revision++; else if (kind === 'session') session++;
    if (!preserveAuto) cancelAutoComplete();
    for (const cancel of [...owned]) cancel();
    for (const node of ghosts) node.remove(); ghosts.clear();
    if (worker) { worker.onmessage = worker.onerror = null; worker.terminate(); worker = null; }
    pendingMap.clear(); ++checkId;
    if (B.drag && B.el) { try { B.el.releasePointerCapture(B.drag.id); } catch (e) {} }
    B.drag = null; rafMove = 0; lastEv = null;
    B.el && B.el.classList.remove('is-dragging');
    B.els.forEach(d => d.classList.remove('dragging', 'sel'));
    if (B.hls) B.hls.forEach(h => h.classList.remove('target', 'over', 'kb', 'flash'));
    B.sel = null; B.lastTap = null; B.plan = null; B.planFor = null;
    clearHints();
    for (const fn of [...invalidators]) { try { fn(kind); } catch (error) { console.error(error); } }
  }
  function eligible() {
    if (!ES.Store.canEdit) return false;
    return !!B.g && B.g === ES.Store.state.game && B.active && !B.paused && !holds.size && !document.hidden && B.pageActive !== false && B.appActive !== false && ES.UI.current === 'game' && !B.g.won;
  }
  function syncClock() {
    const now = performance.now();
    if (B.counting && B.g && B.g === ES.Store.state.game) ES.Store.tick(B.g, Math.max(0, now - B.lastTick));
    B.lastTick = now; B.counting = !!(B.timerEnabled && eligible());
    if (B.counting && !B.timer) B.timer = setInterval(syncClock, 500);
    if (!B.counting && B.timer) { clearInterval(B.timer); B.timer = 0; }
    const label = $('#gTime'); if (label && B.g) label.textContent = fmtTime(B.g.elapsed);
  }
  function resumeWork() {
    syncClock();
    if (B.g && B.active && !B.paused && !holds.size && !document.hidden && B.pageActive !== false && B.appActive !== false) {
      render({ type: 'none' });
      if (B.g.won && B.victoryOut && !B.victoryShown) scheduleVictory(B.victoryOut);
      else if (!B.g.won) scheduleEndgameChecks();
      if (ES.Tutorial && ES.Tutorial.resume) ES.Tutorial.resume();
    }
  }
  function pause(value) {
    syncClock(); B.paused = !!value;
    if (value) invalidate('pause');
    else resumeWork();
    syncClock();
  }
  function setAppActive(active) {
    syncClock(); B.appActive = !!active;
    if (!active) invalidate('pause'); else resumeWork();
    syncClock();
  }
  function hold() {
    syncClock(); const key = {}; holds.add(key); invalidate('pause'); syncClock();
    let released = false;
    return () => { if (released) return; released = true; syncClock(); holds.delete(key); resumeWork(); };
  }
  function setScreen(name) {
    if (B.screen === name) return;
    syncClock(); B.screen = name; B.active = name === 'game';
    invalidate('session');
    if (B.active) B.paused = false;
    resumeWork();
  }
  function dispose() {
    syncClock(); if (B.g) revision++; B.active = false; B.paused = true; B.timerEnabled = false;
    invalidate('session'); holds.clear();
    if (B.timer) clearInterval(B.timer);
    B.timer = 0; B.counting = false;
    B.els.forEach(d => d.remove()); B.els.clear(); B.pos.clear();
    B.g = null; B.victoryOut = null; B.victoryShown = false;
  }
  function action(allowWon = false, automated = null) {
    if (!ES.Store.canEdit) return false;
    if (!B.g || B.drag || B.g !== ES.Store.state.game || !B.active || B.paused || holds.size || document.hidden || B.pageActive === false || B.appActive === false || ES.UI.current !== 'game' || (!allowWon && B.g.won)) return false;
    if (automated) return automated === B.autoRun && !automated.cancelled && isCurrent(automated.token);
    if (B.autoRunning) { cancelAutoComplete(); invalidate('pause'); render({ type: 'none' }); if (eligible()) scheduleEndgameChecks(); }
    return true;
  }
  function canPresent(token) { return isCurrent(token) && B.g && B.g.won && B.active && !B.paused && !holds.size && !document.hidden && B.pageActive !== false && B.appActive !== false; }
  function scheduleVictory(out) {
    const token = capture();
    later(() => {
      if (!canPresent(token) || B.victoryShown) return;
      B.victoryShown = true;
      if (B.onWin) B.onWin(token.game, out, token);
    }, motion() ? 1300 : 200, token);
  }

  /* ---------- helpers ------------------------------------------------------ */
  const motion = () => ES.FX.motion();
  const faceUrl = c => ES.Manifest.card(c.rank, c.suit);
  function announce(msg) { const l = $('#gLive'); if (l) { cancelLater(B.liveTimer); l.textContent = ''; B.liveTimer = later(() => (l.textContent = msg), 30); } }
  function fmtTime(ms) { const s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }

  /* ---------- layout ------------------------------------------------------- */
  function computeLayout() {
    const g = B.g, Hvis = B.table.clientHeight;
    const minimum = ES.Store.state.settings.largeCards ? 64 : 48;
    const W = Math.max(B.table.clientWidth, minimum * 10 + 9 * 6 + 12);
    const large = ES.Store.state.settings.largeCards;
    const padX = Math.max(3, Math.round(W * 0.01));
    const gap = Math.max(large ? 2 : 3, Math.min(10, Math.round(W * 0.008)));
    const colW = (W - padX * 2 - gap * 9) / 10;
    const maxW = large ? 150 : 124;
    const cw = Math.max(minimum, Math.min(colW, maxW));
    const ch = cw * 1.4;
    const extra = colW - cw;
    const idxH = large ? Math.max(20, cw * 0.4) : Math.max(15, cw * 0.33);
    const padT = 50;
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
    return { W, cw, ch, colW, gap, padX, padT, cols, viewportHeight: Hvis, height: Math.max(Hvis, maxBottom + 12), idxH };
  }

  /* Visible column buttons select a movable run or place selected cards.
     Cards themselves stay out of the accessibility tree. */
  function a11yColumns() {
    const g = B.g, L = B.L; if (!B.a11y || !g || !L) return;
    runControls();
    for (let c = 0; c < 10; c++) {
      const b = B.a11y[c], col = g.cols[c], top = col[col.length - 1];
      b.style.transform = `translate3d(${L.cols[c].x}px, 0, 0)`;
      b.style.width = L.cw + 'px'; b.style.height = '44px';
      b.textContent = String(c + 1); b.setAttribute('aria-pressed', String(!!B.sel && B.sel.col === c));
      const down = col.filter(x => !x.up).length;
      let i = col.length - 1; while (i > 0 && E().movable(col, i - 1)) i--;
      const run = col.length ? col.length - i : 0;
      let label = `Column ${c + 1}. `;
      label += col.length ? `${E().cardName(top)} on top` + (run > 1 ? `, run of ${run} from ${E().cardName(col[i])}` : '') + (down ? `, ${down} face down` : '') + '.' : 'Empty.';
      if (B.sel && B.sel.col === c) label += ' Selected. Activate to cancel.';
      else if (B.sel) label += E().canMove(g, B.sel.col, B.sel.idx, c) ? ' Activate to place the selected cards here.' : ' Selected cards cannot go here.';
      else if (col.length && top.up) label += ' Activate to pick up.';
      b.setAttribute('aria-label', label);
    }
  }
  function a11yActivate(c) {
    const g = B.g; if (!g || ES.UI.hasModal?.() || !action()) return;
    if (B.sel) { if (B.sel.col === c) { select(null); announce('Selection cancelled.'); } else tapColumn(c); a11yColumns(); return; }
    const col = g.cols[c]; if (!col.length) { announce('Empty column.'); return; }
    let i = col.length - 1; while (i > 0 && E().movable(col, i - 1)) i--;
    select(c, i); announce(`Selected ${col.length - i} cards from ${E().cardName(col[i])}. Choose a destination or Escape to cancel.`);
  }

  function applyLayoutVars() {
    const L = B.L;
    B.el.style.setProperty('--cw', L.cw + 'px');
    B.el.style.setProperty('--chh', L.ch + 'px');
    B.el.style.height = L.height + 'px';
    B.el.style.width = L.W + 'px';
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
  function removeCard(d) { ghosts.delete(d); d.remove(); }
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
    const g = B.g; if (!g || !B.active || g !== ES.Store.state.game || !B.el) return;
    visualVersion++;
    for (const cancel of [...animations]) cancel();
    for (const node of ghosts) node.remove(); ghosts.clear();
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
        animate(d, kf, { duration: dur, delay, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards' }).onfinish = () => { place(d, p); };
        if (p.up) later(() => flip(d, true), delay + dur * 0.5);
        if (anim.type !== 'initial' && ci === 0) ES.Audio.play('deal');
        return;
      }
      if (isNew && anim.type === 'undo' && anim.restoredFromSet) {
        setFace(d, p.up); place(d, p);
        if (doMotion) { const t = setPoint(g.completed); animate(d, [{ transform: `translate3d(${t.x - B.L.cw / 2}px, ${t.y - B.L.ch / 2}px, 0) scale(.3)`, opacity: 0 }, { transform: `translate3d(${p.x}px, ${p.y}px, 0)`, opacity: 1 }], { duration: 320, delay: (12 - (i % 13)) * 14, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards' }); }
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
          animate(d, [
            { transform: `translate3d(${from.x}px, ${from.y}px, 0) scale(${anim.fromDrag ? 1.04 : 1})`, boxShadow: 'var(--card-shadow)' },
            { offset: anim.fromDrag ? 0 : 0.16, transform: `translate3d(${from.x}px, ${from.y + lift}px, 0) scale(1.03)`, boxShadow: 'var(--card-shadow-lift)' },
            { offset: 0.84, transform: `translate3d(${p.x}px, ${p.y - 2}px, 0) scale(1.015)`, boxShadow: 'var(--card-shadow-lift)' },
            { transform: `translate3d(${p.x}px, ${p.y}px, 0) scale(1)`, boxShadow: 'var(--card-shadow)' }
          ], { duration: dur, easing: 'cubic-bezier(.25,.8,.25,1)' }).onfinish = () => place(d, p);
        } else {
          animate(d, [{ transform: `translate3d(${prev.x}px, ${prev.y}px, 0)` }, { transform: `translate3d(${p.x}px, ${p.y}px, 0)` }], { duration: 200, easing: 'cubic-bezier(.25,.8,.25,1)' }).onfinish = () => place(d, p);
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
      B.els.delete(id); B.pos.delete(id); ghosts.add(d);
      if (cm && prev) { byCompletion.push({ d, prev, cm }); return; }
      if (anim.type === 'undo' && doMotion && prev) {
        // cards un-dealt back to the stock
        d.style.zIndex = 1500;
        later(() => flip(d, false), 60);
        animate(d, [{ transform: `translate3d(${prev.x}px, ${prev.y}px, 0)` }, { transform: `translate3d(${stockPt.x - B.L.cw / 2}px, ${stockPt.y - B.L.ch / 2}px, 0) scale(.86)`, opacity: 0.2 }], { duration: 300, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).onfinish = () => removeCard(d);
        return;
      }
      removeCard(d);
    });
    if (byCompletion.length) sequenceComplete(byCompletion);
    updateHud();
  }

  function flip(d, toUp) {
    if (d.isConnected === false) return;
    if (!motion()) { setFace(d, toUp); return; }
    const a = animate(d, [{ transform: d.style.transform + ' scaleX(1)' }, { transform: d.style.transform + ' scaleX(0.02)' }], { duration: 110, easing: 'ease-in' });
    a.onfinish = () => {
      setFace(d, toUp); ES.Audio.play('flip');
      animate(d, [{ transform: d.style.transform + ' scaleX(0.02)', filter: 'brightness(1.35)' }, { transform: d.style.transform + ' scaleX(1)', filter: 'brightness(1)' }], { duration: 170, easing: 'cubic-bezier(.2,.8,.2,1)' });
    };
  }
  function flashColumn(ci) {
    const hl = B.hls[ci]; if (!hl) return;
    hl.classList.remove('flash'); void hl.offsetWidth; hl.classList.add('flash');
  }

  /* K→A sequence: illuminate → collapse → rise → travel to the set tray → sparks */
  function sequenceComplete(items) {
    ES.Audio.play('sequence'); ES.Audio.haptic([12, 40, 18]);
    if (!motion()) { items.forEach(x => removeCard(x.d)); updateHud(); return; }
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
        animate(d, [
          { transform: `translate3d(${p.x}px, ${p.y}px, 0)`, filter: 'brightness(1)' },
          { offset: 0.2, transform: `translate3d(${p.x}px, ${p.y}px, 0)`, filter: 'brightness(1.5) saturate(1.2)' },
          { offset: 0.42, transform: `translate3d(${king.x}px, ${king.y + i * 1.2}px, 0) scale(.98)`, filter: 'brightness(1.6)' },
          { offset: 0.56, transform: `translate3d(${king.x}px, ${king.y - 18 + i * 1.2}px, 0) scale(1.02)`, filter: 'brightness(1.7)' },
          { transform: `translate3d(${tx}px, ${ty}px, 0) scale(.26)`, filter: 'brightness(2.2)', opacity: 0.1 }
        ], { duration: 980, delay: k * 140 + i * 8, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' }).onfinish = () => removeCard(d);
      });
      later(() => {
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
    syncClock(); B.hintIdx = 0; clearHints();
    const origin = capture(), out = ES.Store.applyResult(g, res);
    if (!isCurrent(origin)) return false;
    render(Object.assign({}, anim, { completions: res.completions }));
    if (res.revealed) announce('Card revealed.');
    if (out.daily) later(() => ES.UI.toast(`Daily challenge complete · +${out.daily} Ember`, 'ember'), 900);
    else if (res.newSets && !res.won) later(() => ES.UI.toast(`Sequence forged · +${ES.Store.SET_REWARD} Ember`, 'ember'), 700);
    if (res.won) {
      syncClock(); B.victoryOut = out; scheduleVictory(out);
    }
    if (res.newSets) ES.Analytics.log('sequence_complete', { suits: g.suits, sets: g.completed });
    ES.Store.save();
    if (ES.Tutorial) ES.Tutorial.notify(res);
    if (!res.won) scheduleEndgameChecks();
    return true;
  }

  /* ---------- end-game helpers: auto-complete + dead-end detection ---------- */
  let endT = 0, worker = null, checkId = 0;
  function scheduleEndgameChecks() {
    cancelLater(endT);
    endT = later(endgameChecks, motion() ? 650 : 60);
  }
  function endgameChecks() {
    const g = B.g; if (!eligible() || B.autoRunning) return;
    // auto-complete
    const fin = $('#btnFinish');
    let plan = null;
    if (ES.Config.bool('autocomplete_enabled') && E().canAutoComplete(g)) {
      if (B.planFor !== revision) { B.plan = E().solveEndgame(g, 20000); B.planFor = revision; }
      plan = B.plan;
    }
    fin.hidden = !plan;
    if (plan) return;
    // dead end: only meaningful once the stock can't help
    if (!ES.Config.bool('stuck_prompt_enabled') || E().canDeal(g).ok || B.stuckShownAt === revision) return;
    if (pendingMap.size) return;
    const token = capture(), id = ++checkId, snap = { id, session, revision, cols: g.cols, stock: g.stock, completed: g.completed };
    const verdict = stuck => { if (!isCurrent(token) || !eligible() || stuck !== true) return; B.stuckShownAt = revision; B.onStuck && B.onStuck(g); };
    try {
      if (!worker && typeof Worker !== 'undefined') {
        const source = worker = new Worker('js/stuck-worker.js');
        source.onmessage = e => { if (source === worker) pending(e.data); };
        source.onerror = () => {
          if (source !== worker) return;
          const requests = [...pendingMap.values()];
          source.onmessage = source.onerror = null; source.terminate(); worker = null; pendingMap.clear();
          for (const entry of requests) later(() => { if (eligible()) entry.verdict(E().isStuck(entry.token.game)); }, 0, entry.token);
        };
      }
      if (worker) { pendingMap.set(id, { token, verdict }); worker.postMessage(JSON.parse(JSON.stringify(snap))); }
      else later(() => { if (eligible()) verdict(E().isStuck(g)); }, 0, token);
    } catch (error) {
      if (worker) { worker.onmessage = worker.onerror = null; worker.terminate(); worker = null; } pendingMap.clear();
      later(() => { if (eligible()) verdict(E().isStuck(g)); }, 0, token);
    }
  }
  const pendingMap = new Map();
  function pending(data) {
    const entry = pendingMap.get(data.id); if (!entry) return;
    if (data.session !== entry.token.session || data.revision !== entry.token.revision) return;
    pendingMap.delete(data.id); entry.verdict(data.stuck);
  }
  async function runAutoComplete() {
    if (!action() || !B.plan || B.planFor !== revision) return;
    const g = B.g, plan = B.plan.slice(), run = { token: capture(), cancelled: false };
    B.autoRun = run; B.autoRunning = true; $('#btnFinish').hidden = true; select(null);
    ES.Analytics.log('auto_complete', { moves: plan.length, suits: g.suits });
    try {
      for (const m of plan) {
        if (!action(false, run) || g.won || !E().canMove(g, m.from, m.idx, m.to)) break;
        if (!doMove(m.from, m.idx, m.to, { automated: run })) break;
        run.token = capture();
        if (g.won || !await wait(motion() ? 170 : 0, run.token, run)) break;
      }
    } finally {
      if (B.autoRun === run) { cancelAutoComplete(); if (eligible()) scheduleEndgameChecks(); }
    }
  }
  function doMove(from, idx, to, opts) {
    const g = B.g; opts = opts || {};
    if (!action(false, opts.automated) || !E().canMove(g, from, idx, to)) return false;
    syncClock(); invalidate('position', !!opts.automated);
    const res = E().move(g, from, idx, to);
    if (!res.ok) return false;
    B.sel = null;
    ES.Audio.play('place'); ES.Audio.haptic(10);
    if (!afterAction(res, { type: 'move', moved: res.moved, to, fromDrag: opts.fromDrag })) return true;
    announce(res.won ? 'Victory. All eight sequences completed.' : res.newSets ? `Sequence completed. ${g.completed} of eight sets forged.` : `Moved ${res.moved.length > 1 ? res.moved.length + ' cards' : 'card'} to column ${to + 1}.`);
    return true;
  }
  function doDeal() {
    const g = B.g; if (!action() || B.drag) return;
    const chk = E().canDeal(g);
    if (!chk.ok) {
      ES.Audio.play('invalid');
      ES.UI.toast(chk.reason === 'gaps' ? 'Fill every empty column before dealing.' : 'The stock is empty.');
      const st = $('#btnStock'); st.classList.remove('shake'); void st.offsetWidth; st.classList.add('shake');
      return;
    }
    syncClock(); invalidate('position');
    B.sel = null;
    const res = E().deal(g);
    ES.Audio.haptic(14);
    if (!afterAction(res, { type: 'deal', dealt: res.dealt })) return;
    announce(res.won ? 'Victory. All eight sequences completed.' : res.newSets ? `Dealt ten cards. Sequence completed. ${g.completed} of eight sets forged.` : 'Dealt ten cards.');
  }
  function doUndo() {
    const g = B.g; if (!action(true) || B.drag) return;
    if (!g.history.length) { ES.UI.toast('Nothing to undo.'); return; }
    syncClock(); invalidate('position');
    const before = g.completed, stockBefore = g.stock.length;
    const res = E().undo(g);
    if (!res.ok) { ES.UI.toast('Nothing to undo.'); return; }
    B.sel = null; clearHints();
    ES.Store.state.stats.undos++; g.undosUsed++;
    ES.Audio.play('pick');
    render({ type: 'undo', restoredFromSet: g.completed < before, restoredFromStock: g.stock.length > stockBefore });
    ES.Store.save();
    B.stuckShownAt = null; B.victoryOut = null; syncClock(); scheduleEndgameChecks();
    announce('Move undone.');
  }
  function clearHints() {
    cancelLater(B.hintTimer);
    B.el && B.el.querySelectorAll('.hint-src').forEach(x => x.classList.remove('hint-src'));
    B.hls && B.hls.forEach(h => h.classList.remove('hint-dst'));
    const st = $('#btnStock'); st && st.classList.remove('hint-dst');
  }
  function doHint() {
    const g = B.g; if (!action()) return;
    clearHints();
    const list = E().hints(g);
    ES.Store.state.stats.hints++; g.hintsUsed++;
    if (!list.length) {
      if (E().canDeal(g).ok) { $('#btnStock').classList.add('hint-dst'); ES.UI.toast('No useful moves — deal from the stock.'); announce('No useful moves. Deal from the stock.'); }
      else { ES.UI.toast(g.stock.length ? 'Fill the empty columns, then deal.' : 'No moves remain. Try Undo.'); }
      B.hintTimer = later(clearHints, 2200);
      return;
    }
    const h = list[B.hintIdx % list.length]; B.hintIdx++;
    for (let i = h.idx; i < g.cols[h.from].length; i++) { const d = B.els.get(g.cols[h.from][i].id); d && d.classList.add('hint-src'); }
    B.hls[h.to].classList.add('hint-dst');
    const c = g.cols[h.from][h.idx];
    announce(`Hint: move ${E().cardName(c)} from column ${h.from + 1} to column ${h.to + 1}.`);
    ES.Audio.play('ui');
    B.hintTimer = later(clearHints, 2200);
  }

  /* ---------- selection (tap) --------------------------------------------- */
  function select(col, idx) {
    if (col != null && !action()) return;
    B.sel = col == null ? null : { col, idx };
    B.els.forEach(d => { const c = +d.dataset.col, i = +d.dataset.idx; d.classList.toggle('sel', !!(B.sel && c === B.sel.col && i >= B.sel.idx)); });
    B.hls.forEach((h, c) => h.classList.toggle('target', !!(B.sel && E().canMove(B.g, B.sel.col, B.sel.idx, c))));
    a11yColumns();
    if (B.L && B.table.clientHeight !== B.L.viewportHeight) render({ type: 'none' });
    if (B.sel) reveal(col, idx);
  }
  function runControls() {
    const controls = $('#runControls'); if (!controls) return;
    // Keep the table origin stable while lifting a previously selected run.
    if (!B.sel && B.drag?.started) return;
    controls.hidden = !B.sel;
    if (!B.sel || !B.g) return;
    const { col, idx } = B.sel, cards = B.g.cols[col];
    $('#runSummary').textContent = (cards.length - idx) + ' selected from ' + E().cardName(cards[idx]);
    $('#btnRunMore').disabled = idx === 0 || !E().movable(cards, idx - 1);
    $('#btnRunLess').disabled = idx === cards.length - 1;
  }
  function adjustRun(delta) {
    if (ES.UI.hasModal?.() || !action() || !B.sel) return;
    const { col, idx } = B.sel, cards = B.g.cols[col], next = idx + delta;
    if (next < 0 || next >= cards.length || !E().movable(cards, next)) return;
    select(col, next); announce('Selected ' + (cards.length - next) + ' cards from ' + E().cardName(cards[next]) + '.');
  }
  function reveal(col, idx) {
    if (!B.L) return;
    const p = B.L.cols[col].items[idx] || { x: B.L.cols[col].x, y: 0 }, t = B.table;
    if (p.x < (t.scrollLeft || 0)) t.scrollLeft = Math.max(0, p.x - 8);
    else if (p.x + B.L.cw > (t.scrollLeft || 0) + t.clientWidth) t.scrollLeft = p.x + B.L.cw - t.clientWidth + 8;
    if (p.y < t.scrollTop) t.scrollTop = Math.max(0, p.y - 8);
    else if (p.y + B.L.ch > t.scrollTop + t.clientHeight) t.scrollTop = p.y + Math.min(B.L.ch, t.clientHeight) - t.clientHeight + 8;
  }
  function smartMove(col, idx, quiet) {
    if (!action()) return false;
    const g = B.g, to = E().smartTarget(g, col, idx);
    if (to < 0) { if (!quiet) { rejectAt(col, idx); ES.UI.toast('No place for this card right now.'); } return false; }
    select(null);
    const ok = doMove(col, idx, to);
    if (ok) ES.Analytics.log('smart_move', { suits: g.suits });
    return ok;
  }
  function tapCard(col, idx) {
    if (!action()) return;
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
    announce('Cannot move those cards there. Choose a legal highlighted column, or cancel selection.');
    const g = B.g; if (!motion()) return;
    for (let i = idx; i < g.cols[col].length; i++) {
      const d = B.els.get(g.cols[col][i].id); if (!d) continue;
      const p = B.pos.get(d.dataset.id);
      animate(d, [0, -4, 4, -2, 0].map(dx => ({ transform: `translate3d(${p.x + dx}px, ${p.y}px, 0)` })), { duration: 240, easing: 'ease-out' });
    }
  }

  /* ---------- pointer: drag + tap ----------------------------------------- */
  function colAtX(x) {
    const L = B.L; let best = -1, bd = 1e9;
    L.cols.forEach((c, i) => { const cx = c.x + L.cw / 2, d = Math.abs(cx - x); if (d < bd) { bd = d; best = i; } });
    return bd < L.colW * 0.75 + L.gap ? best : -1;
  }
  function onDown(e) {
    if (e.isPrimary === false || ES.UI.hasModal?.() || e.target.closest('.a11y-col') || !action() || e.button > 0 || B.drag) return;
    ES.Audio.unlock();
    const br = B.el.getBoundingClientRect();
    const x = e.clientX - br.left, y = e.clientY - br.top;
    const cardEl = e.target.closest('.card');
    let col, idx;
    if (cardEl && B.els.has(cardEl.dataset.id)) { col = +cardEl.dataset.col; idx = +cardEl.dataset.idx; }
    else { col = colAtX(x); idx = -1; }
    B.drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x0: x, y0: y, col, idx, started: false, els: [], target: -1, touch: e.pointerType === 'touch', scrollX: B.table.scrollLeft || 0, scrollY: B.table.scrollTop };
    if (idx >= 0 && B.g.cols[col][idx] && B.g.cols[col][idx].up && E().movable(B.g.cols[col], idx)) {
      B.drag.can = true;
      if (!B.drag.touch || B.touchDrag) { try { B.el.setPointerCapture(e.pointerId); } catch (err) {} }
    }
  }
  let rafMove = 0, lastEv = null;
  function onMove(e) {
    const D = B.drag; if (!D || D.id !== e.pointerId) return;
    if (D.touch && !B.touchDrag) { if (Math.hypot(e.clientX - D.sx, e.clientY - D.sy) > 10) D.scrolled = true; return; }
    if (!D.can) { if (Math.hypot(e.clientX - D.sx, e.clientY - D.sy) > 10) D.scrolled = true; return; }
    lastEv = e;
    if (!D.started) {
      if (Math.hypot(e.clientX - D.sx, e.clientY - D.sy) < (D.touch ? 12 : 7)) return;
      startDrag();
    }
    e.preventDefault();
    if (!rafMove) rafMove = frame(() => { rafMove = 0; dragFrame(lastEv); });
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
    const dx = e.clientX - D.sx + (B.table.scrollLeft || 0) - D.scrollX, dy = e.clientY - D.sy + B.table.scrollTop - D.scrollY;
    D.els.forEach(({ d, p }) => { d.style.transform = `translate3d(${p.x + dx}px, ${p.y + dy - 6}px, 0) scale(1.04)`; });
    const lead = D.els[0].p;
    const c = colAtX(lead.x + dx + B.L.cw / 2);
    if (c !== D.target) {
      if (D.target >= 0) B.hls[D.target].classList.remove('over');
      D.target = c;
      if (c >= 0 && D.valid[c] && c !== D.col) B.hls[c].classList.add('over');
    }
    D.dx = dx; D.dy = dy;
    const r = B.table.getBoundingClientRect();
    const speed = (v, lo, hi) => v < lo + 32 ? -10 : v > hi - 32 ? 10 : 0;
    const tx = B.table.scrollLeft || 0, ty = B.table.scrollTop;
    B.table.scrollLeft = Math.max(0, Math.min(B.L.W - B.table.clientWidth, tx + speed(e.clientX, r.left, r.left + r.width)));
    B.table.scrollTop = Math.max(0, Math.min(B.L.height - B.table.clientHeight, ty + speed(e.clientY, r.top, r.top + r.height)));
    if ((tx !== B.table.scrollLeft || ty !== B.table.scrollTop) && !rafMove) rafMove = frame(() => { rafMove = 0; dragFrame(e); });
  }
  function onUp(e) {
    const D = B.drag; if (!D || D.id !== e.pointerId) return;
    if (D.started) dragFrame(e);
    cancelFrame(rafMove); rafMove = 0; lastEv = null; B.drag = null;
    try { B.el.releasePointerCapture(e.pointerId); } catch (err) {}
    if (!D.started) {
      if (D.scrolled || Math.abs((B.table.scrollLeft || 0) - D.scrollX) > 2 || Math.abs(B.table.scrollTop - D.scrollY) > 2) return;
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
      if (motion()) animate(d, [{ transform: `translate3d(${cur.x}px, ${cur.y}px, 0) scale(1.04)` }, { transform: `translate3d(${p.x}px, ${p.y}px, 0) scale(1)` }], { duration: 240, easing: 'cubic-bezier(.3,.8,.3,1)' }).onfinish = () => place(d, p);
      place(d, p);
    });
  }
  function onCancel(e) { if (B.drag && B.drag.id === e.pointerId) { if (B.drag.started) { invalidate('pause'); resumeWork(); } else { B.drag = null; B.lastTap = null; } } }

  /* ---------- keyboard ---------------------------------------------------- */
  function onKey(e) {
    if (ES.UI.hasModal?.() || !action(true)) return;
    const k = e.key, g = B.g;
    const cursor = () => { B.a11y[B.kb.col].focus({ preventScroll: true }); reveal(B.kb.col, B.g.cols[B.kb.col].length - 1); B.kb.active = true; B.hls.forEach((h, c) => h.classList.toggle('kb', c === B.kb.col)); const col = g.cols[B.kb.col]; const top = col[col.length - 1]; announce(`Column ${B.kb.col + 1}: ${col.length ? (top.up ? E().cardName(top) : 'face-down card') + ', ' + col.length + ' cards' : 'empty'}.`); };
    if (k === 'ArrowLeft' || k === 'ArrowRight') { B.kb.col = (B.kb.col + (k === 'ArrowLeft' ? 9 : 1)) % 10; cursor(); e.preventDefault(); return; }
    if ((k === 'ArrowUp' || k === 'ArrowDown') && B.sel) {
      const col = g.cols[B.sel.col]; let i = B.sel.idx + (k === 'ArrowUp' ? -1 : 1);
      if (i >= 0 && i < col.length && E().movable(col, i)) { select(B.sel.col, i); announce(`Selected ${col.length - i} cards from ${E().cardName(col[i])}.`); }
      e.preventDefault(); return;
    }
    if ((k === 'Enter' || k === ' ') && e.target?.closest('.a11y-col')) return;
    if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      if (B.sel && B.sel.col !== B.kb.col) { tapColumn(B.kb.col); return; }
      const col = g.cols[B.kb.col]; if (!col.length) return;
      let i = col.length - 1; while (i > 0 && E().movable(col, i - 1)) i--;
      if (B.sel && B.sel.col === B.kb.col) { select(null); return; }
      tapCard(B.kb.col, i); return;
    }
    if (k === 'Escape') { select(null); announce('Selection cancelled.'); return; }
    if (k === 'd' || k === 'D') doDeal();
    else if (k === 'u' || k === 'U' || ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'Z'))) { e.preventDefault(); doUndo(); }
    else if (k === 'h' || k === 'H') doHint();
  }

  /* ---------- timer -------------------------------------------------------- */
  function startTimer() { B.timerEnabled = true; syncClock(); }
  function stopTimer() { syncClock(); B.timerEnabled = false; syncClock(); }

  /* ---------- public ------------------------------------------------------- */
  function mount() {
    if (B.el) return;
    ES.Store.on(event => {
      if (event.type === 'beforeGameChange') dispose();
      else if (event.type === 'beforeSnapshot') syncClock();
      else if ((event.type === 'persistence' || event.type === 'ownership') && !ES.Store.canEdit) { syncClock(); invalidate('pause'); }
    });
    document.addEventListener('visibilitychange', () => { syncClock(); if (document.hidden) invalidate('pause'); else resumeWork(); });
    root.addEventListener('pagehide', () => { syncClock(); B.pageActive = false; invalidate('pause'); syncClock(); });
    root.addEventListener('pageshow', () => { B.pageActive = true; resumeWork(); });
    B.el = $('#board'); B.table = $('#table');
    B.slots = []; B.hls = [];
    for (let c = 0; c < 10; c++) {
      const s = document.createElement('div'); s.className = 'slot'; s.setAttribute('aria-hidden', 'true'); B.el.appendChild(s); B.slots.push(s);
      const h = document.createElement('div'); h.className = 'col-hl'; h.setAttribute('aria-hidden', 'true'); B.el.appendChild(h); B.hls.push(h);
    }
    const ac = document.createElement('div'); ac.className = 'a11y-cols'; ac.setAttribute('role', 'group'); ac.setAttribute('aria-label', 'Columns');
    B.a11y = Array.from({ length: 10 }, (_, c) => { const b = document.createElement('button'); b.className = 'a11y-col'; b.type = 'button'; b.tabIndex = 0; b.addEventListener('focus', () => { B.kb.col = c; if (B.g) reveal(c, B.g.cols[c].length - 1); }); b.addEventListener('click', () => a11yActivate(c)); ac.appendChild(b); return b; });
    B.el.appendChild(ac);
    const mode = $('#btnTouchMode');
    if (mode) mode.addEventListener('click', () => { if (ES.UI.hasModal?.()) return; invalidate('pause'); B.touchDrag = !B.touchDrag; B.el.classList.toggle('touch-drag', B.touchDrag); mode.setAttribute('aria-pressed', String(B.touchDrag)); mode.textContent = B.touchDrag ? 'Touch: drag' : 'Touch: scroll'; render({ type: 'none' }); if (eligible()) scheduleEndgameChecks(); announce(B.touchDrag ? 'Touch dragging enabled. Drag near an edge to scroll. Switch to scroll mode to swipe.' : 'Swipe to scroll. Tap cards to select and place.'); });
    $('#btnRunMore')?.addEventListener('click', () => adjustRun(-1));
    $('#btnRunLess')?.addEventListener('click', () => adjustRun(1));
    $('#btnRunCancel')?.addEventListener('click', () => { if (!ES.UI.hasModal?.() && action()) { select(null); announce('Selection cancelled.'); } });
    B.table.addEventListener('scroll', () => { B.lastTap = null; if (B.drag && !B.drag.started) B.drag.scrolled = true; });
    B.el.addEventListener('pointerdown', onDown);
    B.el.addEventListener('pointermove', onMove, { passive: false });
    B.el.addEventListener('pointerup', onUp);
    B.el.addEventListener('pointercancel', onCancel);
    B.el.addEventListener('lostpointercapture', onCancel);
    B.el.addEventListener('keydown', onKey);
    B.el.addEventListener('focus', () => { B.hls[B.kb.col].classList.add('kb'); });
    B.el.addEventListener('blur', () => B.hls.forEach(h => h.classList.remove('kb')));
    $('#btnUndo').addEventListener('click', () => { if (!ES.UI.hasModal?.()) doUndo(); });
    $('#btnHint').addEventListener('click', () => { if (!ES.UI.hasModal?.()) doHint(); });
    $('#btnStock').addEventListener('click', () => { if (!ES.UI.hasModal?.()) doDeal(); });
    $('#btnFinish').addEventListener('click', () => { if (!ES.UI.hasModal?.()) runAutoComplete(); });
    let rt = 0;
    root.addEventListener('resize', () => { if (B.drag) invalidate('pause'); cancelFrame(rt); rt = frame(() => { if (B.g && B.el.offsetParent) { render({ type: 'none' }); if (eligible()) scheduleEndgameChecks(); } }); });
    // pips
    $('#gSets').innerHTML = Array.from({ length: 8 }, () => `<span class="pip">${ES.Icons.icon('sets')}</span>`).join('');
  }
  function start(game, opts) {
    opts = opts || {};
    if (game !== ES.Store.state.game) return;
    if (B.g === game && B.active) { invalidate('session'); resumeWork(); return; }
    dispose();
    revision++; B.g = game; B.active = ES.UI.current === 'game'; B.screen = ES.UI.current; B.timerEnabled = true; B.pageActive = true; B.sel = null; B.hintIdx = 0; B.paused = false; B.plan = null; B.planFor = null; B.stuckShownAt = null; B.autoRunning = false;
    const fin = $('#btnFinish'); if (fin) fin.hidden = true;
    const S = ES.Store.state.settings;
    B.el.style.setProperty('--back', `url('${ES.Manifest.abs(ES.Manifest.back(S.cardBack))}')`);
    B.table.style.setProperty('--table', `url('${ES.Manifest.abs((ES.Manifest.tables[S.table] || ES.Manifest.tables.iron).src)}')`);
    $('#gMode').textContent = (game.daily ? 'Daily · ' : '') + game.suits + ' Suit';
    $('#btnStock .stock-pile').style.setProperty('--back', `url('${ES.Manifest.abs(ES.Manifest.back(S.cardBack))}')`);
    frame(() => {
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
    pause, setAppActive, hold, setScreen, dispose, capture, captureView, isCurrent, isSession, canPresent, onInvalidate, later, cancelLater, wait, frame, syncClock, cancelAutoComplete, stopTimer, startTimer,
    get game() { return B.g; }, set onWin(fn) { B.onWin = fn; },
    highlight(from, idx, to) { if (!B.g || !B.active) return; clearHints(); const g = B.g; for (let i = idx; i < g.cols[from].length; i++) { const d = B.els.get(g.cols[from][i].id); d && d.classList.add('hint-src'); } if (to != null) B.hls[to].classList.add('hint-dst'); },
    clearHints, stockHighlight(v) { $('#btnStock').classList.toggle('hint-dst', v); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
