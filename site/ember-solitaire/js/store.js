/* ==========================================================================
   EMBER SOLITAIRE — Profile, persistence and Forge progression
   Economy carried over from the prototype:
     • +10 Ember per completed sequence (paid once per set — see engine.bestCompleted)
     • Victory: 1 suit +75 · 2 suit +125 · 4 suit +225
     • Daily challenge bonus +150
     • Ember heats one tier at a time; overflow is held in reserve.
       Tier cost: 1,000 (Remote Config `tier_cost`). The player's FIRST artifact uses a
       shorter opening curve (`first_artifact_tier_costs`, default 400/600/800/1000/1000/1000)
       so the first strike lands in the first session.
     • Forge Level = 1 + floor(total Ember / 500)
   ========================================================================== */
(function (root) {
  'use strict';
  const ES = root.ES = root.ES || {};
  const KEY = 'ember.save.v2';
  const HEAT_PER_TIER = 1000;
  const LEVEL_EMBER = 500;
  const WIN_REWARD = { 1: 75, 2: 125, 4: 225 };
  const SET_REWARD = 10;
  const DAILY_REWARD = 150;
  const DAILY_GOAL_SETS = 3;
  const MODES = {
    1: { suits: 1, name: 'Relaxed', mult: '×1.0' },
    2: { suits: 2, name: 'Classic', mult: '×1.7' },
    4: { suits: 4, name: 'Expert', mult: '×3.0' }
  };

  function today(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function fresh() {
    return {
      v: 2,
      embers: 0, totalEmber: 0, forgeLevel: 1,
      artifact: 'sword',
      progress: {},                 // id → {tier, heat, started, ember, victories}
      reserve: 0,
      completed: {},                // id → {name, date, victories, ember, forgingMs}
      stats: {
        games: 0, wins: 0, sequences: 0, totalMoves: 0, cardsMoved: 0, playMs: 0,
        streak: 0, bestStreak: 0, lowestMoves: null, bestTimeMs: null,
        bySuits: { 1: { games: 0, wins: 0 }, 2: { games: 0, wins: 0 }, 4: { games: 0, wins: 0 } },
        dailies: 0, hints: 0, undos: 0
      },
      daily: {},                    // 'YYYY-MM-DD' → {sets, rewarded, perfect}
      seen: {},                     // ceremonies already watched (skippable afterwards)
      settings: { music: 0.5, sfx: 0.8, haptics: true, reduced: false, contrast: false, largeCards: false, oneTap: false, cardBack: 'spade', table: 'iron', language: 'en' },
      ftue: { splash: false, intro: false, tutorial: false },
      firstArtifact: null,
      ads: { day: '', rewardsToday: 0, lastInterstitialAt: 0, finishedSinceInterstitial: 0, finishedTotal: 0 },
      savedAt: 0,
      game: null
    };
  }

  let S = fresh();
  const listeners = new Set();

  function load() {
    try {
      const raw = root.localStorage && root.localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw), def = fresh();
        S = Object.assign(fresh(), d);
        S.stats = Object.assign(def.stats, d.stats || {});
        S.stats.bySuits = Object.assign(fresh().stats.bySuits, (d.stats || {}).bySuits || {});
        S.settings = Object.assign(def.settings, d.settings || {});
        S.ftue = Object.assign(def.ftue, d.ftue || {});
        ['progress', 'completed', 'daily', 'seen'].forEach(k => { if (!S[k] || typeof S[k] !== 'object') S[k] = {}; });
        S.ads = Object.assign(def.ads, d.ads || {});
        if (!S.firstArtifact && (d.progress && Object.keys(d.progress).length)) S.firstArtifact = Object.keys(S.completed)[0] || S.artifact;
        if (!ES.Manifest.backs[S.settings.cardBack]) S.settings.cardBack = 'spade';
        if (!ES.Manifest.tables[S.settings.table]) S.settings.table = 'iron';
      }
    } catch (e) { S = fresh(); }
    ensureProgress(S.artifact);
    return S;
  }
  let saveT = null;
  function save(now) {
    clearTimeout(saveT);
    const run = () => {
      try {
        S.savedAt = Date.now();
        const copy = Object.assign({}, S);
        if (S.game) { copy.game = Object.assign({}, S.game, { history: S.game.history.slice(-20) }); }
        const json = JSON.stringify(copy);
        root.localStorage && root.localStorage.setItem(KEY, json);
        ES.Platform && ES.Platform.persist(KEY, json);
      } catch (e) { /* storage unavailable: play continues in memory */ }
    };
    if (now) run(); else saveT = setTimeout(run, 250);
  }
  function emit(evt) { listeners.forEach(fn => { try { fn(evt); } catch (e) { console.error(e); } }); }
  function on(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  function ensureProgress(id) {
    if (!S.progress[id]) S.progress[id] = { tier: 0, heat: 0, started: Date.now(), ember: 0, victories: 0 };
    return S.progress[id];
  }
  function current() { return ensureProgress(S.artifact); }
  /* Ember needed to heat `id` from `tier` to the next tier. */
  function costFor(id, tier) {
    const C = ES.Config, base = C ? C.num('tier_cost') : HEAT_PER_TIER;
    if (S.firstArtifact === id && C) { const l = C.list('first_artifact_tier_costs'); if (l[tier]) return l[tier]; }
    return base || HEAT_PER_TIER;
  }
  function cost() { return costFor(S.artifact, current().tier); }
  function pctFor(id) { const p = S.progress[id]; if (!p) return 0; if (S.completed[id]) return 100; return Math.min(100, Math.round(p.heat / costFor(id, p.tier) * 100)); }
  function heatPct() { return pctFor(S.artifact); }
  function ready() { return current().heat >= cost(); }
  function levelProgress() { return (S.totalEmber % LEVEL_EMBER) / LEVEL_EMBER; }

  /* ---------- Ember ------------------------------------------------------- */
  function addEmber(n, reason) {
    if (!n) return;
    S.embers += n; S.totalEmber += n;
    if (!S.firstArtifact) S.firstArtifact = S.artifact;
    ES.Analytics && ES.Analytics.log('ember_earned', { source: reason || 'other', amount: n });
    const p = current();
    p.ember += n;
    let r = n; const need = cost();
    if (p.heat < need) { const use = Math.min(need - p.heat, r); p.heat += use; r -= use; }
    S.reserve += r;
    const before = S.forgeLevel;
    S.forgeLevel = 1 + Math.floor(S.totalEmber / LEVEL_EMBER);
    save();
    emit({ type: 'ember', amount: n, reason, levelUp: S.forgeLevel > before });
  }

  /* Strike the forge: advance one tier. Returns a description of what happened. */
  function strike() {
    const p = current(), def = ES.Artifacts.get(S.artifact);
    if (p.heat < cost()) return null;
    const from = p.tier;
    if (p.tier < 5) {
      p.tier++;
      const need = cost(), use = Math.min(need, S.reserve);
      p.heat = use; S.reserve -= use;
      save(true); emit({ type: 'tier' });
      return { kind: 'tier', id: def.id, from, to: p.tier };
    }
    // Mythic → Legendary: the work is complete and goes to the Hall.
    p.tier = 6;
    const rec = { name: def.name, date: Date.now(), victories: p.victories, ember: p.ember, forgingMs: Date.now() - (p.started || Date.now()) };
    S.completed[def.id] = rec;
    const count = Object.keys(S.completed).length;
    const next = ES.Artifacts.LIST.find(a => !S.completed[a.id] && a.unlock <= count);
    if (next) {
      S.artifact = next.id; const np = ensureProgress(next.id);
      const need = costFor(next.id, np.tier);
      if (np.heat < need && S.reserve) { const use = Math.min(need - np.heat, S.reserve); np.heat += use; S.reserve -= use; }
    }
    save(true); emit({ type: 'legendary' });
    return { kind: 'legendary', id: def.id, from, to: 6, record: rec, next: next && next.id };
  }

  function selectArtifact(id) {
    const def = ES.Artifacts.get(id), count = Object.keys(S.completed).length;
    if (S.completed[id] || def.unlock > count) return false;
    S.artifact = id; ensureProgress(id); if (!S.firstArtifact) S.firstArtifact = id; save(); emit({ type: 'artifact' });
    return true;
  }
  function artifactState(id) {
    const def = ES.Artifacts.get(id), count = Object.keys(S.completed).length;
    if (S.completed[id]) return { state: 'legendary', tier: 6 };
    if (def.unlock > count) return { state: 'locked', tier: 0, need: def.unlock };
    const p = S.progress[id];
    return { state: S.artifact === id ? 'current' : (p ? 'started' : 'available'), tier: p ? p.tier : 0, heat: p ? p.heat : 0 };
  }

  /* ---------- games -------------------------------------------------------- */
  function startGame(game) {
    const prev = S.game;
    if (prev && !prev.won && prev.moves > 0) { S.stats.streak = 0; }
    S.game = game;
    S.stats.games++;
    S.stats.bySuits[game.suits] = S.stats.bySuits[game.suits] || { games: 0, wins: 0 };
    S.stats.bySuits[game.suits].games++;
    save(true);
  }
  function abandonGame() {
    if (S.game && !S.game.won && S.game.moves > 0) S.stats.streak = 0;
    S.game = null; save(true);
  }
  /* Apply progression for an engine result. Returns {ember, daily, win} */
  function applyResult(g, res) {
    const out = { ember: 0 };
    if (!res || !res.ok) return out;
    if (res.type === 'move' || res.type === 'deal') { S.stats.totalMoves++; S.stats.cardsMoved += (res.moved ? res.moved.length : 10); }
    if (res.newSets) {
      S.stats.sequences += res.newSets;
      const e = res.newSets * SET_REWARD; out.ember += e; addEmber(e, 'sequence');
      g.run = (g.run || 0) + e;
      if (g.daily && g.dailyKey) {
        const d = S.daily[g.dailyKey] = S.daily[g.dailyKey] || { sets: 0, rewarded: false, perfect: false };
        d.sets = Math.max(d.sets, g.bestCompleted);
        if (!d.rewarded && d.sets >= DAILY_GOAL_SETS) {
          d.rewarded = true; S.stats.dailies++; out.daily = DAILY_REWARD;
          addEmber(DAILY_REWARD, 'daily'); g.run += DAILY_REWARD; out.ember += DAILY_REWARD;
        }
      }
    }
    if (res.won) {
      const reward = WIN_REWARD[g.suits] || 125;
      S.stats.wins++; S.stats.bySuits[g.suits].wins++;
      S.stats.streak++; S.stats.bestStreak = Math.max(S.stats.bestStreak, S.stats.streak);
      S.stats.lowestMoves = S.stats.lowestMoves == null ? g.moves : Math.min(S.stats.lowestMoves, g.moves);
      S.stats.bestTimeMs = S.stats.bestTimeMs == null ? g.elapsed : Math.min(S.stats.bestTimeMs, g.elapsed);
      current().victories++;
      if (g.daily && g.dailyKey) { const d = S.daily[g.dailyKey] = S.daily[g.dailyKey] || { sets: 8, rewarded: false }; d.perfect = true; }
      addEmber(reward, 'victory'); g.run = (g.run || 0) + reward;
      out.win = reward; out.ember += reward;
    }
    save();
    return out;
  }
  function tick(g, ms) { g.elapsed += ms; S.stats.playMs += ms; }

  function favoriteSuits() {
    const b = S.stats.bySuits; let best = 2, n = -1;
    [1, 2, 4].forEach(k => { if ((b[k] || {}).games > n) { n = b[k].games; best = k; } });
    return n > 0 ? best : null;
  }
  function dailyFor(key) { return S.daily[key] || null; }
  function dailySeed(key) { return ES.Engine.seedFrom('ember-daily-' + key); }

  ES.Store = {
    KEY, HEAT_PER_TIER, LEVEL_EMBER, WIN_REWARD, SET_REWARD, DAILY_REWARD, DAILY_GOAL_SETS, MODES,
    get state() { return S; }, load, save, on, emit, today,
    current, heatPct, ready, cost, costFor, pctFor, levelProgress, addEmber, strike, selectArtifact, artifactState,
    startGame, abandonGame, applyResult, tick, favoriteSuits, dailyFor, dailySeed,
    reset() { S = fresh(); ensureProgress(S.artifact); save(true); emit({ type: 'reset' }); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
