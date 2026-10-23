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

  // Save boundaries are deliberately separate from engine rules and reward accounting.
  const RECOVERY_PREFIX = KEY + '.recovery.';
  const BACKUP_KEY = KEY + '.backup';
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const number = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER;
  const integer = v => number(v) && Number.isSafeInteger(v);
  const boolean = v => typeof v === 'boolean';
  const text = v => typeof v === 'string' && v.length <= 200;
  const dateKey = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  const artifact = v => ES.Artifacts.LIST.some(a => a.id === v);
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const clone = v => JSON.parse(JSON.stringify(v));

  const HAND_ID = /^h-[0-9a-z]+-[0-9a-z]+-[0-9a-f]{32}$/;
  let handSerial = 0;
  function newHandId() {
    const words = new Uint32Array(4);
    if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(words);
    else for (let i = 0; i < words.length; i++) words[i] = Math.floor(Math.random() * 0x100000000);
    return 'h-' + Date.now().toString(36) + '-' + (++handSerial).toString(36) + '-' + [...words].map(n => n.toString(16).padStart(8, '0')).join('');
  }
  function prepareHand(game) {
    if (game && !own(game, 'settlement')) {
      // Older saves have no receipt. Reaching eight sets already means a legacy
      // victory may have been paid, including hands subsequently undone.
      game.settlement = { v: 1, handId: newHandId(), victoryPaid: game.bestCompleted === 8 || game.won === true };
    }
  }

  function validateHand(g) {
    const fail = () => { throw Error('Invalid or inconsistent saved hand'); };
    if (!object(g) || ![1, 2, 4].includes(g.suits)) fail();
    const deck = new Map(ES.Engine.newDeck(g.suits, () => 0).map(c => [c.id, c]));
    function position(p) {
      if (!object(p) || !Array.isArray(p.cols) || p.cols.length !== 10 || !Array.isArray(p.stock) || p.stock.length > 50 || p.stock.length % 10 || !integer(p.completed) || p.completed > 8 || !integer(p.moves)) fail();
      const ids = new Set(), counts = {};
      function card(c, stock) {
        if (!object(c) || !boolean(c.up)) fail();
        const expected = deck.get(c.id);
        if (!expected || expected.rank !== c.rank || expected.suit !== c.suit || ids.has(c.id) || (stock && c.up)) fail();
        ids.add(c.id);
        const key = c.suit + c.rank; counts[key] = (counts[key] || 0) + 1;
      }
      for (const col of p.cols) {
        if (!Array.isArray(col) || col.length > 104) fail();
        let faceUp = false;
        for (const c of col) { card(c, false); if (faceUp && !c.up) fail(); faceUp = faceUp || c.up; }
        if (col.length && !col[col.length - 1].up) fail();
      }
      p.stock.forEach(c => card(c, true));
      if (ids.size + p.completed * 13 !== 104) fail();
      let removed = 0;
      for (const suit of ['S', 'H', 'D', 'C'].slice(0, g.suits)) {
        const missing = 8 / g.suits - (counts[suit + '1'] || 0);
        if (missing < 0) fail();
        for (let rank = 1; rank <= 13; rank++) if (8 / g.suits - (counts[suit + rank] || 0) !== missing) fail();
        removed += missing;
      }
      if (removed !== p.completed) fail();
      return new Map([...p.cols.flat(), ...p.stock].map(c => [c.id, c.up]));
    }
    position(g);
    if (own(g, 'settlement')) {
      const receipt = g.settlement;
      if (!object(receipt) || receipt.v !== 1 || typeof receipt.handId !== 'string' || !HAND_ID.test(receipt.handId) || !boolean(receipt.victoryPaid) || Object.keys(receipt).some(k => !['v', 'handId', 'victoryPaid'].includes(k))) fail();
      if (receipt.victoryPaid !== (g.bestCompleted === 8)) fail();
    }
    for (const key of ['cardsMoved', 'hintsUsed', 'undosUsed', 'startedAt']) if (!integer(g[key])) fail();
    if (!number(g.elapsed) || !integer(g.bestCompleted) || g.bestCompleted < g.completed || g.bestCompleted > 8 || !boolean(g.won) || g.won !== (g.completed === 8) || !boolean(g.daily)) fail();
    if (g.seed !== null && (!integer(g.seed) || g.seed > 0xffffffff)) fail();
    if (g.daily ? !dateKey(g.dailyKey) : g.dailyKey !== null) fail();
    if (own(g, 'run') && !integer(g.run)) fail();
    if (own(g, 'tutorial') && !boolean(g.tutorial)) fail();
    if (!Array.isArray(g.history) || g.history.length > 60 || g.history.length > g.moves) fail();
    let previous = null, previousCards = null;
    for (const p of [...g.history, g]) {
      const cards = position(p);
      if (previousCards) for (const [id, up] of cards) if (!previousCards.has(id) || (previousCards.get(id) && !up)) fail();
      previousCards = cards;
      if (p.completed > g.bestCompleted) fail();
      if (previous && (p.moves !== previous.moves + 1 || p.completed < previous.completed || p.stock.length > previous.stock.length || previous.stock.length - p.stock.length > 10)) fail();
      previous = p;
    }
    if (own(g, 'initial')) {
      position(Object.assign({}, g.initial, { completed: 0, moves: 0 }));
      if (g.initial.stock.length !== 50 || g.initial.cols.some((c, i) => c.length !== (i < 4 ? 6 : 5) || c.some((x, n) => x.up !== (n === c.length - 1)))) fail();
    }
    return true;
  }

  // Missing optional v2 fields retain the historic defaults. Invalid fields are
  // never coerced/clamped into invented earnings; recovery requires consent.
  function validateProfile(data) {
    if (!object(data) || data.v !== 2) throw Error('Unsupported save version');
    const result = fresh(), issues = [];
    const issue = p => issues.push(p);
    function fields(input, output, spec, path) {
      if (!object(input)) { issue(path); return; }
      for (const [k, check] of Object.entries(spec)) if (own(input, k)) {
        if (check(input[k])) output[k] = clone(input[k]); else issue(path + '.' + k);
      }
    }
    fields(data, result, { embers: integer, totalEmber: integer, forgeLevel: v => integer(v) && v >= 1, reserve: integer, artifact, firstArtifact: v => v === null || artifact(v), savedAt: integer }, 'profile');
    for (const key of ['stats', 'settings', 'ftue', 'ads']) {
      if (!own(data, key)) continue;
      const spec = {};
      for (const [k, value] of Object.entries(result[key])) {
        if (k === 'bySuits') continue;
        spec[k] = typeof value === 'boolean' ? boolean : typeof value === 'string' ? text : value === null ? v => v === null || number(v) : (k === 'playMs' ? number : integer);
      }
      if (key === 'stats') spec.lowestMoves = v => v === null || integer(v);
      if (key === 'settings') Object.assign(spec, { music: v => number(v) && v <= 1, sfx: v => number(v) && v <= 1, cardBack: v => own(ES.Manifest.backs, v), table: v => own(ES.Manifest.tables, v) });
      fields(data[key], result[key], spec, key);
      if (key === 'stats' && object(data.stats) && own(data.stats, 'bySuits')) {
        if (!object(data.stats.bySuits)) issue('stats.bySuits');
        else for (const k of [1, 2, 4]) if (own(data.stats.bySuits, k)) fields(data.stats.bySuits[k], result.stats.bySuits[k], { games: integer, wins: integer }, 'stats.bySuits.' + k);
      }
    }
    const maps = {
      progress: { key: artifact, spec: { tier: v => integer(v) && v <= 6, heat: integer, started: integer, ember: integer, victories: integer } },
      completed: { key: artifact, spec: { name: text, date: integer, victories: integer, ember: integer, forgingMs: number } },
      daily: { key: dateKey, spec: { sets: v => integer(v) && v <= 8, rewarded: boolean, perfect: boolean } }
    };
    for (const [key, rule] of Object.entries(maps)) if (own(data, key)) {
      if (!object(data[key])) { issue(key); continue; }
      for (const [id, value] of Object.entries(data[key])) {
        // Progress/records are atomic: partial records cannot drive forge UI.
        const required = Object.keys(rule.spec).filter(k => key !== 'daily' || k !== 'perfect');
        if (!rule.key(id) || !object(value) || required.some(k => !own(value, k)) || Object.entries(rule.spec).some(([k, check]) => own(value, k) && !check(value[k]))) { issue(key + '.' + id); continue; }
        result[key][id] = Object.fromEntries(Object.keys(rule.spec).filter(k => own(value, k)).map(k => [k, value[k]]));
      }
    }
    if (own(data, 'seen')) {
      if (!object(data.seen)) issue('seen');
      else for (const [k, v] of Object.entries(data.seen)) {
        const parts = k.split(':');
        if (artifact(parts[0]) && /^[1-6]$/.test(parts[1]) && parts.length === 2 && boolean(v)) result.seen[k] = v; else issue('seen.' + k);
      }
    }
    if (!result.firstArtifact && Object.keys(result.progress).length) result.firstArtifact = Object.keys(result.completed)[0] || result.artifact;
    if (own(data, 'game') && data.game !== null) {
      try { validateHand(data.game); result.game = clone(data.game); }
      catch (e) { issue('game'); }
    }
    return { profile: result, issues };
  }

  let S = fresh(), saveT = null, originalRaw = null, lastGoodRaw = null;
  let blocked = true, recoverable = false, recoveryKey = null;
  const listeners = new Set();
  let persistence = { code: 'ready', unsaved: false, message: '', blocked: false };
  function status(code, message, unsaved = true) {
    persistence = { code, message, unsaved, blocked, recoveryKey };
    emit({ type: 'persistence', status: Object.assign({}, persistence) });
  }
  function storage() {
    const store = root.localStorage;
    if (!store || typeof store.getItem !== 'function' || typeof store.setItem !== 'function') throw Error('Storage unavailable');
    return store;
  }
  function quarantine(raw) {
    if (raw === null) return null;
    const store = storage();
    let suffix = 0, key;
    do { key = RECOVERY_PREFIX + Date.now() + '.' + suffix++; } while (store.getItem(key) !== null);
    store.setItem(key, raw);
    if (store.getItem(key) !== raw) throw Error('Recovery copy could not be verified');
    return key;
  }
  function load() {
    clearTimeout(saveT);
    emit({ type: 'beforeGameChange' });
    S = fresh(); blocked = true; recoverable = false; recoveryKey = null; originalRaw = null; lastGoodRaw = null;
    try {
      originalRaw = storage().getItem(KEY);
      if (originalRaw === null) { blocked = false; status('ready', '', false); }
      else {
        let checked;
        try { checked = validateProfile(JSON.parse(originalRaw)); }
        catch (e) {
          try { recoveryKey = quarantine(originalRaw); } catch (copyError) { /* original remains protected */ }
          status('protected', 'Save could not be loaded or uses an unsupported version. Original save protected. Export it before recovery.');
        }
        if (checked) {
          if (checked.issues.length) {
            try { recoveryKey = quarantine(originalRaw); } catch (copyError) { /* replacement stays blocked */ }
            S = checked.profile; recoverable = true;
            status('recovery', 'Save needs recovery. Valid progress is available; the damaged hand or fields were excluded. Export the original and review Save Recovery.');
          } else {
            S = checked.profile; lastGoodRaw = originalRaw; blocked = false;
            status('saved', '', false);
          }
        }
      }
    } catch (e) { status('unavailable', 'Saved progress cannot be read. Saving is blocked to protect it. Export this session before leaving.'); }
    prepareHand(S.game);
    ensureProgress(S.artifact);
    return S;
  }
  function snapshot() {
    emit({ type: 'beforeSnapshot' });
    const copy = Object.assign({}, S, { savedAt: Date.now() });
    if (S.game) copy.game = Object.assign({}, S.game, { history: S.game.history.slice(-20) });
    return copy;
  }
  function writeProfile(profile) {
    const checked = validateProfile(profile);
    if (checked.issues.length) throw Error('Current progress failed validation: ' + checked.issues.join(', '));
    const json = JSON.stringify(profile), store = storage();
    // Fail closed if the prior valid save cannot be backed up. Never clear data
    // to free quota, and never mark a failed write as saved.
    if (lastGoodRaw !== null) store.setItem(BACKUP_KEY, lastGoodRaw);
    store.setItem(KEY, json);
    lastGoodRaw = json;
    S.savedAt = profile.savedAt;
    status('saved', '', false);
    // Optional native mirror is not the web durability acknowledgement.
    try { if (ES.Platform) ES.Platform.persist(KEY, json); } catch (e) { /* local write succeeded */ }
    return true;
  }
  function save(now) {
    if (victoryInProgress) return true; // The complete settlement is flushed together.
    clearTimeout(saveT);
    if (blocked) { status(persistence.code, persistence.message); return false; }
    const run = () => {
      try { return writeProfile(snapshot()); }
      catch (e) { status('unsaved', 'Progress is not saved. Storage may be full or unavailable, or progress failed validation. Retry or export before leaving.'); return false; }
    };
    if (now) return run();
    if (persistence.code !== 'unsaved') status('pending', 'Saving progress…');
    saveT = setTimeout(run, 250);
    return true;
  }
  function acceptRecovery() {
    if (!recoverable || originalRaw === null) return false;
    try {
      if (!recoveryKey) recoveryKey = quarantine(originalRaw);
      const profile = snapshot(), checked = validateProfile(profile);
      if (checked.issues.length) throw Error('Recovery is invalid');
      const store = storage(), json = JSON.stringify(profile);
      store.setItem(KEY, json);
      blocked = false; recoverable = false; lastGoodRaw = json; S.savedAt = profile.savedAt;
      status('saved', 'Recovered progress saved. Original recovery copy retained.', false);
      return true;
    } catch (e) { status('recovery', 'Recovery could not be saved. The original is still protected. Export before leaving.'); return false; }
  }
  function exportSave() {
    const profile = snapshot(), checked = validateProfile(profile);
    if (checked.issues.length) throw Error('Current progress is invalid; export the original recovery copy instead.');
    return JSON.stringify(profile, null, 2);
  }
  function exportOriginal() { return originalRaw; }
  function exportBackup() { return storage().getItem(BACKUP_KEY); }
  function recoveryCopies() {
    const store = storage(), keys = [];
    for (let i = 0; i < store.length; i++) { const key = store.key(i); if (key && key.startsWith(RECOVERY_PREFIX)) keys.push(key); }
    return keys.sort().reverse();
  }
  function exportRecovery(key) {
    if (typeof key !== 'string' || !key.startsWith(RECOVERY_PREFIX)) throw Error('Invalid recovery key');
    return storage().getItem(key);
  }
  function inspectImport(raw) {
    const checked = validateProfile(JSON.parse(raw));
    if (checked.issues.length) throw Error('Invalid save: ' + checked.issues.join(', '));
    prepareHand(checked.profile.game);
    return checked.profile;
  }
  // Called only after explicit replacement confirmation. Both current memory and
  // stored original are archived first; a failed step leaves active state intact.
  function importSave(raw) {
    clearTimeout(saveT);
    try {
      const next = inspectImport(raw), store = storage();
      const existing = store.getItem(KEY);
      quarantine(existing);
      quarantine(JSON.stringify(snapshot()));
      const json = JSON.stringify(next);
      store.setItem(KEY, json);
      emit({ type: 'beforeGameChange' });
      S = next; ensureProgress(S.artifact); originalRaw = existing;
      blocked = false; recoverable = false; lastGoodRaw = json;
      status('saved', 'Imported save. Previous progress retained in recovery storage.', false);
      emit({ type: 'import' });
      return true;
    } catch (e) { status(blocked ? persistence.code : 'unsaved', 'Import failed. Current progress was kept. Check the file or export before leaving.'); return false; }
  }
  function reset() {
    clearTimeout(saveT);
    if (blocked) { status(persistence.code, 'Reset blocked while a save needs recovery. Export and resolve recovery first.'); return false; }
    try {
      const store = storage();
      quarantine(store.getItem(KEY));
      quarantine(JSON.stringify(snapshot()));
      const next = fresh();
      next.progress[next.artifact] = { tier: 0, heat: 0, started: Date.now(), ember: 0, victories: 0 };
      store.setItem(KEY, JSON.stringify(next));
      emit({ type: 'beforeGameChange' });
      S = next; lastGoodRaw = JSON.stringify(next); status('saved', '', false); emit({ type: 'reset' });
      return true;
    } catch (e) { status('unsaved', 'Reset could not be saved. Existing progress was kept. Export before leaving.'); return false; }
  }

  let victoryInProgress = false;
  let victoryNotifications = [];
  function notify(fn) {
    if (victoryInProgress) victoryNotifications.push(fn);
    else fn();
  }
  function emit(evt) {
    if (victoryInProgress) { victoryNotifications.push(() => emit(evt)); return; }
    listeners.forEach(fn => { try { fn(evt); } catch (e) { console.error(e); } }); }
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
    notify(() => { ES.Analytics && ES.Analytics.log('ember_earned', { source: reason || 'other', amount: n }); });
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
    if (game === S.game) return;
    prepareHand(game);
    emit({ type: 'beforeGameChange' });
    const prev = S.game;
    if (prev && !prev.won && prev.moves > 0) { S.stats.streak = 0; }
    S.game = game;
    S.stats.games++;
    S.stats.bySuits[game.suits] = S.stats.bySuits[game.suits] || { games: 0, wins: 0 };
    S.stats.bySuits[game.suits].games++;
    save(true);
  }
  function abandonGame() {
    emit({ type: 'beforeGameChange' });
    if (S.game && !S.game.won && S.game.moves > 0) S.stats.streak = 0;
    S.game = null; save(true);
  }
  /* Apply progression for an engine result. Returns {ember, daily, win} */
  function applyResult(g, res) {
    const out = { ember: 0 };
    if (!res || !res.ok || g !== S.game || victoryInProgress) return out;
    prepareHand(g);
    const winning = !!res.won;
    if (winning && (!g.won || g.completed !== 8 || g.settlement.victoryPaid)) return out;
    // Neither an undo snapshot nor a presentation callback owns this receipt.
    // Queue notifications/saves so reentrant listeners cannot persist half a win.
    const previous = winning ? clone(S) : null;
    if (winning) { victoryInProgress = true; g.settlement.victoryPaid = true; }
    try {
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
    } catch (error) {
      if (winning) {
        const oldGame = previous.game;
        for (const key of Object.keys(g)) if (!own(oldGame, key)) delete g[key];
        Object.assign(g, oldGame);
        Object.assign(S, previous, { game: g });
        victoryNotifications = [];
      }
      throw error;
    } finally { if (winning) victoryInProgress = false; }
    save(winning);
    if (winning) {
      const notifications = victoryNotifications; victoryNotifications = [];
      for (const fn of notifications) { try { fn(); } catch (error) { console.error(error); } }
    }
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
    get state() { return S; }, get canRecover() { return recoverable; }, get persistence() { return Object.assign({}, persistence); }, load, save, on, emit, today,
    validateHand, validateProfile, recoveryCopies, exportRecovery, acceptRecovery, exportSave, exportOriginal, exportBackup, inspectImport, importSave, RECOVERY_PREFIX, BACKUP_KEY,
    current, heatPct, ready, cost, costFor, pctFor, levelProgress, addEmber, strike, selectArtifact, artifactState,
    startGame, abandonGame, applyResult, tick, favoriteSuits, dailyFor, dailySeed,
    reset
  };
})(typeof window !== 'undefined' ? window : globalThis);
