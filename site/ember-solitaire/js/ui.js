/* ==========================================================================
   EMBER SOLITAIRE — UI kernel: router, environments, sheets, toasts
   ========================================================================== */
(function (root) {
  'use strict';
  const ES = root.ES = root.ES || {};
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const I = (n, c) => ES.Icons.icon(n, c);

  const UI = { current: null, stack: [], renderers: {} };

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
    if (prevName === 'game' && ES.Board) ES.Board.pause(true);
    UI.current = name;
    setEnv(next);
    render(name, opts);
    next.classList.add('is-active');
    requestAnimationFrame(() => requestAnimationFrame(() => next.classList.add('is-in')));
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
    if (name === 'game' && ES.Board) ES.Board.pause(false);
    const h = next.querySelector('h1, h2, .display');
    if (opts.focus !== false && h && prevName) { h.setAttribute('tabindex', '-1'); setTimeout(() => h.focus({ preventScroll: true }), 30); }
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
    const prevFocus = document.activeElement;
    document.getElementById('app').appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('is-in'));
    const close = (val) => {
      wrap.classList.remove('is-in'); document.removeEventListener('keydown', onKey, true);
      setTimeout(() => wrap.remove(), ES.FX.motion() ? 220 : 0);
      if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
      o.onClose && o.onClose(val);
    };
    const onKey = e => {
      if (e.key === 'Escape' && o.closable !== false) { e.stopPropagation(); close(); }
      if (e.key === 'Tab') { const f = [...wrap.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { z.focus(); e.preventDefault(); } else if (!e.shiftKey && document.activeElement === z) { a.focus(); e.preventDefault(); } }
    };
    document.addEventListener('keydown', onKey, true);
    wrap.addEventListener('click', e => {
      if (e.target === wrap && o.closable !== false) return close();
      if (e.target.closest('.sheet-x')) return close();
      const b = e.target.closest('[data-i]'); if (b) { ES.Audio.play('ui'); const a = o.actions[+b.dataset.i]; if (a.onClick && a.onClick(close) === false) return; if (!a.keepOpen) close(a.value); }
    });
    if (o.onMount) o.onMount(wrap, close);
    setTimeout(() => { const f = wrap.querySelector(o.focus || '.btn-primary, .btn, button'); f && f.focus({ preventScroll: true }); }, 60);
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
    const s = scope.querySelector('svg.artifact-svg'); if (!s) return;
    if (!ES.FX.motion()) { ES.Artifacts.setHeat(s, id, to); return; }
    const t0 = performance.now();
    const step = now => { const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3); ES.Artifacts.setHeat(s, id, from + (to - from) * e); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  /* global delegated navigation */
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-go]');
    if (g) { ES.Audio.unlock(); ES.Audio.play('ui'); go(g.dataset.go); return; }
    const b = e.target.closest('[data-back]');
    if (b) { ES.Audio.play('ui'); back(); }
  });

  Object.assign(UI, { $, $$, esc, n, dur, clock, date, go, back, render, toast, sheet, header, molten, levelBadge, artifactStage, wireHeat, animateHeat, hydrateIcons, applySettings, setEnv, I });
  ES.UI = UI;
})(typeof window !== 'undefined' ? window : globalThis);
