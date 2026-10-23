import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { harness, plain } from './helpers.mjs';
const fixture = name => readFileSync(new URL('./fixtures/' + name + '.json', import.meta.url), 'utf8');
const profile = fixture('profile-v2'), hand = fixture('hand-v2');

for (const raw of ['{', '', 'null', '[]', '{"v":3,"embers":999}', '{"v":1,"embers":999}', '{"embers":999}']) {
  test('unreadable/unsupported save is quarantined and protected: ' + JSON.stringify(raw), () => {
    const { S, storage } = harness(raw); S.load();
    assert.equal(S.persistence.blocked, true); assert.equal(S.persistence.unsaved, true);
    assert.equal(S.exportOriginal(), raw);
    assert.equal(storage.get(S.persistence.recoveryKey), raw);
    S.state.ftue.splash = true;
    assert.equal(S.save(true), false); assert.equal(S.reset(), false); assert.equal(S.acceptRecovery(), false);
    assert.equal(storage.get(S.KEY), raw);
    assert.equal(S.inspectImport(S.exportSave()).v, 2);
  });
}

test('F01 recovery preserves all valid profile progress and needs explicit consent', () => {
  const data = JSON.parse(profile); data.game = { cols: [] }; const raw = JSON.stringify(data);
  const { S, storage } = harness(raw); S.load();
  assert.equal(S.state.game, null);
  for (const k of ['embers','totalEmber','forgeLevel','artifact','firstArtifact','progress','reserve','completed','daily']) assert.deepEqual(plain(S.state[k]), data[k]);
  assert.equal(S.state.stats.wins, 2); assert.equal(S.persistence.code, 'recovery');
  assert.equal(S.save(true), false); assert.equal(storage.get(S.KEY), raw);
  const key = S.persistence.recoveryKey;
  assert.equal(S.acceptRecovery(), true); assert.equal(storage.get(key), raw);
  const reload = harness(storage.get(S.KEY)); reload.S.load();
  assert.equal(reload.S.persistence.blocked, false); assert.equal(reload.S.state.embers, 321); assert.equal(reload.S.state.game, null);
});

const corruptions = {
  incomplete: g => g.cols[0].pop(),
  duplicate: g => { g.cols[0][0] = plain(g.cols[1][0]); },
  identity: g => { g.cols[0][0].rank = 1; },
  invalidSuit: g => { g.stock[0].suit = 'X'; },
  invalidRank: g => { g.stock[0].rank = 14; },
  missingColumn: g => g.cols.pop(),
  stockBatch: g => g.stock.pop(),
  faceUpStock: g => { g.stock[0].up = true; },
  faceDownSuffix: g => { g.cols[0].at(-1).up = false; },
  faceDownInsideRun: g => { g.cols[0][0].up = true; },
  historyMissing: g => { delete g.history; },
  historyDuplicate: g => { g.history[0].stock[0] = plain(g.history[0].cols[0][0]); },
  historyCount: g => { g.history[0].completed = 1; },
  historyMoves: g => { g.history[0].moves = g.moves; },
  historyHighWater: g => { g.bestCompleted = 9; },
  inconsistentWon: g => { g.won = true; },
  inconsistentCompleted: g => { g.completed = 1; },
  invalidMode: g => { g.suits = 3; },
  invalidDate: g => { g.dailyKey = '2026-02-30'; },
  invalidSeed: g => { g.seed = -1; },
  invalidTime: g => { g.elapsed = -1; },
  invalidInitial: g => { g.initial = { cols: g.cols, stock: g.stock }; }
};
for (const [name, corrupt] of Object.entries(corruptions)) test('saved hand rejects ' + name + ' while retaining currency', () => {
  const data = JSON.parse(hand); corrupt(data.game); const raw = JSON.stringify(data);
  const { S, storage } = harness(raw); S.load();
  assert.equal(S.state.game, null); assert.equal(S.state.embers, 321); assert.equal(S.state.stats.wins, 2);
  assert.equal(S.persistence.blocked, true); assert.equal(storage.get(S.KEY), raw);
  assert.throws(() => S.inspectImport(raw));
});

test('malformed profile fields recover independently without coercing valid siblings', () => {
  const data = JSON.parse(hand);
  Object.assign(data, { embers: -10, artifact: 'unknown', reserve: '17' });
  data.stats.wins = '2'; data.stats.bySuits['2'].games = -1;
  data.settings.music = 2; data.settings.cardBack = '__proto__';
  data.progress.shield = { tier: 7 }; data.completed.unknown = {};
  data.daily['2026-99-99'] = { sets: 100 }; data.seen = { '__proto__:1': true };
  const raw = JSON.stringify(data), { S, storage } = harness(raw); S.load();
  assert.equal(S.persistence.blocked, true);
  assert.equal(S.state.totalEmber, 1321); assert.equal(S.state.stats.games, 5);
  assert.equal(S.state.stats.wins, 0); assert.equal(S.state.embers, 0);
  assert.deepEqual(plain(S.state.progress.sword), data.progress.sword);
  assert.match(S.state.game.settlement.handId, /^h-[0-9a-z]+-[0-9a-z]+-[0-9a-f]{32}$/);
  assert.deepEqual(plain(S.state.game), { ...data.game, settlement: { v: 1, handId: S.state.game.settlement.handId, victoryPaid: false } });
  assert.equal(storage.get(S.persistence.recoveryKey), raw);
  assert.throws(() => S.inspectImport(raw));
});

test('valid v2 fixtures stay byte-unchanged through validation, export, save and reload', () => {
  for (const name of ['profile-v2', 'hand-v2']) {
    const bytes = fixture(name), data = JSON.parse(bytes), frozen = JSON.stringify(data);
    const { S } = harness(bytes); S.load();
    assert.deepEqual(plain(S.validateProfile(data).issues), []); assert.equal(JSON.stringify(data), frozen);
    assert.equal(S.persistence.blocked, false); assert.equal(S.save(true), true);
    const exported = S.exportSave(), reload = harness(exported); reload.S.load();
    assert.equal(reload.S.persistence.blocked, false);
    for (const k of ['embers','totalEmber','reserve','progress','completed','daily']) assert.deepEqual(plain(reload.S.state[k]), plain(S.state[k]));
    assert.equal(fixture(name), bytes);
  }
});

test('valid 1/2/4-suit hands, histories, tutorial/restart metadata and fractional timers round-trip', () => {
  for (const suits of [1, 2, 4]) {
    const { E, S } = harness(); S.load(); const g = E.newGame(suits, { seed: 53 });
    g.initial = plain({ cols: g.cols, stock: g.stock }); g.run = 0; g.tutorial = true;
    S.startGame(g);
    for (let i = 0; i < 40; i++) {
      const h = E.hintBasic(g); if (!h) break;
      E.move(g, h.from, h.idx, h.to); S.tick(g, 16.123); assert.equal(S.save(true), true);
      if (i % 5 === 0) { E.undo(g); assert.equal(S.save(true), true); }
    }
    const raw = S.exportSave(), reload = harness(raw); reload.S.load();
    assert.equal(reload.S.persistence.blocked, false); assert.deepEqual(plain(reload.S.state.game), JSON.parse(raw).game);
  }
});

for (const kind of ['writeError', 'readError', 'unavailable']) test('storage ' + kind + ' is visible and never resets stored progress', () => {
  const options = { [kind]: true }, { S, storage } = harness(profile, options);
  S.load(); const before = storage.get(S.KEY); S.state.embers = 500;
  assert.equal(S.save(true), false); assert.equal(S.persistence.unsaved, true);
  assert.equal(storage.get(S.KEY), before);
  assert.equal(JSON.parse(S.exportSave()).embers, 500);
  assert.equal(S.reset(), false); assert.equal(storage.get(S.KEY), before);
});

test('throwing localStorage getter cannot crash boot or permit overwriting unknown saved data', () => {
  const { S, context } = harness(profile);
  Object.defineProperty(context, 'localStorage', { get() { throw Error('Denied'); } });
  assert.doesNotThrow(() => S.load()); assert.equal(S.persistence.blocked, true);
  assert.equal(S.save(true), false); assert.equal(S.reset(), false);
});

test('quota during quarantine blocks recovery until an exact raw copy can be retained', () => {
  const data = JSON.parse(profile); data.game = {}; const raw = JSON.stringify(data);
  const options = { writeError: true }, { S, storage } = harness(raw, options); S.load();
  assert.equal(S.persistence.recoveryKey, null); assert.equal(S.acceptRecovery(), false);
  assert.equal(storage.get(S.KEY), raw); assert.equal(S.exportOriginal(), raw);
  options.writeError = false; assert.equal(S.acceptRecovery(), true);
  assert.equal(storage.get(S.persistence.recoveryKey), raw);
});

test('last-known-good backup retained, failed primary write leaves memory and savedAt intact, retry works', () => {
  const options = {}, { S, storage } = harness(profile, options); S.load();
  S.state.embers = 400; const timestamp = S.state.savedAt;
  options.failKey = key => key === S.KEY;
  assert.equal(S.save(true), false); assert.equal(S.state.savedAt, timestamp);
  assert.equal(storage.get(S.BACKUP_KEY), profile); assert.equal(storage.get(S.KEY), profile);
  assert.equal(S.persistence.unsaved, true); assert.equal(S.state.embers, 400);
  options.failKey = null; assert.equal(S.save(true), true);
  assert.equal(S.persistence.unsaved, false); assert.equal(JSON.parse(storage.get(S.KEY)).embers, 400);
  assert.equal(S.exportBackup(), profile);
});

test('failure to back up prevents primary replacement', () => {
  const { S, storage } = harness(profile, { failKey: k => k.endsWith('.backup') }); S.load();
  S.state.embers = 500; assert.equal(S.save(true), false); assert.equal(storage.get(S.KEY), profile);
});

test('recovery keys never overwrite earlier originals, including after reload', () => {
  const { S, storage } = harness('{'); S.load(); const key = S.persistence.recoveryKey;
  S.load(); assert.notEqual(S.persistence.recoveryKey, key);
  assert.equal(storage.get(key), '{'); assert.equal(S.recoveryCopies().length, 2);
  assert.equal(S.exportRecovery(key), '{'); assert.throws(() => S.exportRecovery(S.KEY));
});

test('validated import retains prior stored and unsaved progress; rejected input is read-only', () => {
  const { S, storage } = harness(profile); S.load(); S.state.embers = 555;
  const before = JSON.stringify(plain(S.state));
  for (const raw of ['{', '{"v":3}', JSON.stringify({ v: 2, embers: -1 })]) {
    assert.equal(S.importSave(raw), false); assert.equal(JSON.stringify(plain(S.state)), before); assert.equal(storage.get(S.KEY), profile);
  }
  assert.equal(S.importSave(hand), true);
  assert.match(S.state.game.settlement.handId, /^h-[0-9a-z]+-[0-9a-z]+-[0-9a-f]{32}$/);
  assert.deepEqual(plain(S.state.game), { ...JSON.parse(hand).game, settlement: { v: 1, handId: S.state.game.settlement.handId, victoryPaid: false } });
  const copies = S.recoveryCopies().map(k => S.exportRecovery(k));
  assert.ok(copies.includes(profile)); assert.ok(copies.some(raw => JSON.parse(raw).embers === 555));
});

test('failed import or reset leaves stored and in-memory progress intact', () => {
  const options = { failKey: key => key === 'ember.save.v2' }, { S, storage } = harness(profile, options); S.load();
  const before = plain(S.state); assert.equal(S.importSave(hand), false); assert.deepEqual(plain(S.state), before);
  assert.equal(S.reset(), false); assert.deepEqual(plain(S.state), before); assert.equal(storage.get(S.KEY), profile);
});

test('explicit reset retains both saved and unsaved progress in recovery storage', () => {
  const { S } = harness(profile); S.load(); S.state.embers = 777;
  assert.equal(S.reset(), true); assert.equal(S.state.embers, 0);
  const copies = S.recoveryCopies().map(k => S.exportRecovery(k));
  assert.ok(copies.includes(profile)); assert.ok(copies.some(raw => JSON.parse(raw).embers === 777));
});

test('invalid live state cannot replace last good save', () => {
  const { S, storage } = harness(hand); S.load(); S.state.game.stock[0] = plain(S.state.game.stock[1]);
  assert.equal(S.save(true), false); assert.equal(storage.get(S.KEY), hand); assert.equal(S.persistence.unsaved, true);
});

test('persistence events expose pending, failed and successful saves', () => {
  const options = {}, { S } = harness(profile, options), states = [];
  S.on(e => { if (e.type === 'persistence') states.push(e.status.code); }); S.load();
  S.save(); options.writeError = true; S.save(true); options.writeError = false; S.save(true);
  assert.deepEqual(states, ['saved', 'pending', 'unsaved', 'saved']);
});

test('serialization failures do not alter the last durable save or its timestamp', () => {
  const { S, storage } = harness(profile); S.load(); const timestamp = S.state.savedAt;
  S.state.unserializable = S.state;
  assert.equal(S.save(true), false); assert.equal(storage.get(S.KEY), profile); assert.equal(S.state.savedAt, timestamp);
  assert.equal(S.persistence.unsaved, true);
});

test('finite integer boundaries and object shapes are enforced for profile records', () => {
  const { S } = harness();
  for (const patch of [ { stats: [] }, { progress: [] }, { completed: [] }, { daily: [] }, { ftue: null }, { ads: null }, { reserve: Number.MAX_SAFE_INTEGER + 1 }, { totalEmber: Infinity }, { stats: { games: -1, wins: 0.5, lowestMoves: 0.5 } } ]) {
    const data = { ...JSON.parse(profile), ...patch };
    assert.ok(S.validateProfile(data).issues.length > 0);
  }
  const data = JSON.parse(profile);
  data.completed.shield = { name: 'Cinder Aegis', date: 1700000000000, victories: 9, ember: 6000, forgingMs: 30.5 };
  data.progress.shield = { tier: 6, heat: 1000, started: 1690000000000, ember: 6000, victories: 9 };
  const checked = S.validateProfile(data);
  assert.deepEqual(plain(checked.issues), []); assert.deepEqual(plain(checked.profile.completed), data.completed); assert.deepEqual(plain(checked.profile.progress), data.progress);
});

test('a completed run and a won full deck validate without altering rewards or statistics', () => {
  const { E, S } = harness();
  const g = E.newGame(1, { seed: 1 });
  const cards = [...g.cols.flat(), ...g.stock]; cards.forEach(c => { c.up = true; });
  const remaining = cards.filter(c => parseInt(c.id.slice(1), 36) >= 13);
  g.cols = [remaining, [], [], [], [], [], [], [], [], []]; g.stock = []; g.completed = g.bestCompleted = 1;
  assert.equal(S.validateHand(g), true);
  g.cols = Array.from({ length: 10 }, () => []); g.completed = g.bestCompleted = 8; g.won = true;
  assert.equal(S.validateHand(g), true);
});

test('a warning remains unsaved while a retry is pending', () => {
  const options = { writeError: true }, { S } = harness(profile, options); S.load(); S.save(true);
  assert.equal(S.persistence.code, 'unsaved'); S.save(); assert.equal(S.persistence.code, 'unsaved');
});
