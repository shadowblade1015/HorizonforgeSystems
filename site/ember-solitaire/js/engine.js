/* ==========================================================================
   EMBER SOLITAIRE — Spider Solitaire engine
   Pure game logic. No DOM, no rendering, no progression.
   Rules are carried over verbatim from the validated prototype
   (movable / valid / move / deal / checkSets / undo). See docs/REFACTORS.md.
   ========================================================================== */
(function (root) {
  'use strict';

  const SUITS = ['S', 'H', 'D', 'C'];              // spades, hearts, diamonds, clubs
  const SUIT_GLYPH = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const SUIT_NAME = { S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' };
  const RED = { H: true, D: true };
  const RANK_LABEL = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  const RANK_NAME = { 1: 'Ace', 11: 'Jack', 12: 'Queen', 13: 'King' };
  const HISTORY_LIMIT = 60;                        // prototype kept 60 undo steps

  /* ---------- deterministic RNG (used for daily deals; Math.random otherwise) */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seedFrom(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* ---------- deck ---------------------------------------------------------
     1 suit: 8 × spades · 2 suits: 4 × spades + 4 × hearts · 4 suits: 2 × each.
     Same composition as prototype deckFor(): symbols.slice(0,suits), 8/suits reps. */
  function newDeck(suits, rng) {
    rng = rng || Math.random;
    const order = ['S', 'H', 'D', 'C'].slice(0, suits);
    const deck = [];
    let n = 0;
    order.forEach(s => {
      for (let rep = 0; rep < 8 / suits; rep++)
        for (let r = 1; r <= 13; r++) deck.push({ id: 'c' + (n++).toString(36), rank: r, suit: s, up: false });
    });
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  function newGame(suits, opts) {
    opts = opts || {};
    const rng = opts.seed != null ? mulberry32(opts.seed) : (opts.rng || Math.random);
    const d = newDeck(suits, rng);
    const cols = Array.from({ length: 10 }, () => []);
    // Deal: first four columns get 6, the rest 5; only the last card is face up.
    for (let c = 0; c < 10; c++) {
      const count = c < 4 ? 6 : 5;
      for (let i = 0; i < count; i++) { const card = d.pop(); card.up = i === count - 1; cols[c].push(card); }
    }
    return {
      suits, daily: !!opts.daily, dailyKey: opts.dailyKey || null, seed: opts.seed != null ? opts.seed : null,
      cols, stock: d, completed: 0, moves: 0,
      history: [],
      // presentation / progression bookkeeping (not rules)
      bestCompleted: 0,        // high-water mark: rewards are paid once per set, undo cannot re-farm them
      cardsMoved: 0, elapsed: 0, hintsUsed: 0, undosUsed: 0, won: false,
      startedAt: Date.now()
    };
  }

  /* ---------- rules (verbatim semantics) ---------------------------------- */
  // A run may be lifted from idx if every card is face up, same suit, descending by one.
  function movable(col, idx) {
    const x = col.slice(idx);
    if (!x.length || !x[0].up) return false;
    for (let i = 0; i < x.length - 1; i++)
      if (x[i].rank !== x[i + 1].rank + 1 || x[i].suit !== x[i + 1].suit) return false;
    return true;
  }
  // Destination: any empty column, or a face-up card exactly one rank higher (any suit).
  function canMove(g, sc, idx, dc) {
    const s = g.cols[sc], d = g.cols[dc];
    if (sc === dc || !s || !d || !movable(s, idx)) return false;
    if (!d.length) return true;
    const t = d[d.length - 1], m = s[idx];
    return t.up && t.rank === m.rank + 1;
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function snapshot(g) {
    g.history.push(clone({ cols: g.cols, stock: g.stock, completed: g.completed, moves: g.moves }));
    if (g.history.length > HISTORY_LIMIT) g.history.shift();
  }

  // Remove every completed K→A same-suit run from the bottom of any column.
  function checkSets(g) {
    const completions = [];
    for (let c = 0; c < 10; c++) {
      const col = g.cols[c];
      if (col.length < 13) continue;
      const tail = col.slice(-13);
      let ok = tail[0].rank === 13 && tail[12].rank === 1;
      for (let i = 0; i < 12 && ok; i++)
        if (!tail[i].up || tail[i].suit !== tail[i + 1].suit || tail[i].rank !== tail[i + 1].rank + 1) ok = false;
      if (ok) {
        const removed = col.splice(-13);
        let revealed = null;
        if (col.length && !col[col.length - 1].up) { col[col.length - 1].up = true; revealed = col[col.length - 1].id; }
        g.completed++;
        completions.push({ col: c, cards: removed, revealed });
        c = -1; // rescan, as in the prototype
      }
    }
    return completions;
  }

  function settle(g, result) {
    result.completions = checkSets(g);
    result.newSets = 0;
    if (g.completed > g.bestCompleted) { result.newSets = g.completed - g.bestCompleted; g.bestCompleted = g.completed; }
    if (g.completed >= 8 && !g.won) { g.won = true; result.won = true; }
    return result;
  }

  function move(g, sc, idx, dc) {
    if (!canMove(g, sc, idx, dc)) return { ok: false };
    snapshot(g);
    const moved = g.cols[sc].splice(idx);
    g.cols[dc].push(...moved);
    let revealed = null;
    const s = g.cols[sc];
    if (s.length && !s[s.length - 1].up) { s[s.length - 1].up = true; revealed = s[s.length - 1].id; }
    g.moves++;
    g.cardsMoved += moved.length;
    return settle(g, { ok: true, type: 'move', from: sc, to: dc, moved: moved.map(c => c.id), revealed });
  }

  function canDeal(g) {
    if (g.stock.length < 10) return { ok: false, reason: 'empty' };
    if (g.cols.some(c => !c.length)) return { ok: false, reason: 'gaps' };
    return { ok: true };
  }
  function deal(g) {
    const chk = canDeal(g);
    if (!chk.ok) return chk;
    snapshot(g);
    const dealt = [];
    for (let c = 0; c < 10; c++) { const x = g.stock.pop(); x.up = true; g.cols[c].push(x); dealt.push(x.id); }
    g.moves++;
    g.cardsMoved += 10;
    return settle(g, { ok: true, type: 'deal', dealt });
  }

  function undo(g) {
    if (!g.history.length) return { ok: false };
    const p = g.history.pop();
    g.cols = p.cols; g.stock = p.stock; g.completed = p.completed; g.moves = p.moves;
    g.won = false;
    return { ok: true, type: 'undo' };
  }

  /* ---------- hints ----------------------------------------------------------
     hintBasic(): the prototype's exact search (first legal move, column order).
     hints():     ranked list used by the UI. Same legality check (canMove), but
                  filters no-op shuffles and ranks moves that uncover cards or
                  build same-suit runs first. Rules are untouched.            */
  function hintBasic(g) {
    for (let s = 0; s < 10; s++)
      for (let i = 0; i < g.cols[s].length; i++)
        if (movable(g.cols[s], i))
          for (let d = 0; d < 10; d++) if (canMove(g, s, i, d)) return { from: s, idx: i, to: d };
    return null;
  }
  function hints(g) {
    const out = [];
    for (let s = 0; s < 10; s++) {
      const col = g.cols[s];
      for (let i = 0; i < col.length; i++) {
        if (!movable(col, i)) continue;
        const run = col[i], below = col[i - 1];
        for (let d = 0; d < 10; d++) {
          if (!canMove(g, s, i, d)) continue;
          const dest = g.cols[d], top = dest[dest.length - 1];
          let score = 0;
          const emptiesSource = i === 0;
          const revealsDown = below && !below.up;
          const alreadyHome = below && below.up && below.rank === run.rank + 1 && below.suit === run.suit;
          if (!dest.length) {
            if (emptiesSource) continue;                       // column → empty column: pointless
            score = revealsDown ? 40 : (alreadyHome ? -1 : 6);
          } else {
            const sameSuit = top.suit === run.suit;
            if (alreadyHome && !sameSuit) continue;              // breaks a built run for nothing
            if (alreadyHome && sameSuit) continue;               // identical position elsewhere
            if (revealsDown) score += 60;
            if (emptiesSource) score += 45;
            if (sameSuit) score += 30;
            if (below && below.up && !alreadyHome) score += 12;  // frees a card that may accept others
            score += (col.length - i);                            // longer runs first
          }
          if (score > 0) out.push({ from: s, idx: i, to: d, score });
        }
      }
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  }

  /* ---------- convenience (presentation aids; rules untouched) --------------
     All of these only ever propose moves that canMove() accepts.            */

  // Best destination for the run starting at (col, idx), or -1.
  // Prefers: same-suit build > any rank build > empty column (only if it uncovers something).
  function smartTarget(g, col, idx) {
    const src = g.cols[col]; if (!src || !movable(src, idx)) return -1;
    const run = src[idx], below = src[idx - 1];
    let best = -1, bestScore = -1;
    for (let d = 0; d < 10; d++) {
      if (!canMove(g, col, idx, d)) continue;
      const dest = g.cols[d], top = dest[dest.length - 1];
      let score;
      if (!dest.length) { if (idx === 0) continue; score = below && !below.up ? 20 : 5; }
      else score = top.suit === run.suit ? 100 : 50;
      score += (10 - Math.abs(d - col)) * 0.01;            // nearest wins ties
      if (score > bestScore) { bestScore = score; best = d; }
    }
    return best;
  }

  // lightweight state used by searches (no history, no ids needed beyond cards)
  function lite(g) { return { cols: g.cols.map(c => c.map(x => ({ id: x.id, rank: x.rank, suit: x.suit, up: x.up }))), stock: g.stock.slice(), completed: g.completed }; }
  function applyLite(s, from, idx, to) {
    const moved = s.cols[from].splice(idx); s.cols[to].push(...moved);
    const c = s.cols[from]; if (c.length && !c[c.length - 1].up) c[c.length - 1].up = true;
    checkSets(s);
  }
  function key(s) { return s.cols.map(c => c.map(x => x.rank + x.suit + (x.up ? '' : '_')).join('.')).sort().join('|') + '#' + s.completed; }
  function legalMoves(s) {
    const out = [];
    for (let f = 0; f < 10; f++) for (let i = 0; i < s.cols[f].length; i++) {
      if (!movable(s.cols[f], i)) continue;
      for (let t = 0; t < 10; t++) {
        if (!canMove(s, f, i, t)) continue;
        if (!s.cols[t].length && i === 0) continue;           // empty → empty is a no-op
        out.push([f, i, t]);
      }
    }
    return out;
  }
  function progress(s) {
    let down = 0, pairs = 0, empty = 0;
    s.cols.forEach(c => { if (!c.length) empty++; c.forEach((x, i) => { if (!x.up) down++; const n = c[i + 1]; if (n && x.up && n.up && n.suit === x.suit && n.rank === x.rank - 1) pairs++; }); });
    return { down, pairs, empty, completed: s.completed };
  }

  // Auto-complete: when the stock is empty and every card is face up, search for a
  // sequence of legal moves that forges every remaining set. Returns [{from,idx,to}] or null.
  function canAutoComplete(g) {
    if (g.stock.length) return false;
    return g.cols.every(c => c.every(x => x.up)) && g.completed < 8;
  }
  function solveEndgame(g, limit) {
    if (!canAutoComplete(g)) return null;
    limit = limit || 20000;
    const seen = new Set(); let nodes = 0;
    function dfs(s, path) {
      if (s.completed >= 8) return path;
      if (++nodes > limit) return null;
      const k = key(s); if (seen.has(k)) return null; seen.add(k);
      const ms = legalMoves(s).map(m => {
        const run = s.cols[m[0]][m[1]], dest = s.cols[m[2]], top = dest[dest.length - 1];
        let sc = 0;
        if (top && top.suit === run.suit) sc += 50 + (s.cols[m[0]].length - m[1]);
        if (!dest.length) sc -= 20;
        if (m[1] === 0) sc += 15;
        const below = s.cols[m[0]][m[1] - 1];
        if (below && below.suit === run.suit && below.rank === run.rank + 1) sc -= 60;  // breaking a built run
        return { m, sc };
      }).sort((a, b) => b.sc - a.sc);
      for (const { m } of ms) {
        const n = { cols: s.cols.map(c => c.slice()), stock: [], completed: s.completed };
        applyLite(n, m[0], m[1], m[2]);
        const r = dfs(n, path.concat([{ from: m[0], idx: m[1], to: m[2] }]));
        if (r) return r;
        if (nodes > limit) return null;
      }
      return null;
    }
    return dfs(lite(g), []);
  }

  // Dead end: no deal possible and no sequence of up to `depth` legal moves leads to
  // any progress (a reveal, a new empty column, a longer same-suit run, or a set).
  function isStuck(g, depth) {
    if (g.completed >= 8) return false;
    if (canDeal(g).ok) return false;
    depth = depth || 6;
    const base = progress(g), seen = new Set(); let nodes = 0;
    function better(p) { return p.completed > base.completed || p.down < base.down || p.empty > base.empty || p.pairs > base.pairs; }
    function search(s, d) {
      if (++nodes > 25000) return true;                        // budget exhausted: assume not stuck
      const k = key(s); if (seen.has(k)) return false; seen.add(k);
      for (const m of legalMoves(s)) {
        const n = { cols: s.cols.map(c => c.map(x => Object.assign({}, x))), stock: s.stock, completed: s.completed };
        applyLite(n, m[0], m[1], m[2]);
        if (better(progress(n))) return true;
        if (n.stock.length >= 10 && n.cols.every(c => c.length)) return true; // a move that enables a deal
        if (d > 1 && search(n, d - 1)) return true;
      }
      return false;
    }
    return !search(lite(g), depth);
  }

  /* ---------- helpers -------------------------------------------------------*/
  function rankLabel(r) { return RANK_LABEL[r] || String(r); }
  function cardLabel(c) { return rankLabel(c.rank) + SUIT_GLYPH[c.suit]; }
  function cardName(c) { return (RANK_NAME[c.rank] || c.rank) + ' of ' + SUIT_NAME[c.suit]; }
  function isRed(c) { return !!RED[c.suit]; }
  function findCard(g, id) {
    for (let c = 0; c < 10; c++) { const i = g.cols[c].findIndex(x => x.id === id); if (i >= 0) return { col: c, idx: i }; }
    return null;
  }
  function stockDealsLeft(g) { return Math.floor(g.stock.length / 10); }

  root.ES = root.ES || {};
  root.ES.Engine = {
    SUITS, SUIT_GLYPH, SUIT_NAME, HISTORY_LIMIT,
    mulberry32, seedFrom, newDeck, newGame,
    movable, canMove, move, canDeal, deal, undo, checkSets,
    hintBasic, hints, smartTarget, canAutoComplete, solveEndgame, isStuck,
    rankLabel, cardLabel, cardName, isRed, findCard, stockDealsLeft
  };
  if (typeof module !== 'undefined') module.exports = root.ES.Engine;
})(typeof window !== 'undefined' ? window : globalThis);
