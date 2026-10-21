import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { harness, plain, card, position, finalSet } from './helpers.mjs';

for (const suits of [1, 2, 4]) {
  test(`${suits}-suit deck composition and initial deal`, () => {
    const { E } = harness(), deck = E.newDeck(suits, E.mulberry32(42));
    assert.equal(deck.length, 104); assert.equal(new Set(deck.map(c => c.id)).size, 104);
    assert.equal(new Set(deck.map(c => c.suit)).size, suits);
    for (const s of ['S', 'H', 'D', 'C'].slice(0, suits)) for (let rank = 1; rank <= 13; rank++) assert.equal(deck.filter(c => c.suit === s && c.rank === rank).length, 8 / suits);
    assert.ok(deck.every(c => !c.up));
    const g = E.newGame(suits, { seed: 42 });
    assert.deepEqual(plain(g.cols.map(c => c.length)), [6,6,6,6,5,5,5,5,5,5]);
    assert.ok(g.cols.every(c => c.every((x, i) => x.up === (i === c.length - 1))));
    assert.equal(g.stock.length, 50); assert.equal(E.stockDealsLeft(g), 5);
  });
  test(`${suits}-suit seeded deals are deterministic`, () => {
    const { E } = harness();
    const a = E.newGame(suits, { seed: E.seedFrom('ember-daily-2026-10-18'), daily: true, dailyKey: '2026-10-18' });
    assert.deepEqual(plain(a), plain(E.newGame(suits, { seed: E.seedFrom('ember-daily-2026-10-18'), daily: true, dailyKey: '2026-10-18' })));
    assert.notDeepEqual(plain(a.cols), plain(E.newGame(suits, { seed: 99 }).cols));
  });
  test(`${suits}-suit card conservation across legal play and undo`, () => {
    const { E } = harness(), g = E.newGame(suits, { seed: 917 });
    const removed = new Set();
    function conserved() {
      const cards = [...g.cols.flat(), ...g.stock];
      assert.equal(cards.length + g.completed * 13, 104);
      assert.equal(new Set(cards.map(c => c.id)).size, cards.length);
      for (const c of cards) assert.ok(!removed.has(c.id));
      assert.equal(removed.size, g.completed * 13);
    }
    for (let i = 0; i < 100; i++) {
      conserved(); const before = plain({ cols: g.cols, stock: g.stock, completed: g.completed, moves: g.moves });
      const h = E.hintBasic(g);
      const r = i % 5 === 0 && E.canDeal(g).ok ? E.deal(g) : h ? E.move(g, h.from, h.idx, h.to) : E.deal(g);
      if (!r.ok) break;
      const priorRemoved = new Set(removed);
      for (const set of r.completions) for (const c of set.cards) { assert.ok(!removed.has(c.id)); removed.add(c.id); }
      conserved();
      if (i % 7 === 0) {
        assert.equal(E.undo(g).ok, true); removed.clear(); for (const id of priorRemoved) removed.add(id);
        assert.deepEqual(plain({ cols: g.cols, stock: g.stock, completed: g.completed, moves: g.moves }), before);
      }
    }
    conserved();
  });
}

test('move legality, rejection without mutation, reveal and undo', () => {
  const { E } = harness(), g = position(E);
  g.cols[0] = [card('down', 10, 'H', false), card('nine', 9), card('eight', 8)];
  g.cols[1] = [card('ten', 10, 'H')]; g.cols[2] = [card('bad', 11)];
  assert.equal(E.movable(g.cols[0], 1), true);
  assert.equal(E.movable([card('a', 9), card('b', 8, 'H')], 0), false);
  assert.equal(E.movable([card('a', 9), card('b', 7)], 0), false);
  assert.equal(E.canMove(g, 0, 0, 1), false);
  assert.equal(E.canMove(g, 0, 1, 0), false);
  const before = plain(g); assert.equal(E.move(g, 0, 1, 2).ok, false); assert.deepEqual(plain(g), before);
  assert.equal(E.canMove(g, 0, 1, 3), true);
  const r = E.move(g, 0, 1, 1); assert.equal(r.ok, true); assert.equal(r.revealed, 'down');
  assert.deepEqual(plain(r.moved), ['nine','eight']); assert.equal(g.moves, 1); assert.equal(g.history.length, 1);
  assert.equal(E.undo(g).ok, true); assert.deepEqual(plain(g.cols), before.cols); assert.equal(g.moves, 0);
  assert.equal(E.undo(g).ok, false);
});

test('stock deals exactly ten, rejects gaps/empty stock and restores order on undo', () => {
  const { E } = harness(), g = E.newGame(2, { seed: 42 }), original = plain(g);
  const expected = plain(g.stock.slice(-10).reverse().map(c => c.id));
  assert.deepEqual(plain(E.deal(g).dealt), expected);
  assert.equal(g.stock.length, 40); assert.ok(g.cols.every(c => c.at(-1).up));
  E.undo(g); assert.deepEqual(plain(g.cols), original.cols); assert.deepEqual(plain(g.stock), original.stock);
  const saved = g.cols[0]; g.cols[0] = []; const gap = plain(g);
  assert.equal(E.deal(g).reason, 'gaps'); assert.deepEqual(plain(g), gap); g.cols[0] = saved;
  for (let i = 0; i < 5; i++) assert.equal(E.deal(g).ok, true);
  const empty = plain(g); assert.equal(E.stockDealsLeft(g), 0); assert.equal(E.deal(g).reason, 'empty'); assert.deepEqual(plain(g), empty);
});

test('history is capped at 60 independent snapshots', () => {
  const { E } = harness(), g = position(E); g.cols[0] = [card('a', 5)];
  for (let i = 0; i < 65; i++) assert.equal(E.move(g, i % 2, 0, 1 - i % 2).ok, true);
  assert.equal(g.history.length, 60); assert.equal(g.history[0].moves, 5);
  for (let i = 0; i < 60; i++) assert.equal(E.undo(g).ok, true);
  assert.equal(g.moves, 5); assert.equal(E.undo(g).ok, false);
});

test('completed K-A sequence is removed, underlying card revealed, high-water retained on undo', () => {
  const { E } = harness(), g = finalSet(E);
  g.cols[0].unshift(card('covered', 5, 'H', false));
  const r = E.move(g, 1, 0, 0);
  assert.equal(r.completions.length, 1); assert.equal(r.completions[0].cards.length, 13);
  assert.equal(r.completions[0].revealed, 'covered'); assert.equal(g.cols[0][0].up, true);
  assert.equal(r.newSets, 1); assert.equal(r.won, true); assert.equal(g.completed, 8);
  E.undo(g); assert.equal(g.completed, 7); assert.equal(g.bestCompleted, 8);
  assert.equal(E.move(g, 1, 0, 0).newSets, 0);
});

test('incomplete or mixed-suit sequences are retained', () => {
  const { E } = harness(), g = finalSet(E);
  assert.equal(E.checkSets(g).length, 0);
  g.cols[0].push(card('ace', 1, 'H')); assert.equal(E.checkSets(g).length, 0);
});

test('v2 profile fixture loads and preserves progress through save/load without modifying raw input', () => {
  const bytes = readFileSync(new URL('./fixtures/profile-v2.json', import.meta.url));
  const { E, S, storage } = harness(bytes.toString()); S.load();
  const initial = plain(S.state);
  const g = E.newGame(4, { seed: 123 }); E.deal(g); S.startGame(g); S.save(true);
  assert.equal(S.KEY, 'ember.save.v2');
  const next = harness(storage.get(S.KEY)); next.S.load();
  assert.deepEqual(plain(next.S.state.game), plain(g));
  for (const key of ['embers','totalEmber','progress','reserve','completed','daily','settings']) assert.deepEqual(plain(next.S.state[key]), initial[key]);
  assert.equal(next.E.undo(next.S.state.game).ok, true);
  assert.deepEqual(readFileSync(new URL('./fixtures/profile-v2.json', import.meta.url)), bytes);
});

test('save retains latest 20 history entries without trimming in-memory history', () => {
  const { E, S, storage } = harness(); S.load(); const g = E.newGame(1, { seed: 42 });
  const cards = g.cols.flat(); cards.forEach(c => { c.up = true; });
  g.cols = [[cards.shift()], [], cards, [], [], [], [], [], [], []];
  for (let i = 0; i < 30; i++) E.move(g, i % 2, 0, 1 - i % 2);
  S.startGame(g); assert.equal(g.history.length, 30);
  assert.equal(JSON.parse(storage.get(S.KEY)).game.history.length, 20);
});

test('frozen v2 active-hand fixture resumes with stock, history and daily metadata intact', () => {
  const path = new URL('./fixtures/hand-v2.json', import.meta.url), bytes = readFileSync(path);
  const { E, S, storage } = harness(bytes.toString()); S.load();
  const original = JSON.parse(bytes); assert.deepEqual(plain(S.state), original);
  assert.equal(S.state.game.cols.flat().length + S.state.game.stock.length, 104);
  assert.equal(S.state.game.dailyKey, '2026-10-18');
  S.save(true); const reload = harness(storage.get(S.KEY)); reload.S.load();
  assert.deepEqual(plain(reload.S.state), original);
  assert.equal(E.undo(reload.S.state.game).ok, true);
  assert.equal(reload.S.state.game.stock.length, 50); assert.equal(reload.S.state.game.moves, 0);
  assert.deepEqual(readFileSync(path), bytes);
});
