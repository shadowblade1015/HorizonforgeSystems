/* ==========================================================================
   EMBER SOLITAIRE — Asset manifest
   Single source of truth for every production asset path. Screens never
   hard-code file names; swap art here (or drop a file at the same path).
   ========================================================================== */
(function (root) {
  'use strict';
  const ES = root.ES = root.ES || {};
  const RANK_FILE = { 1: 'ace', 11: 'jack', 12: 'queen', 13: 'king' };
  const SUIT_DIR = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };

  const M = {
    version: '2.1.0',
    branding: {
      emblem: 'assets/branding/ember_spade.webp',
      emblemSmall: 'assets/branding/ember_spade_sm.webp',
      icon192: 'assets/branding/icon-192.png',
      icon512: 'assets/branding/icon-512.png'
    },
    env: {
      splash: { portrait: 'assets/environments/splash_portrait.webp', landscape: 'assets/environments/splash_landscape.webp' },
      forgeHall: { portrait: 'assets/environments/forge_hall_portrait.webp', landscape: 'assets/environments/forge_hall_landscape.webp' },
      forgeChamber: { portrait: 'assets/environments/forge_chamber_portrait.webp', landscape: 'assets/environments/forge_chamber_landscape.webp' },
      hall: { portrait: 'assets/environments/hall_legends_portrait.webp', landscape: 'assets/environments/hall_legends_landscape.webp' },
      anvil: 'assets/environments/anvil.webp',
      pedestal: 'assets/environments/pedestal.webp'
    },
    tables: {
      iron: { name: 'Forged Iron', src: 'assets/environments/table_iron.webp' },
      ember: { name: 'Ember Slate', src: 'assets/environments/table_ember.webp' },
      obsidian: { name: 'Obsidian', src: 'assets/environments/table_obsidian.webp' }
    },
    backs: {
      spade: { name: 'Obsidian Spade', src: 'assets/cards/backs/spade.webp', hi: 'assets/cards/backs/spade@2x.webp' },
      heart: { name: 'Crimson Heart', src: 'assets/cards/backs/heart.webp', hi: 'assets/cards/backs/heart@2x.webp' },
      diamond: { name: 'Ivory Diamond', src: 'assets/cards/backs/diamond.webp', hi: 'assets/cards/backs/diamond@2x.webp' },
      club: { name: 'Gilded Club', src: 'assets/cards/backs/club.webp', hi: 'assets/cards/backs/club@2x.webp' }
    },
    effects: { smoke: 'assets/effects/smoke.webp' },
    ui: { metal: 'assets/ui/borders/metal_tile.webp' },
    /* Optional raster tier art. Leave empty to use the built-in forged SVG art.
       Example: artifacts: { sword: { 3: 'assets/artifacts/sword/masterwork.webp' } } */
    artifacts: {}
  };

  M.card = function (rank, suit, hi) {
    const r = RANK_FILE[rank] || String(rank).padStart(2, '0');
    const two = hi && RANK_FILE[rank] ? '@2x' : '';
    return `assets/cards/${SUIT_DIR[suit]}/${r}${two}.webp`;
  };
  M.back = function (key, hi) { const b = M.backs[key] || M.backs.spade; return hi ? b.hi : b.src; };
  M.envSrc = function (key, landscape) {
    const e = M.env[key]; if (typeof e === 'string') return e;
    const land = landscape != null ? landscape : root.innerWidth > root.innerHeight * 1.1;
    return land ? e.landscape : e.portrait;
  };
  M.abs = function (path) { try { return new URL(path, document.baseURI).href; } catch (e) { return path; } };
  M.artifactImage = function (id, tier) { return (M.artifacts[id] && M.artifacts[id][tier]) || null; };

  /* ---------- preloading -------------------------------------------------- */
  const cache = new Map();
  M.preload = function (urls) {
    return Promise.all(urls.filter(Boolean).map(u => {
      if (cache.has(u)) return cache.get(u);
      const p = new Promise(res => { const i = new Image(); i.decoding = 'async'; i.onload = i.onerror = () => res(u); i.src = u; });
      cache.set(u, p); return p;
    }));
  };
  M.suitSet = function (suits) { return ['S', 'H', 'D', 'C'].slice(0, suits); };
  M.cardUrls = function (suits) {
    const out = [];
    M.suitSet(suits).forEach(s => { for (let r = 1; r <= 13; r++) out.push(M.card(r, s)); });
    return out;
  };
  ES.Manifest = M;
})(typeof window !== 'undefined' ? window : globalThis);
