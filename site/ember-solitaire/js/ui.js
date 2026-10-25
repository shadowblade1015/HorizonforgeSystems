/* ==========================================================================
   EMBER SOLITAIRE — UI kernel: router, environments, sheets, toasts
   ========================================================================== */
(function (root) {
  'use strict';
  const ES = root.ES = root.ES || {};
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const I = (n, c) => ES.Icons.icon(n, c);

  let navigation = 0;
  const sheets = new Set();
  const UI = { current: null, stack: [], renderers: {} };


  // Shared focus ownership for sheets and ceremonies; only the top modal is active.
  const modals = [], isolated = new Map();
  const topModal = () => modals[modals.length - 1];
  const within = (el, node) => { for (let n = node; n; n = n.parentElement || n.parentNode || n.parent) if (n === el) return true; return false; };
  function isolate() {
    const top = topModal(), app = document.getElementById('app');
    for (const el of app.children) {
      if (!isolated.has(el)) isolated.set(el, { inert: !!el.inert, hidden: el.getAttribute ? el.getAttribute('aria-hidden') : null });
      if (top) { el.inert = el !== top.el; if (el !== top.el) el.setAttribute('aria-hidden', 'true'); else el.removeAttribute('aria-hidden'); }
    }
    if (!top) {
      for (const [el, old] of isolated) { el.inert = old.inert; if (old.hidden === null) el.removeAttribute('aria-hidden'); else el.setAttribute('aria-hidden', old.hidden); }
      isolated.clear();
    }
  }
  function modal(el, options = {}) {
    const owner = { page: UI.current, navigation, profile: ES.Store.state, game: ES.Store.state.game };
    const previous = document.activeElement;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', options.title || 'Ember Solitaire'); el.tabIndex = -1;
    const record = { el }; modals.push(record);
    const focusables = () => [...el.querySelectorAll('button, [href], input, select, textarea, [tabindex]')].filter(x => !x.disabled && !x.hidden && x.tabIndex !== -1 && !x.closest?.('[hidden], [inert]'));
    const focus = () => { if (topModal() !== record) return; const list = focusables(), preferred = el.querySelector(options.focus || '.btn-primary'); (list.includes(preferred) ? preferred : list[0] || el).focus({ preventScroll: true }); };
    record.focus = focus; focus(); isolate();
    const onKey = e => {
      if (topModal() !== record) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); options.dismiss?.(); }
      if (e.key !== 'Tab') return;
      const list = focusables(), first = list[0] || el, last = list[list.length - 1] || el;
      if (!list.includes(document.activeElement) || !list.length || (e.shiftKey && document.activeElement === first) || (!e.shiftKey && document.activeElement === last)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
    };
    const onFocus = e => { if (topModal() === record && !within(el, e.target)) focus(); };
    document.addEventListener('keydown', onKey, true); document.addEventListener('focusin', onFocus, true);
    let closed = false;
    return () => {
      if (closed) return; closed = true;
      const wasTop = topModal() === record; modals.splice(modals.indexOf(record), 1);
      document.removeEventListener('keydown', onKey, true); document.removeEventListener('focusin', onFocus, true);
      isolate(); el.inert = true; el.setAttribute('aria-hidden', 'true');
      if (modals.length) isolated.set(el, { inert: true, hidden: 'true' });
      const top = topModal();
      const sameOwner = navigation === owner.navigation && UI.current === owner.page && ES.Store.state === owner.profile && ES.Store.state.game === owner.game;
      if (wasTop && sameOwner) {
        if (previous && previous.isConnected !== false && !previous.inert && !previous.closest?.('[inert], [hidden]') && (!top || within(top.el, previous))) previous.focus({ preventScroll: true });
        else if (top) top.focus();
      }
    };
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function n(v) { return Number(v || 0).toLocaleString('en-US'); }
  function dur(ms) {
    if (ms == null) return '—';
    const s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    if (h >= 48) return `${Math.floor(h / 24)}d ${h % 24}h`; if (h) return `${h}h ${m}m`; if (m) return `${m}m ${String(s % 60).padStart(2, '0')}s`; return `${s}s`;
  }
  function clock(ms) { if (ms == null) return '—'; const s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
  function date(ts) { return ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; }

  /* ---------- settings → document ----------------------------------------- */
  function applySettings() {
    const s = ES.Store.state.settings, d = document.documentElement;
    d.dataset.reduced = s.reduced ? '1' : '0';
    d.dataset.contrast = s.contrast ? '1' : '0';
    d.dataset.large = s.largeCards ? '1' : '0';
    ES.Audio.apply();
    if (UI.current) { const sc = document.getElementById('scr-' + UI.current); ES.FX.setField(sc && sc.dataset.field || 'none'); }
  }

  /* ---------- environments (lazy) ------------------------------------------ */
  function setEnv(sec) {
    const key = sec.dataset.env, bg = sec.querySelector(':scope > .bg');
    if (!key || !bg) return;
    const src = ES.Manifest.envSrc(key);
    if (bg.dataset.src !== src) { bg.dataset.src = src; bg.style.backgroundImage = `url('${src}')`; }
  }
  root.addEventListener('resize', () => { if (UI.current) setEnv($('#scr-' + UI.current)); });

  /* ---------- router -------------------------------------------------------- */
  function go(name, opts) {
    opts = opts || {};
    const next = $('#scr-' + name); if (!next) return;
    const prevName = UI.current, prev = prevName && $('#scr-' + prevName);
    if (prevName === name && !opts.force) { render(name, opts); return; }
    if (prev && !opts.replace && prevName !== 'splash' && prevName !== 'intro') UI.stack.push(prevName);
    if (UI.stack.length > 12) UI.stack.shift();
    const ticket = ++navigation;
    for (const close of [...sheets]) close();
    UI.current = name;
    if (ES.Board && ES.Board.setScreen) ES.Board.setScreen(name);
    setEnv(next);
    render(name, opts);
    next.classList.add('is-active');
    requestAnimationFrame(() => { if (ticket === navigation) requestAnimationFrame(() => { if (ticket === navigation) next.classList.add('is-in'); }); });
    if (prev && prev !== next) {
      prev.classList.remove('is-in');
      const d = ES.FX.motion() ? 320 : 0;
      setTimeout(() => { if (UI.current !== prevName) prev.classList.remove('is-active'); }, d);
    }
    // tab bar
    const tb = $('#tabbar');
    tb.classList.toggle('is-hidden', !next.classList.contains('has-tabbar'));
    $$('#tabbar .tab').forEach(t => { const on = t.dataset.tab === next.dataset.tab; t.classList.toggle('is-active', on); on ? t.setAttribute('aria-current', 'page') : t.removeAttribute('aria-current'); });
    ES.FX.setField(next.dataset.field || 'none');

    const h = next.querySelector('h1, h2, .display');
    if (opts.focus !== false && h && prevName) { h.setAttribute('tabindex', '-1'); setTimeout(() => { if (ticket === navigation && UI.current === name) h.focus({ preventScroll: true }); }, 30); }
  }
  function back(fallback) {
    let p = UI.stack.pop();
    while (p && (p === UI.current || p === 'game')) p = UI.stack.pop();
    go(p || fallback || 'home', { replace: true });
  }
  function render(name, opts) { const r = UI.renderers[name]; if (r) r(opts || {}); hydrateIcons(document); }

  /* ---------- icons in static markup --------------------------------------- */
  function hydrateIcons(scope) {
    (scope || document).querySelectorAll('[data-icon]').forEach(el => { if (!el.firstChild) el.innerHTML = I(el.dataset.icon); });
  }

  /* ---------- toast --------------------------------------------------------- */
  let toastT = 0;
  function toast(msg, kind) {
    const t = $('#toast'); t.textContent = msg; t.className = 'toast is-in' + (kind ? ' ' + kind : '');
    clearTimeout(toastT); toastT = setTimeout(() => (t.className = 'toast'), 2200);
  }

  /* ---------- sheets (modal dialogs) --------------------------------------- */
  function sheet(o) {
    const release = ES.Board && ES.Board.hold ? ES.Board.hold() : () => {};
    let closed = false, unsubscribe = () => {};
    const wrap = document.createElement('div');
    wrap.className = 'overlay'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true');
    if (o.title) wrap.setAttribute('aria-label', o.title);
    wrap.innerHTML = `<div class="sheet ${o.cls || ''}"><div class="panel ${o.glow ? 'glow' : ''}">
      ${o.closable !== false ? `<button class="icon-btn sheet-x" aria-label="Close">${I('close')}</button>` : ''}
      ${o.kicker ? `<div class="caps center">${esc(o.kicker)}</div>` : ''}
      ${o.title ? `<h2 class="display md center sheet-title">${esc(o.title)}</h2><div class="ornament"></div>` : ''}
      <div class="sheet-body">${o.body || ''}</div>
      ${o.actions && o.actions.length ? `<div class="menu-list">${o.actions.map((a, i) => `<div class="${a.primary ? 'cta' : ''}"><button class="btn btn-block ${a.primary ? 'btn-primary' : a.ghost ? 'btn-ghost' : ''}" data-i="${i}">${a.icon ? I(a.icon) : ''}${esc(a.label)}</button></div>`).join('')}</div>` : ''}
    </div></div>`;
    document.getElementById('app').appendChild(wrap);
    const enterFrame = requestAnimationFrame(() => { if (!closed) wrap.classList.add('is-in'); });
    let focusTimer;
    const close = (val) => {
      if (closed) return; closed = true; wrap.lifecycleClosed = true;
      clearTimeout(focusTimer); cancelAnimationFrame(enterFrame); sheets.delete(close); unsubscribe(); release();
      wrap.classList.remove('is-in'); releaseModal();
      setTimeout(() => wrap.remove(), ES.FX.motion() ? 220 : 0);
      o.onClose && o.onClose(val);
    };
    const releaseModal = modal(wrap, { title: o.title, focus: o.focus, dismiss: o.closable !== false ? close : null });
    sheets.add(close);
    if (ES.Board && ES.Board.onInvalidate) unsubscribe = ES.Board.onInvalidate(kind => { if (kind !== 'pause') close(); });
    wrap.addEventListener('click', e => {
      if (closed || topModal()?.el !== wrap) return;
      if (e.target === wrap && o.closable !== false) return close();
      if (e.target.closest('.sheet-x')) return close();
      const b = e.target.closest('[data-i]'); if (b) { ES.Audio.play('ui'); const a = o.actions[+b.dataset.i]; if (a.onClick && a.onClick(close) === false) return; if (!a.keepOpen) close(a.value); }
    });
    if (o.onMount) o.onMount(wrap, close);
    focusTimer = setTimeout(() => { if (!closed && topModal()?.el === wrap) topModal().focus(); }, 60);
    return close;
  }

  /* ---------- shared building blocks --------------------------------------- */
  function header(o) {
    return `<header class="hdr">
      ${o.back ? `<button class="icon-btn" data-back aria-label="Back">${I('back')}</button>` : '<span></span>'}
      <div class="ttl"><h2 class="display">${esc(o.title)}</h2>${o.kicker ? `<span class="caps">${esc(o.kicker)}</span>` : ''}</div>
      ${o.right || '<span></span>'}
    </header>`;
  }
  function molten(p, o) {
    o = o || {};
    return `<div class="molten ${o.thin ? 'thin' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p * 100)}" ${o.label ? `aria-label="${esc(o.label)}"` : ''}><div class="fill" style="--p:${Math.max(0, Math.min(1, p)).toFixed(3)}"></div>${o.ticks ? '<div class="ticks"></div>' : ''}</div>`;
  }
  function levelBadge() {
    const S = ES.Store.state, p = ES.Store.levelProgress();
    return `<div class="lvl-badge" aria-hidden="true"><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" class="lvl-ring"/><circle cx="24" cy="24" r="21" class="lvl-arc" style="stroke-dasharray:${(p * 132).toFixed(1)} 132"/></svg><b>${S.forgeLevel}</b></div>`;
  }
  function artifactStage(id, tier, heat, o) {
    o = o || {};
    const def = ES.Artifacts.get(id);
    return `<div class="stage-inner ${tier >= 6 ? 'tier-legendary' : ''}" data-art-id="${id}" style="--heat:${(heat / 100).toFixed(3)}">
      <div class="art-glow"></div>
      ${o.prop === 'anvil' ? `<img class="prop anvil" src="${ES.Manifest.env.anvil}" alt="">` : o.prop === 'pedestal' ? `<img class="prop pedestal" src="${ES.Manifest.env.pedestal}" alt="">` : ''}
      <div class="art-holder ${o.prop ? 'on-' + o.prop : ''}" ${o.inspect ? `role="button" tabindex="0" aria-label="Inspect ${esc(def.name)}"` : ''}>${ES.Artifacts.svg(id, { tier, silhouette: o.silhouette })}</div>
      <div class="art-floor"></div>
    </div>`;
  }
  function wireHeat(scope, id, heat) {
    const s = scope.querySelector('svg.artifact-svg'); if (s) ES.Artifacts.setHeat(s, id, heat);
  }
  /* Animate heat from a to b (used after victories) */
  function animateHeat(scope, id, from, to, ms) {
    const s = scope.querySelector('svg.artifact-svg'); if (!s) return () => {};
    let stopped = false, frame = 0;
    const cancel = () => { stopped = true; cancelAnimationFrame(frame); };
    if (!ES.FX.motion()) { ES.Artifacts.setHeat(s, id, to); return cancel; }
    const t0 = performance.now();
    const step = now => {
      if (stopped || scope.isConnected === false || s.isConnected === false) return;
      const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      ES.Artifacts.setHeat(s, id, from + (to - from) * e);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step); return cancel;
  }

  /* ---------- persistence status and player-controlled recovery ------------ */
  function downloadSave(raw, filename) {
    if (raw === null) { toast('No recovery copy is available.'); return; }
    try {
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { toast('Download failed. Keep this page open and try another browser.'); }
  }
  function saveRecovery() {
    const store = ES.Store;
    sheet({ title: 'Save Recovery', body: `<p class="small" id="recoveryMessage" role="status"></p>
      <p class="small muted">Export before closing this page. Import replaces current progress only after confirmation; previous copies are kept on this device. No saves are deleted automatically.</p>
      <div class="menu-list">
        <button class="btn btn-block" id="saveExport">Export current progress</button>
        <button class="btn btn-block" id="saveOriginal">Export original save</button>
        <button class="btn btn-block" id="saveBackup">Export last good backup</button>
        <label for="recoveryCopy">Retained recovery copies</label><select id="recoveryCopy" aria-label="Retained recovery copy"></select>
        <button class="btn btn-block" id="saveCopy">Export selected recovery copy</button>
        <button class="btn btn-block" id="saveRetry">Retry saving</button>
        <button class="btn btn-block" id="saveAccept">Use recovered progress</button>
        <label for="saveImport">Choose a save to import</label><input id="saveImport" type="file" accept="application/json,.json">
      </div>`, onMount(wrap, close) {
      const owner = store.state;
      const message = wrap.querySelector('#recoveryMessage');
      const show = () => { message.textContent = store.persistence.message || 'Progress is saved on this device.'; wrap.querySelector('#saveAccept').disabled = !store.canRecover; };
      show();
      wrap.querySelector('#saveExport').onclick = () => { try { downloadSave(store.exportSave(), 'ember-save-v2.json'); } catch (e) { message.textContent = e.message; } };
      wrap.querySelector('#saveOriginal').onclick = () => downloadSave(store.exportOriginal(), 'ember-original-save.json');
      wrap.querySelector('#saveBackup').onclick = () => { try { downloadSave(store.exportBackup(), 'ember-backup.json'); } catch (e) { message.textContent = 'Backup storage is unavailable.'; } };
      const choices = wrap.querySelector('#recoveryCopy');
      try {
        for (const key of store.recoveryCopies()) { const option = document.createElement('option'); option.value = key; option.textContent = key; choices.appendChild(option); }
      } catch (e) { message.textContent += ' Recovery storage is unavailable.'; }
      wrap.querySelector('#saveCopy').onclick = () => { try { downloadSave(store.exportRecovery(choices.value), 'ember-recovery.json'); } catch (e) { message.textContent = 'Recovery copy is unavailable.'; } };
      wrap.querySelector('#saveRetry').onclick = () => { store.save(true); show(); };
      wrap.querySelector('#saveAccept').onclick = () => {
        sheet({ title: 'Use recovered progress?', body: '<p>The damaged hand or invalid fields will be excluded. Review an exported copy first. The original save will stay in recovery storage.</p>', actions: [{ label: 'Keep reviewing' }, { label: 'Save recovered progress', primary: true, onClick: () => { store.acceptRecovery(); show(); } }] });
      };
      wrap.querySelector('#saveImport').onchange = async e => {
        const file = e.target.files[0]; if (!file) return;
        try {
          if (file.size > 5 * 1024 * 1024) throw Error('Save file is too large (maximum 5 MB).');
          const raw = await file.text();
          if (wrap.lifecycleClosed || wrap.isConnected === false || store.state !== owner) return;
          const next = store.inspectImport(raw);
          sheet({ title: 'Replace current progress?', body: `<p>This save has ${esc(n(next.embers))} Ember and ${esc(n(next.stats.wins))} wins. Your current stored and in-memory progress will be retained as recovery copies. Import replaces progress; it does not merge rewards.</p>`, actions: [{ label: 'Keep current progress' }, { label: 'Import this save', primary: true, onClick: () => {
            if (store.importSave(raw)) { if (ES.Board) ES.Board.pause(true); close(); applySettings(); go('home'); toast('Save imported. Previous copies retained.'); }
            else show();
          } }] });
        } catch (error) { if (!wrap.lifecycleClosed && wrap.isConnected !== false) message.textContent = 'Import rejected: ' + error.message; }
        if (!wrap.lifecycleClosed && wrap.isConnected !== false) e.target.value = '';
      };
    } });
  }
  function mountSaveStatus() {
    const banner = document.createElement('div'); banner.className = 'save-status'; banner.hidden = true;
    const message = document.createElement('span'); message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite');
    const action = document.createElement('button'); action.className = 'btn'; action.textContent = 'Save Recovery'; action.onclick = saveRecovery;
    banner.append(message, action); document.getElementById('app').appendChild(banner);
    const update = () => {
      const state = ES.Store.persistence;
      banner.hidden = !state.unsaved || state.code === 'pending';
      message.textContent = state.message;
    };
    ES.Store.on(evt => { if (evt.type === 'persistence') update(); });
    update();
  }

  /* global delegated navigation */
  document.addEventListener('click', e => {
    if (topModal() && !within(topModal().el, e.target)) return;
    const g = e.target.closest('[data-go]');
    if (g) { ES.Audio.unlock(); ES.Audio.play('ui'); go(g.dataset.go); return; }
    const b = e.target.closest('[data-back]');
    if (b) { ES.Audio.play('ui'); back(); }
  });

  Object.assign(UI, { modal, hasModal: () => !!topModal(), isActiveModal: el => topModal()?.el === el, saveRecovery, mountSaveStatus, $, $$, esc, n, dur, clock, date, go, back, render, toast, sheet, header, molten, levelBadge, artifactStage, wireHeat, animateHeat, hydrateIcons, applySettings, setEnv, I });
  ES.UI = UI;
})(typeof window !== 'undefined' ? window : globalThis);
