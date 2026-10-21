/* EMBER SOLITAIRE — ambient effects: rising embers, spark bursts, parallax.
   Everything here is decorative and switches off under Reduced Motion. */
(function (root) {
  'use strict';
  const ES = root.ES = root.ES || {};
  const mq = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function motion() { return !(ES.Store && ES.Store.state.settings.reduced) && !mq.matches; }

  /* ---------- ambient ember field ------------------------------------------ */
  const field = { canvas: null, ctx: null, parts: [], cfg: null, raf: 0, last: 0, w: 0, h: 0, dpr: 1 };
  const PRESETS = {
    none: null,
    splash: { n: 46, area: [0, .35, 1, 1], rise: [18, 46], size: [0.7, 2.2], alpha: .9 },
    home: { n: 34, area: [.2, .35, .8, .85], rise: [14, 36], size: [0.6, 1.9], alpha: .85 },
    forge: { n: 52, area: [.15, .3, .85, .8], rise: [18, 48], size: [0.6, 2.2], alpha: .95 },
    hall: { n: 18, area: [.3, .3, .7, .75], rise: [8, 20], size: [0.5, 1.5], alpha: .6 },
    board: { n: 10, area: [0, .9, 1, 1.02], rise: [6, 16], size: [0.5, 1.2], alpha: .45, maxY: .9 },
    ceremony: { n: 90, area: [.25, .35, .75, .8], rise: [40, 110], size: [0.8, 2.8], alpha: 1 }
  };
  const SPRITE = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,226,170,1)'); g.addColorStop(0.3, 'rgba(255,130,40,.55)'); g.addColorStop(1, 'rgba(255,80,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); return c;
  })();
  function ensureCanvas() {
    if (field.canvas) return;
    const c = document.createElement('canvas'); c.id = 'emberField'; c.setAttribute('aria-hidden', 'true');
    document.getElementById('app').appendChild(c);
    field.canvas = c; field.ctx = c.getContext('2d');
    const rs = () => { field.dpr = Math.min(2, root.devicePixelRatio || 1); field.w = c.clientWidth; field.h = c.clientHeight; c.width = field.w * field.dpr; c.height = field.h * field.dpr; };
    rs(); root.addEventListener('resize', rs);
  }
  function spawn(p, initial) {
    const a = field.cfg.area, r = Math.random;
    p.x = (a[0] + (a[2] - a[0]) * r()) * field.w;
    p.y = initial ? (a[1] + (a[3] - a[1]) * r()) * field.h : a[3] * field.h + r() * 20;
    p.vy = -(field.cfg.rise[0] + r() * (field.cfg.rise[1] - field.cfg.rise[0]));
    p.vx = (r() - 0.5) * 8; p.s = field.cfg.size[0] + r() * (field.cfg.size[1] - field.cfg.size[0]);
    p.life = 0; p.max = 2.5 + r() * 4; p.ph = r() * 6.28;
  }
  function setField(name) {
    ensureCanvas();
    const cfg = PRESETS[name] || null;
    field.cfg = cfg;
    cancelAnimationFrame(field.raf);
    field.ctx.clearRect(0, 0, field.canvas.width, field.canvas.height);
    if (!cfg || !motion()) { field.canvas.style.opacity = 0; return; }
    field.canvas.style.opacity = 1;
    field.parts = Array.from({ length: cfg.n }, () => { const p = {}; spawn(p, true); return p; });
    field.last = performance.now();
    const loop = now => {
      const dt = Math.min(0.05, (now - field.last) / 1000); field.last = now;
      const x = field.ctx, d = field.dpr;
      x.setTransform(d, 0, 0, d, 0, 0); x.globalAlpha = 1; x.clearRect(0, 0, field.w, field.h);
      x.globalCompositeOperation = 'lighter';
      for (const p of field.parts) {
        p.life += dt; p.ph += dt * 2;
        p.x += (p.vx + Math.sin(p.ph) * 6) * dt; p.y += p.vy * dt;
        const k = Math.min(1, p.life / 0.6) * Math.max(0, 1 - p.life / p.max);
        if (k <= 0 && p.life > 0.6) { spawn(p, false); continue; }
        if (cfg.maxY && p.y < cfg.maxY * field.h - 60) { spawn(p, false); continue; }
        x.globalAlpha = k * cfg.alpha;
        const r = p.s * 4; x.drawImage(SPRITE, p.x - r, p.y - r, r * 2, r * 2);
      }
      field.raf = requestAnimationFrame(loop);
    };
    field.raf = requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(field.raf); else if (field.cfg) setField(field.name); });

  /* ---------- spark burst at a point (DOM sparks, short-lived) --------------- */
  function sparks(x, y, n, spread, opts) {
    if (!motion()) return;
    opts = opts || {};
    for (let i = 0; i < (n || 8); i++) {
      const s = document.createElement('i'); s.className = 'spark';
      s.style.left = x + 'px'; s.style.top = y + 'px';
      document.body.appendChild(s);
      const a = opts.up ? (-Math.PI / 2 + (Math.random() - .5) * 1.6) : Math.random() * Math.PI * 2;
      const d = (spread || 40) * (0.5 + Math.random() * 0.8);
      const dx = Math.cos(a) * d, dy = Math.sin(a) * d + (opts.up ? 0 : 10);
      s.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.2)`, opacity: 0 }],
        { duration: (opts.dur || 520) + Math.random() * 260, easing: 'cubic-bezier(.15,.7,.3,1)', fill: 'forwards' }).onfinish = () => s.remove();
    }
  }

  /* ---------- pointer / tilt parallax -------------------------------------- */
  let px = 0, py = 0;
  function parallaxInit() {
    const upd = () => { document.documentElement.style.setProperty('--px', motion() ? px.toFixed(3) : 0); document.documentElement.style.setProperty('--py', motion() ? py.toFixed(3) : 0); };
    root.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; px = (e.clientX / root.innerWidth - .5) * 2; py = (e.clientY / root.innerHeight - .5) * 2; upd(); }, { passive: true });
    root.addEventListener('deviceorientation', e => { if (e.gamma == null) return; px = Math.max(-1, Math.min(1, e.gamma / 30)); py = Math.max(-1, Math.min(1, (e.beta - 45) / 30)); upd(); }, { passive: true });
  }

  ES.FX = { motion, setField(name) { field.name = name; setField(name); }, sparks, parallaxInit };
})(typeof window !== 'undefined' ? window : globalThis);
