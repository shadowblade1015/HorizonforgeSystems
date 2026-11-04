// Put this file into your repository's tests/ directory.
// Locks the reviewed four art identities so future releases cannot silently
// reintroduce the Ace-on-a-visible-Five discrepancy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const expected = {
  '02': '9011dee54f4cfa8106f7dbe46764f7ca80eac5d0d7dfd58c84e6678e2f3a4881',
  '04': '9b94e59b972152a825a6b1c0c4afd222507c1bf159747654908cf88ab1cae052',
  '05': '23cc2f8d63cf249cfa9e586c5c02fea725781f8902cf26b3e83532b7cc290c51',
  '10': 'b67da90147f2e066dc4f6e2db3f22bff3f1c68876682247f9856e21c645160dc',
};
test('Hearts card artwork uses the matching engine ranks', () => {
  for (const [rank, hash] of Object.entries(expected)) {
    const path = new URL(`../site/ember-solitaire/assets/cards/hearts/${rank}.webp`, import.meta.url);
    const digest = createHash('sha256').update(readFileSync(path)).digest('hex');
    assert.equal(digest, hash, `Mismatched image for Hearts rank ${rank}`);
  }
});
