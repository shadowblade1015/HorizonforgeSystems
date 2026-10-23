import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { harness, card, position, finalSet } from './helpers.mjs';

test('F02: undo/replay must award only one victory per hand', () => {
  const { E, S } = harness(); S.load(); const g = finalSet(E); S.startGame(g);
  S.applyResult(g, E.move(g, 1, 0, 0));
  assert.equal(S.state.stats.wins, 1); assert.equal(S.state.embers, 85);
  E.undo(g); S.applyResult(g, E.move(g, 1, 0, 0));
  assert.deepEqual({ wins: S.state.stats.wins, embers: S.state.embers }, { wins: 1, embers: 85 });
});

test('F01: malformed hand must not be accepted as an active game', () => {
  const { S } = harness(readFileSync(new URL('./fixtures/corrupt-v2.json', import.meta.url), 'utf8')); S.load();
  assert.equal(S.state.embers, 321);
  assert.equal(S.state.game, null, 'Recover the profile while rejecting the malformed hand');
});

test('F14: a run containing a face-down second card must be rejected', { todo: 'Known defect F14' }, () => {
  const { E } = harness();
  assert.equal(E.movable([card('nine', 9), card('eight', 8, 'S', false)], 0), false);
});

test('F14: a completed sequence with a face-down Ace must remain on the board', { todo: 'Known defect F14' }, () => {
  const { E } = harness(), g = position(E);
  g.cols[0] = Array.from({ length: 13 }, (_, i) => card('run' + i, 13 - i, 'S', i !== 12));
  assert.equal(E.checkSets(g).length, 0);
});
