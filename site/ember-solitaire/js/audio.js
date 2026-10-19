/* EMBER SOLITAIRE — synthesized sound (no audio files to ship)
   SFX: card pick / place / deal / invalid / sequence chime / anvil strike / victory
   Music: low forge drone + crackling fire bed.  Starts after the first gesture. */
(function (root) {
  'use strict';
  const ES = root.ES = root.ES || {};
  let ctx = null, sfxBus = null, musicBus = null, noiseBuf = null, musicNodes = null;
  const st = () => ES.Store.state.settings;

  function init() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return null;
    ctx = new AC();
    sfxBus = ctx.createGain(); sfxBus.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    apply();
    return ctx;
  }
  function apply() {
    if (!ctx) return;
    sfxBus.gain.value = st().sfx * 0.9;
    musicBus.gain.setTargetAtTime(st().music * 0.55, ctx.currentTime, 0.4);
    if (st().music > 0 && !musicNodes) startMusic();
    if (st().music <= 0 && musicNodes) stopMusic();
  }
  function unlock() { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); apply(); }

  function noise(t, dur, freq, q, gain, type) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  function tone(t, freq, dur, gain, type, bus) {
    const o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  const SFX = {
    pick(t) { noise(t, 0.06, 2600, 1.2, 0.18); },
    place(t) { noise(t, 0.09, 1400, 0.9, 0.28); tone(t, 150, 0.08, 0.12, 'sine'); },
    deal(t) { for (let i = 0; i < 10; i++) noise(t + i * 0.03, 0.05, 2200 + i * 60, 1.4, 0.13); },
    flip(t) { noise(t, 0.05, 3400, 2, 0.12); },
    invalid(t) { tone(t, 110, 0.14, 0.18, 'triangle'); noise(t, 0.08, 500, 1, 0.12); },
    ui(t) { noise(t, 0.03, 4200, 3, 0.08); },
    sequence(t) { [880, 1320, 1760].forEach((f, i) => tone(t + i * 0.07, f, 1.1, 0.07, 'sine')); for (let i = 0; i < 6; i++) noise(t + 0.1 + Math.random() * 0.4, 0.03, 3000, 4, 0.08); },
    strike(t) { [523, 1187, 1893, 2641, 3520].forEach((f, i) => tone(t, f, 1.8 - i * 0.25, 0.14 / (i + 1), 'sine')); noise(t, 0.2, 1800, 0.7, 0.5); tone(t, 70, 0.3, 0.3, 'sine'); },
    victory(t) { [392, 523, 659, 784, 1046].forEach((f, i) => tone(t + i * 0.12, f, 1.4, 0.06, 'triangle')); },
    ember(t) { tone(t, 1480, 0.25, 0.04, 'sine'); }
  };
  function play(name) {
    if (!st().sfx) return;
    if (!ctx) init(); if (!ctx || ctx.state !== 'running' || suspended) return;
    try { SFX[name] && SFX[name](ctx.currentTime + 0.005); } catch (e) {}
  }
  function startMusic() {
    if (!ctx || musicNodes) return;
    const nodes = [];
    [55, 55.4, 82.5].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180 + i * 40;
      const g = ctx.createGain(); g.gain.value = 0.05;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + i * 0.03; const lg = ctx.createGain(); lg.gain.value = 60;
      lfo.connect(lg); lg.connect(lp.frequency); o.connect(lp); lp.connect(g); g.connect(musicBus); o.start(); lfo.start();
      nodes.push(o, lfo);
    });
    // fire bed
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
    const g = ctx.createGain(); g.gain.value = 0.05; s.connect(f); f.connect(g); g.connect(musicBus); s.start(); nodes.push(s);
    const crackle = setInterval(() => {
      if (!ctx || ctx.state !== 'running' || document.hidden) return;
      const t = ctx.currentTime; const n = 1 + (Math.random() * 3 | 0);
      for (let i = 0; i < n; i++) {
        const b = ctx.createBufferSource(); b.buffer = noiseBuf; const bf = ctx.createBiquadFilter(); bf.type = 'highpass'; bf.frequency.value = 2500;
        const bg = ctx.createGain(); const tt = t + Math.random() * 0.4; bg.gain.setValueAtTime(0.0001, tt); bg.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.06, tt + 0.002); bg.gain.exponentialRampToValueAtTime(0.0001, tt + 0.03);
        b.connect(bf); bf.connect(bg); bg.connect(musicBus); b.start(tt, Math.random()); b.stop(tt + 0.05);
      }
    }, 420);
    musicNodes = { nodes, crackle };
  }
  function stopMusic() {
    if (!musicNodes) return;
    musicNodes.nodes.forEach(n => { try { n.stop(); } catch (e) {} });
    clearInterval(musicNodes.crackle); musicNodes = null;
  }
  function haptic(pattern) {
    if (!st().haptics) return;
    if (ES.Platform && ES.Platform.haptic(pattern)) return;          // native haptics
    if (!root.navigator || !navigator.vibrate) return;
    try { navigator.vibrate(pattern); } catch (e) {}
  }
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (st().music || st().sfx) ctx.resume(); });
  // Silence everything while a full-screen ad is up, then restore.
  let suspended = false;
  function suspend(on) {
    suspended = !!on;
    if (!ctx) return;
    if (on) ctx.suspend(); else if (!document.hidden && (st().music || st().sfx)) ctx.resume();
  }
  ES.Audio = { unlock, apply, play, haptic, suspend };
})(typeof window !== 'undefined' ? window : globalThis);
